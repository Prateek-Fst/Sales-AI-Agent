import { getDb } from './mongodb'
import { collections, generateId } from './models'

// Export db and helper functions for MongoDB operations
export { getDb, collections, generateId }

// Helper function to get a collection
export async function getCollection(collectionName: string) {
  const db = await getDb()
  return db.collection(collectionName)
}

// Simulating Prisma client structure for easier migration
export const client = {
  // User operations
  user: {
    findUnique: async ({ where, select }: any) => {
      const collection = await getCollection(collections.users)
      const query: any = {}
      if (where.id) query.id = where.id
      if (where.email) query.email = where.email

      const user = await collection.findOne(query)
      if (!user) return null

      // Handle select fields
      if (select) {
        const selected: any = { id: user.id }
        for (const key of Object.keys(select)) {
          if (key === '_count') {
            // Handle count queries
            const domainsCollection = await getCollection(collections.domains)
            const count = await domainsCollection.countDocuments({ userId: user.id })
            selected._count = { domains: count }
          } else if (key === 'subscription') {
            const billingsCollection = await getCollection(collections.billings)
            selected.subscription = await billingsCollection.findOne({ userId: user.id })
          } else if (key === 'domains') {
            const domainsCollection = await getCollection(collections.domains)
            const domainQuery: any = { userId: user.id }
            if (select.domains.where) {
              if (select.domains.where.name?.contains) {
                domainQuery.name = { $regex: select.domains.where.name.contains, $options: 'i' }
              }
            }
            selected.domains = await domainsCollection.find(domainQuery).toArray()
          } else if (key === 'campaign') {
            const campaignsCollection = await getCollection(collections.campaigns)
            selected.campaign = await campaignsCollection.find({ userId: user.id }).toArray()
          } else if (key === 'stripeId') {
            selected.stripeId = user.stripeId
          }
        }
        return selected
      }
      return user
    },
    findFirst: async ({ where }: any) => {
      const collection = await getCollection(collections.users)
      const query: any = { id: where.id }

      if (where.domains?.some?.name) {
        const domainsCollection = await getCollection(collections.domains)
        const domain = await domainsCollection.findOne({
          userId: where.id,
          name: where.domains.some.name,
        })
        if (!domain) return null
      }

      return collection.findOne(query)
    },
    findMany: async ({ where }: any) => {
      const collection = await getCollection(collections.users)
      const query: any = {}
      if (where?.id) query.id = where.id
      return collection.find(query).toArray()
    },
    create: async ({ data, select }: any) => {
      const collection = await getCollection(collections.users)
      const id = generateId()

      const userData: any = {
        id,
        fullname: data.fullname,
        email: data.email,
        password: data.password,
        type: data.type,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Create billing subscription if provided
      if (data.subscription?.create) {
        const billingsCollection = await getCollection(collections.billings)
        await billingsCollection.insertOne({
          id: generateId(),
          plan: 'STANDARD',
          credits: 10,
          userId: id,
        })
      }

      await collection.insertOne(userData)

      if (select) {
        const selected: any = { id }
        for (const key of Object.keys(select)) {
          if (key !== 'subscription') {
            selected[key] = userData[key]
          }
        }
        return selected
      }
      return userData
    },
    update: async ({ where, data, select }: any) => {
      const collection = await getCollection(collections.users)
      const query: any = {}
      if (where.id) query.id = where.id
      if (where.email) query.email = where.email

      const updateData: any = {}
      if (data.fullname) updateData.fullname = data.fullname
      if (data.email) updateData.email = data.email
      if (data.password) updateData.password = data.password
      if (data.type) updateData.type = data.type
      if (data.stripeId !== undefined) updateData.stripeId = data.stripeId
      updateData.updatedAt = new Date()

      // Handle nested updates
      if (data.subscription?.update?.data) {
        const billingsCollection = await getCollection(collections.billings)
        const billingUpdate: any = {}
        const billingData = data.subscription.update.data
        if (billingData.plan) billingUpdate.plan = billingData.plan
        if (billingData.credits !== undefined) {
          if (typeof billingData.credits === 'object' && billingData.credits.decrement) {
            const existing = await billingsCollection.findOne({ userId: where.id })
            billingUpdate.credits = (existing?.credits || 0) - billingData.credits.decrement
          } else {
            billingUpdate.credits = billingData.credits
          }
        }
        await billingsCollection.updateOne(
          { userId: where.id },
          { $set: billingUpdate }
        )
      }

      // Handle nested creates (domains, campaigns)
      if (data.domains?.create) {
        const domainsCollection = await getCollection(collections.domains)
        const chatBotsCollection = await getCollection(collections.chatBots)
        const domainData = data.domains.create
        const domainId = generateId()

        await domainsCollection.insertOne({
          id: domainId,
          name: domainData.name,
          icon: domainData.icon,
          userId: where.id,
        })

        if (domainData.chatBot?.create) {
          await chatBotsCollection.insertOne({
            id: generateId(),
            ...domainData.chatBot.create,
            helpdesk: false,
            domainId,
          })
        }
      }

      if (data.campaign?.create) {
        const campaignsCollection = await getCollection(collections.campaigns)
        await campaignsCollection.insertOne({
          id: generateId(),
          name: data.campaign.create.name,
          customers: [],
          userId: where.id,
          createdAt: new Date(),
        })
      }

      await collection.updateOne(query, { $set: updateData })

      const updated = await collection.findOne(query)
      if (select) {
        const selected: any = {}
        for (const key of Object.keys(select)) {
          if (key === 'subscription') {
            const billingsCollection = await getCollection(collections.billings)
            selected.subscription = await billingsCollection.findOne({ userId: where.id })
          } else {
            selected[key] = updated?.[key]
          }
        }
        return selected
      }
      return updated
    },
    count: async ({ where }: any) => {
      const collection = await getCollection(collections.users)
      const query: any = {}
      if (where?.id) query.id = where.id
      return collection.countDocuments(query)
    },
  },

  // Domain operations
  domain: {
    findUnique: async ({ where, select }: any) => {
      const collection = await getCollection(collections.domains)
      const query: any = {}
      if (where.id) query.id = where.id

      const domain = await collection.findOne(query)
      if (!domain) return null

      if (select) {
        const selected: any = {}
        for (const key of Object.keys(select)) {
          if (key === 'User') {
            if (domain.userId) {
              const usersCollection = await getCollection(collections.users)
              const user = await usersCollection.findOne({ id: domain.userId })
              selected.User = user
            }
          } else if (key === 'customer') {
            const customersCollection = await getCollection(collections.customers)
            const customerQuery: any = { domainId: where.id }
            if (select.customer?.where?.email?.startsWith) {
              customerQuery.email = { $regex: '^' + select.customer.where.email.startsWith }
            }
            selected.customer = await customersCollection.find(customerQuery).toArray()
          } else if (key === 'chatBot') {
            const chatBotsCollection = await getCollection(collections.chatBots)
            selected.chatBot = await chatBotsCollection.findOne({ domainId: where.id })
          } else if (key === 'helpdesk') {
            const helpDesksCollection = await getCollection(collections.helpDesks)
            selected.helpdesk = await helpDesksCollection.find({ domainId: where.id }).toArray()
          } else if (key === 'filterQuestions') {
            const filterQuestionsCollection = await getCollection(collections.filterQuestions)
            const fqQuery: any = { domainId: where.id }
            if (select.filterQuestions?.where?.answered === null) {
              fqQuery.answered = { $exists: false }
            }
            selected.filterQuestions = await filterQuestionsCollection.find(fqQuery).toArray()
          } else if (key === 'products') {
            const productsCollection = await getCollection(collections.products)
            selected.products = await productsCollection.find({ domainId: where.id }).toArray()
          } else {
            selected[key] = domain[key]
          }
        }
        return selected
      }
      return domain
    },
    findFirst: async ({ where }: any) => {
      const collection = await getCollection(collections.domains)
      const query: any = {}
      if (where.name?.contains) {
        query.name = { $regex: where.name.contains, $options: 'i' }
      }
      return collection.findOne(query)
    },
    findMany: async ({ where, select }: any) => {
      const collection = await getCollection(collections.domains)
      const query: any = {}
      if (where?.userId) query.userId = where.userId
      if (where?.id) query.id = where.id

      const domains = await collection.find(query).toArray()

      if (select) {
        return domains.map((domain: any) => {
          const selected: any = {}
          for (const key of Object.keys(select)) {
            selected[key] = domain[key]
          }
          return selected
        })
      }
      return domains
    },
    create: async ({ data }: any) => {
      const collection = await getCollection(collections.domains)
      const id = generateId()
      const domainData = {
        id,
        name: data.name,
        icon: data.icon,
        userId: data.user?.connect?.id,
      }
      await collection.insertOne(domainData)
      return domainData
    },
    update: async ({ where, data, include }: any) => {
      const collection = await getCollection(collections.domains)
      const query: any = { id: where.id }
      if (where.userId) query.userId = where.userId

      const updateData: any = {}
      if (data.name) updateData.name = data.name
      if (data.icon) updateData.icon = data.icon

      // Handle nested operations
      if (data.customer?.create) {
        const customersCollection = await getCollection(collections.customers)
        const chatRoomsCollection = await getCollection(collections.chatRooms)
        const customerResponsesCollection = await getCollection(collections.customerResponses)
        const filterQuestionsCollection = await getCollection(collections.filterQuestions)

        const customerData = data.customer.create
        const customerId = generateId()

        await customersCollection.insertOne({
          id: customerId,
          email: customerData.email,
          domainId: where.id,
        })

        if (customerData.chatRoom?.create) {
          await chatRoomsCollection.insertOne({
            id: generateId(),
            live: false,
            mailed: false,
            customerId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }

        if (customerData.questions?.create && Array.isArray(customerData.questions.create)) {
          for (const q of customerData.questions.create) {
            await customerResponsesCollection.insertOne({
              id: generateId(),
              question: q.question,
              customerId,
            })
          }
        }
      }

      if (data.chatBot?.update?.data) {
        const chatBotsCollection = await getCollection(collections.chatBots)
        await chatBotsCollection.updateOne(
          { domainId: where.id },
          { $set: data.chatBot.update.data }
        )
      }

      if (data.helpdesk?.create) {
        const helpDesksCollection = await getCollection(collections.helpDesks)
        await helpDesksCollection.insertOne({
          id: generateId(),
          ...data.helpdesk.create,
          domainId: where.id,
        })
      }

      if (data.filterQuestions?.create) {
        const filterQuestionsCollection = await getCollection(collections.filterQuestions)
        await filterQuestionsCollection.insertOne({
          id: generateId(),
          ...data.filterQuestions.create,
          domainId: where.id,
        })
      }

      if (data.products?.create) {
        const productsCollection = await getCollection(collections.products)
        await productsCollection.insertOne({
          id: generateId(),
          ...data.products.create,
          domainId: where.id,
          createdAt: new Date(),
        })
      }

      await collection.updateOne(query, { $set: updateData })

      const updated = await collection.findOne({ id: where.id })

      if (include) {
        const result: any = { ...updated }
        if (include.helpdesk) {
          const helpDesksCollection = await getCollection(collections.helpDesks)
          result.helpdesk = await helpDesksCollection.find({ domainId: where.id }).toArray()
        }
        if (include.filterQuestions) {
          const filterQuestionsCollection = await getCollection(collections.filterQuestions)
          result.filterQuestions = await filterQuestionsCollection.find({ domainId: where.id }).toArray()
        }
        return result
      }

      return updated
    },
    delete: async ({ where, select }: any) => {
      const collection = await getCollection(collections.domains)
      const query: any = {}
      if (where.id) query.id = where.id
      if (where.userId) query.userId = where.userId

      const domain = await collection.findOne(query)
      if (!domain) return null

      await collection.deleteOne(query)

      if (select) {
        const selected: any = {}
        for (const key of Object.keys(select)) {
          selected[key] = domain[key]
        }
        return selected
      }
      return domain
    },
    count: async ({ where }: any) => {
      const collection = await getCollection(collections.domains)
      const query: any = {}
      if (where?.userId) query.userId = where.userId
      return collection.countDocuments(query)
    },
  },

  // Customer operations
  customer: {
    findUnique: async ({ where, select }: any) => {
      const collection = await getCollection(collections.customers)
      const customer = await collection.findOne({ id: where.id })
      if (!customer) return null

      if (select) {
        const selected: any = {}
        for (const key of Object.keys(select)) {
          if (key === 'questions') {
            const responsesCollection = await getCollection(collections.customerResponses)
            selected.questions = await responsesCollection.find({ customerId: where.id }).toArray()
          } else if (key === 'chatRoom') {
            const chatRoomsCollection = await getCollection(collections.chatRooms)
            selected.chatRoom = await chatRoomsCollection.find({ customerId: where.id }).toArray()
          } else if (key === 'booking') {
            const bookingsCollection = await getCollection(collections.bookings)
            selected.booking = await bookingsCollection.find({ customerId: where.id }).toArray()
          } else if (key === 'Domain') {
            if (customer.domainId) {
              const domainsCollection = await getCollection(collections.domains)
              selected.Domain = await domainsCollection.findOne({ id: customer.domainId })
            }
          } else {
            selected[key] = customer[key]
          }
        }
        return selected
      }
      return customer
    },
    findMany: async ({ where, select }: any) => {
      const collection = await getCollection(collections.customers)
      const query: any = {}
      if (where?.domainId) query.domainId = where.domainId

      const customers = await collection.find(query).toArray()

      if (select) {
        return Promise.all(customers.map(async (customer: any) => {
          const selected: any = {}
          for (const key of Object.keys(select)) {
            if (key === 'chatRoom') {
              const chatRoomsCollection = await getCollection(collections.chatRooms)
              const chatRooms = await chatRoomsCollection.find({ customerId: customer.id }).toArray()
              selected.chatRoom = await Promise.all(chatRooms.map(async (room: any) => {
                if (select.chatRoom?.select?.message) {
                  const messagesCollection = await getCollection(collections.chatMessages)
                  const messages = await messagesCollection
                    .find({ chatRoomId: room.id })
                    .sort({ createdAt: -1 })
                    .limit(1)
                    .toArray()
                  return { ...room, message: messages }
                }
                return room
              }))
            } else if (key === 'Domain') {
              if (customer.domainId) {
                const domainsCollection = await getCollection(collections.domains)
                selected.Domain = await domainsCollection.findOne({ id: customer.domainId })
              }
            } else {
              selected[key] = customer[key]
            }
          }
          return selected
        }))
      }
      return customers
    },
    update: async ({ where, data }: any) => {
      const collection = await getCollection(collections.customers)

      if (data.booking?.create) {
        const bookingsCollection = await getCollection(collections.bookings)
        await bookingsCollection.insertOne({
          id: generateId(),
          ...data.booking.create,
          customerId: where.id,
          createdAt: new Date(),
        })
      }

      if (data.questions?.update) {
        const responsesCollection = await getCollection(collections.customerResponses)
        await responsesCollection.updateOne(
          { id: data.questions.update.where.id },
          { $set: { answered: data.questions.update.data.answered } }
        )
      }

      return collection.findOne({ id: where.id })
    },
    count: async ({ where }: any) => {
      const collection = await getCollection(collections.customers)
      const query: any = {}

      if (where?.Domain?.User?.id) {
        const domainsCollection = await getCollection(collections.domains)
        const domains = await domainsCollection.find({ userId: where.Domain.User.id }).toArray()
        const domainIds = domains.map(d => d.id)
        query.domainId = { $in: domainIds }
      }

      return collection.countDocuments(query)
    },
  },

  // ChatRoom operations
  chatRoom: {
    findUnique: async ({ where, select }: any) => {
      const collection = await getCollection(collections.chatRooms)
      const room = await collection.findOne({ id: where.id })
      if (!room) return null

      if (select) {
        const selected: any = {}
        for (const key of Object.keys(select)) {
          if (key === 'message') {
            const messagesCollection = await getCollection(collections.chatMessages)
            const messageQuery: any = { chatRoomId: where.id }
            let cursor = messagesCollection.find(messageQuery)

            if (select.message?.orderBy?.createdAt === 'desc') {
              cursor = cursor.sort({ createdAt: -1 })
            } else if (select.message?.orderBy?.createdAt === 'asc') {
              cursor = cursor.sort({ createdAt: 1 })
            }

            if (select.message?.take) {
              cursor = cursor.limit(select.message.take)
            }

            const messages = await cursor.toArray()
            selected.message = messages.map((msg: any) => {
              const msgSelected: any = {}
              for (const msgKey of Object.keys(select.message?.select || {})) {
                msgSelected[msgKey] = msg[msgKey]
              }
              return msgSelected
            })
          } else {
            selected[key] = room[key]
          }
        }
        return selected
      }
      return room
    },
    findMany: async ({ where, select }: any) => {
      const collection = await getCollection(collections.chatRooms)
      const query: any = {}
      if (where?.id) query.id = where.id
      if (where?.customerId) query.customerId = where.customerId

      const rooms = await collection.find(query).toArray()

      if (select) {
        return Promise.all(rooms.map(async (room: any) => {
          const selected: any = {}
          for (const key of Object.keys(select)) {
            if (key === 'message') {
              const messagesCollection = await getCollection(collections.chatMessages)
              let cursor = messagesCollection.find({ chatRoomId: room.id })

              if (select.message?.orderBy?.createdAt === 'desc') {
                cursor = cursor.sort({ createdAt: -1 })
              } else if (select.message?.orderBy?.createdAt === 'asc') {
                cursor = cursor.sort({ createdAt: 1 })
              }

              if (select.message?.take) {
                cursor = cursor.limit(select.message.take)
              }

              const messages = await cursor.toArray()
              selected.message = messages.map((msg: any) => {
                const msgSelected: any = {}
                for (const msgKey of Object.keys(select.message?.select || {})) {
                  msgSelected[msgKey] = msg[msgKey]
                }
                return msgSelected
              })
            } else {
              selected[key] = room[key]
            }
          }
          return selected
        }))
      }
      return rooms
    },
    update: async ({ where, data, select }: any) => {
      const collection = await getCollection(collections.chatRooms)
      const updateData: any = {}
      if (data.live !== undefined) updateData.live = data.live
      if (data.mailed !== undefined) updateData.mailed = data.mailed
      updateData.updatedAt = new Date()

      if (data.message?.create) {
        const messagesCollection = await getCollection(collections.chatMessages)
        await messagesCollection.insertOne({
          id: generateId(),
          ...data.message.create,
          chatRoomId: where.id,
          seen: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }

      await collection.updateOne({ id: where.id }, { $set: updateData })

      const updated = await collection.findOne({ id: where.id })

      if (select) {
        const selected: any = {}
        for (const key of Object.keys(select)) {
          if (key === 'message') {
            const messagesCollection = await getCollection(collections.chatMessages)
            let cursor = messagesCollection.find({ chatRoomId: where.id })

            if (select.message?.orderBy?.createdAt === 'desc') {
              cursor = cursor.sort({ createdAt: -1 })
            }

            if (select.message?.take) {
              cursor = cursor.limit(select.message.take)
            }

            const messages = await cursor.toArray()
            selected.message = messages.map((msg: any) => {
              const msgSelected: any = {}
              for (const msgKey of Object.keys(select.message?.select || {})) {
                msgSelected[msgKey] = msg[msgKey]
              }
              return msgSelected
            })
          } else {
            selected[key] = updated?.[key]
          }
        }
        return selected
      }

      return updated
    },
  },

  // ChatMessage operations
  chatMessage: {
    findMany: async ({ where, select, orderBy }: any) => {
      const collection = await getCollection(collections.chatMessages)
      const query: any = {}
      if (where?.chatRoomId) query.chatRoomId = where.chatRoomId
      if (where?.createdAt?.gt) query.createdAt = { $gt: new Date(where.createdAt.gt) }

      let cursor = collection.find(query)

      if (orderBy?.createdAt === 'asc') {
        cursor = cursor.sort({ createdAt: 1 })
      } else if (orderBy?.createdAt === 'desc') {
        cursor = cursor.sort({ createdAt: -1 })
      }

      const messages = await cursor.toArray()

      if (select) {
        return messages.map((msg: any) => {
          const selected: any = {}
          for (const key of Object.keys(select)) {
            selected[key] = msg[key]
          }
          return selected
        })
      }
      return messages
    },
    updateMany: async ({ where, data }: any) => {
      const collection = await getCollection(collections.chatMessages)
      const query: any = {}
      if (where.chatRoomId) query.chatRoomId = where.chatRoomId

      await collection.updateMany(query, { $set: data })
    },
  },

  // CustomerResponses operations
  customerResponses: {
    findFirst: async ({ where, select, orderBy }: any) => {
      const collection = await getCollection(collections.customerResponses)
      const query: any = {}
      if (where.customerId) query.customerId = where.customerId
      if (where.answered === null) query.answered = { $exists: false }

      let cursor = collection.find(query)
      if (orderBy?.question === 'asc') {
        cursor = cursor.sort({ question: 1 })
      }

      const response = await cursor.limit(1).toArray()
      if (!response.length) return null

      if (select) {
        const selected: any = {}
        for (const key of Object.keys(select)) {
          selected[key] = response[0][key]
        }
        return selected
      }
      return response[0]
    },
    update: async ({ where, data }: any) => {
      const collection = await getCollection(collections.customerResponses)
      await collection.updateOne(
        { id: where.id },
        { $set: { answered: data.answered } }
      )
    },
  },

  // Bookings operations
  bookings: {
    findMany: async ({ where, select }: any) => {
      const collection = await getCollection(collections.bookings)
      const query: any = {}

      if (where?.domainId) query.domainId = where.domainId

      if (where?.Customer?.Domain?.User?.id) {
        const domainsCollection = await getCollection(collections.domains)
        const domains = await domainsCollection.find({ userId: where.Customer.Domain.User.id }).toArray()
        const domainIds = domains.map(d => d.id)
        query.domainId = { $in: domainIds }
      }

      const bookings = await collection.find(query).toArray()

      if (select) {
        return Promise.all(bookings.map(async (booking: any) => {
          const selected: any = {}
          for (const key of Object.keys(select)) {
            if (key === 'Customer') {
              if (booking.customerId) {
                const customersCollection = await getCollection(collections.customers)
                const customer = await customersCollection.findOne({ id: booking.customerId })
                if (customer?.domainId) {
                  const domainsCollection = await getCollection(collections.domains)
                  const domain = await domainsCollection.findOne({ id: customer.domainId })
                  selected.Customer = { Domain: domain }
                }
              }
            } else {
              selected[key] = booking[key]
            }
          }
          return selected
        }))
      }
      return bookings
    },
    count: async ({ where }: any) => {
      const collection = await getCollection(collections.bookings)
      const query: any = {}

      if (where?.Customer?.Domain?.User?.id) {
        const domainsCollection = await getCollection(collections.domains)
        const domains = await domainsCollection.find({ userId: where.Customer.Domain.User.id }).toArray()
        const domainIds = domains.map(d => d.id)
        query.domainId = { $in: domainIds }
      }

      return collection.countDocuments(query)
    },
  },

  // Campaign operations
  campaign: {
    findUnique: async ({ where, select }: any) => {
      const collection = await getCollection(collections.campaigns)
      const campaign = await collection.findOne({ id: where.id })
      if (!campaign) return null

      if (select) {
        const selected: any = {}
        for (const key of Object.keys(select)) {
          selected[key] = campaign[key]
        }
        return selected
      }
      return campaign
    },
    findMany: async ({ where }: any) => {
      const collection = await getCollection(collections.campaigns)
      const query: any = {}
      if (where?.userId) query.userId = where.userId
      return collection.find(query).toArray()
    },
    update: async ({ where, data }: any) => {
      const collection = await getCollection(collections.campaigns)
      const updateData: any = {}
      if (data.template !== undefined) updateData.template = data.template
      if (data.customers) updateData.customers = data.customers

      await collection.updateOne({ id: where.id }, { $set: updateData })
      return collection.findOne({ id: where.id })
    },
  },

  // Product operations
  product: {
    findMany: async ({ where, select }: any) => {
      const collection = await getCollection(collections.products)
      const query: any = {}

      if (where?.domainId) query.domainId = where.domainId

      if (where?.Domain?.User?.id) {
        const domainsCollection = await getCollection(collections.domains)
        const domains = await domainsCollection.find({ userId: where.Domain.User.id }).toArray()
        const domainIds = domains.map(d => d.id)
        query.domainId = { $in: domainIds }
      }

      const products = await collection.find(query).toArray()

      if (select) {
        return products.map((product: any) => {
          const selected: any = {}
          for (const key of Object.keys(select)) {
            selected[key] = product[key]
          }
          return selected
        })
      }
      return products
    },
  },

  // HelpDesk operations
  helpDesk: {
    findMany: async ({ where, select }: any) => {
      const collection = await getCollection(collections.helpDesks)
      const query: any = {}
      if (where?.domainId) query.domainId = where.domainId

      const questions = await collection.find(query).toArray()

      if (select) {
        return questions.map((q: any) => {
          const selected: any = {}
          for (const key of Object.keys(select)) {
            selected[key] = q[key]
          }
          return selected
        })
      }
      return questions
    },
  },

  // FilterQuestions operations
  filterQuestions: {
    findMany: async ({ where, select, orderBy }: any) => {
      const collection = await getCollection(collections.filterQuestions)
      const query: any = {}
      if (where?.domainId) query.domainId = where.domainId

      let cursor = collection.find(query)
      if (orderBy?.question === 'asc') {
        cursor = cursor.sort({ question: 1 })
      }

      const questions = await cursor.toArray()

      if (select) {
        return questions.map((q: any) => {
          const selected: any = {}
          for (const key of Object.keys(select)) {
            selected[key] = q[key]
          }
          return selected
        })
      }
      return questions
    },
  },
}
