'use server'

import { connectToDatabase } from '@/lib/mongodb'
import { collections, generateId } from '@/lib/models'
import { extractEmailsFromString, extractURLfromString } from '@/lib/utils'
import { onMailer } from '../mailer'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export const onStoreConversations = async (
  id: string,
  message: string,
  role: 'assistant' | 'user'
) => {
  const { db } = await connectToDatabase()
  await db.collection(collections.chatMessages).insertOne({
    id: generateId(),
    message,
    role,
    chatRoomId: id,
    seen: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
}

export const onGetCurrentChatBot = async (id: string) => {
  try {
    const { db } = await connectToDatabase()
    const domain = await db.collection(collections.domains).findOne({ id })
    if (!domain) return null

    const chatBot = await db.collection(collections.chatBots).findOne({ domainId: id })
    const helpdesk = await db.collection(collections.helpDesks).find({ domainId: id }).toArray()

    return {
      name: domain.name as string,
      chatBot: chatBot ? {
        id: chatBot.id as string,
        welcomeMessage: (chatBot.welcomeMessage ?? null) as string | null,
        icon: (chatBot.icon ?? null) as string | null,
        textColor: (chatBot.textColor ?? null) as string | null,
        background: (chatBot.background ?? null) as string | null,
        helpdesk: (chatBot.helpdesk ?? false) as boolean,
      } : null,
      helpdesk: (helpdesk as any[]).map((h) => ({
        id: h.id as string,
        question: h.question as string,
        answer: h.answer as string,
        domainId: (h.domainId ?? null) as string | null,
      })),
    }
  } catch (error) {
    console.log(error)
  }
}

let customerEmail: string | undefined

export const onAiChatBotAssistant = async (
  id: string,
  chat: { role: 'assistant' | 'user'; content: string }[],
  author: 'user',
  message: string
) => {
  try {
    const { db } = await connectToDatabase()

    const domain = await db.collection(collections.domains).findOne({ id })
    if (!domain) return

    const filterQuestions = await db.collection(collections.filterQuestions)
      .find({ domainId: id, answered: { $exists: false } })
      .toArray()

    const extractedEmail = extractEmailsFromString(message)
    if (extractedEmail) customerEmail = extractedEmail[0]

    if (customerEmail) {
      const domainOwner = await db.collection(collections.users).findOne({ id: domain.userId })

      let customer = await db.collection(collections.customers).findOne({
        domainId: id,
        email: { $regex: '^' + customerEmail },
      })

      if (!customer) {
        const customerId = generateId()
        await db.collection(collections.customers).insertOne({
          id: customerId, email: customerEmail, domainId: id,
        })
        const chatRoomId = generateId()
        await db.collection(collections.chatRooms).insertOne({
          id: chatRoomId, live: false, mailed: false, customerId,
          createdAt: new Date(), updatedAt: new Date(),
        })
        for (const q of filterQuestions) {
          await db.collection(collections.customerResponses).insertOne({
            id: generateId(), question: q.question, customerId,
          })
        }
        return {
          response: {
            role: 'assistant',
            content: `Welcome aboard ${customerEmail.split('@')[0]}! I'm glad to connect with you. Is there anything you need help with?`,
          },
        }
      }

      const chatRoom = await db.collection(collections.chatRooms).findOne({ customerId: customer.id })
      if (!chatRoom) return

      if (chatRoom.live) {
        await onStoreConversations(chatRoom.id, message, author)
        if (!chatRoom.mailed) {
          onMailer(domainOwner?.email)
          await db.collection(collections.chatRooms).updateOne(
            { id: chatRoom.id },
            { $set: { mailed: true } }
          )
        }
        return { live: true, chatRoom: chatRoom.id }
      }

      await onStoreConversations(chatRoom.id, message, author)

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: `
              You will get an array of questions that you must ask the customer. 
              Progress the conversation using those questions. 
              Whenever you ask a question from the array i need you to add a keyword at the end of the question (complete) this keyword is extremely important. 
              Do not forget it.
              only add this keyword when your asking a question from the array of questions. No other question satisfies this condition
              Always maintain character and stay respectfull.
              The array of questions : [${filterQuestions.map((q: any) => q.question).join(', ')}]
              if the customer says something out of context or inapporpriate. Simply say this is beyond you and you will get a real user to continue the conversation. And add a keyword (realtime) at the end.
              if the customer agrees to book an appointment send them this link ${process.env.NEXT_PUBLIC_APP_URL}/portal/${id}/appointment/${customer.id}
              if the customer wants to buy a product redirect them to the payment page ${process.env.NEXT_PUBLIC_APP_URL}/portal/${id}/payment/${customer.id}
          `,
          },
          ...chat,
          { role: 'user', content: message },
        ],
        model: 'llama-3.3-70b-versatile',
      })

      if (chatCompletion.choices[0].message.content?.includes('(realtime)')) {
        await db.collection(collections.chatRooms).updateOne({ id: chatRoom.id }, { $set: { live: true } })
        const response = {
          role: 'assistant',
          content: chatCompletion.choices[0].message.content.replace('(realtime)', ''),
        }
        await onStoreConversations(chatRoom.id, response.content, 'assistant')
        return { response }
      }

      if (chat[chat.length - 1]?.content.includes('(complete)')) {
        const firstUnanswered = await db.collection(collections.customerResponses).findOne({
          customerId: customer.id,
          answered: { $exists: false },
        })
        if (firstUnanswered) {
          await db.collection(collections.customerResponses).updateOne(
            { id: firstUnanswered.id },
            { $set: { answered: message } }
          )
        }
      }

      if (chatCompletion) {
        const generatedLink = extractURLfromString(chatCompletion.choices[0].message.content as string)
        if (generatedLink) {
          const link = generatedLink[0]
          const response = {
            role: 'assistant',
            content: `Great! you can follow the link to proceed`,
            link: link.slice(0, -1),
          }
          await onStoreConversations(chatRoom.id, `${response.content} ${response.link}`, 'assistant')
          return { response }
        }
        const response = { role: 'assistant', content: chatCompletion.choices[0].message.content }
        await onStoreConversations(chatRoom.id, `${response.content}`, 'assistant')
        return { response }
      }
    }

    console.log('No customer')
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `You are a sales assistant for ${domain.name}. Be brief and friendly. Ask the customer for their email address in one short sentence.`,
        },
        ...chat,
        { role: 'user', content: message },
      ],
      model: 'llama-3.3-70b-versatile',
    })

    if (chatCompletion) {
      return { response: { role: 'assistant', content: chatCompletion.choices[0].message.content } }
    }
  } catch (error) {
    console.log(error)
  }
}
