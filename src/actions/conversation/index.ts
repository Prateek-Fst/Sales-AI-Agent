'use server'

import { client } from '@/lib/db'

// No-op: message already stored by onStoreConversations, polling handles delivery
export const onRealTimeChat = async (
  chatroomId: string,
  message: string,
  id: string,
  role: 'assistant' | 'user'
) => {}

export const onToggleRealtime = async (id: string, state: boolean) => {
  try {
    const chatRoom = await client.chatRoom.update({
      where: {
        id,
      },
      data: {
        live: state,
      },
      select: {
        id: true,
        live: true,
      },
    })

    if (chatRoom) {
      return {
        status: 200,
        message: chatRoom.live
          ? 'Realtime mode enabled'
          : 'Realtime mode disabled',
        chatRoom,
      }
    }
  } catch (error) {
    console.log(error)
  }
}

export const onGetConversationMode = async (id: string) => {
  try {
    const mode = await client.chatRoom.findUnique({
      where: {
        id,
      },
      select: {
        live: true,
      },
    })
    console.log(mode)
    return mode
  } catch (error) {
    console.log(error)
  }
}

export const onGetDomainChatRooms = async (id: string) => {
  try {
    const { db } = await import('@/lib/mongodb').then(m => m.connectToDatabase())
    const { collections } = await import('@/lib/models')

    const customers = await db.collection(collections.customers).find({ domainId: id }).toArray()

    const customerData = await Promise.all(
      customers.map(async (customer: any) => {
        const chatRooms = await db.collection(collections.chatRooms).find({ customerId: customer.id }).toArray()
        const chatRoomData = await Promise.all(
          chatRooms.map(async (room: any) => {
            const messages = await db.collection(collections.chatMessages)
              .find({ chatRoomId: room.id })
              .sort({ createdAt: -1 })
              .limit(1)
              .toArray()
            return {
              id: room.id as string,
              createdAt: new Date(room.createdAt),
              message: messages.map((m: any) => ({
                message: m.message as string,
                createdAt: new Date(m.createdAt),
                seen: m.seen as boolean,
              })),
            }
          })
        )
        return { email: (customer.email ?? null) as string | null, chatRoom: chatRoomData }
      })
    )

    return { customer: customerData }
  } catch (error) {
    console.log(error)
  }
}

export const onGetChatMessages = async (id: string) => {
  try {
    const messages = await client.chatRoom.findMany({
      where: {
        id,
      },
      select: {
        id: true,
        live: true,
        message: {
          select: {
            id: true,
            role: true,
            message: true,
            createdAt: true,
            seen: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (messages) {
      return messages
    }
  } catch (error) {
    console.log(error)
  }
}



export const onViewUnReadMessages = async (id: string) => {
  try {
    await client.chatMessage.updateMany({
      where: {
        chatRoomId: id,
      },
      data: {
        seen: true,
      },
    })
  } catch (error) {
    console.log(error)
  }
}

export const onGetLatestMessages = async (chatRoomId: string, after?: string) => {
  try {
    const messages = await client.chatMessage.findMany({
      where: {
        chatRoomId,
        ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      },
      select: { id: true, role: true, message: true, createdAt: true, seen: true },
      orderBy: { createdAt: 'asc' },
    })
    return messages
  } catch (error) {
    console.log(error)
  }
}

export const onOwnerSendMessage = async (
  chatroom: string,
  message: string,
  role: 'assistant' | 'user'
) => {
  try {
    const chat = await client.chatRoom.update({
      where: {
        id: chatroom,
      },
      data: {
        message: {
          create: {
            message,
            role,
          },
        },
      },
      select: {
        message: {
          select: {
            id: true,
            role: true,
            message: true,
            createdAt: true,
            seen: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    })

    if (chat) {
      return chat
    }
  } catch (error) {
    console.log(error)
  }
}
