'use server'

import { client } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const onDomainCustomerResponses = async (customerId: string) => {
  try {
    const customerQuestions = await client.customer.findUnique({
      where: {
        id: customerId,
      },
      select: {
        email: true,
        questions: {
          select: {
            id: true,
            question: true,
            answered: true,
          },
        },
      },
    })

    if (customerQuestions) {
      return customerQuestions
    }
  } catch (error) {
    console.log(error)
  }
}

export const onGetAllDomainBookings = async (domainId: string) => {
  try {
    const bookings = await client.bookings.findMany({
      where: {
        domainId,
      },
      select: {
        slot: true,
        date: true,
      },
    })

    if (bookings) {
      return bookings
    }
  } catch (error) {
    console.log(error)
  }
}

export const onBookNewAppointment = async (
  domainId: string,
  customerId: string,
  slot: string,
  date: string,
  email: string
) => {
  try {
    const booking = await client.customer.update({
      where: {
        id: customerId,
      },
      data: {
        booking: {
          create: {
            domainId,
            slot,
            date,
            email,
          },
        },
      },
    })

    if (booking) {
      return { status: 200, message: 'Booking created' }
    }
  } catch (error) {
    console.log(error)
  }
}

export const saveAnswers = async (
  questions: [question: string],
  customerId: string
) => {
  try {
    for (const question in questions) {
      await client.customer.update({
        where: { id: customerId },
        data: {
          questions: {
            update: {
              where: {
                id: question,
              },
              data: {
                answered: questions[question],
              },
            },
          },
        },
      })
    }
    return {
      status: 200,
      messege: 'Updated Responses',
    }
  } catch (error) {
    console.log(error)
  }
}

export const onGetAllBookingsForCurrentUser = async (userId: string) => {
  try {
    const { db } = await import('@/lib/mongodb').then(m => m.connectToDatabase())
    const { collections } = await import('@/lib/models')

    const domains = await db.collection(collections.domains).find({ userId }).toArray()
    const domainIds = domains.map((d: any) => d.id)
    const customers = await db.collection(collections.customers).find({ domainId: { $in: domainIds } }).toArray()
    const customerIds = customers.map((c: any) => c.id)

    const bookings = await db.collection(collections.bookings)
      .find({ customerId: { $in: customerIds } })
      .toArray()

    return {
      bookings: bookings.map((b: any) => {
        const customer = customers.find((c: any) => c.id === b.customerId)
        const domain = domains.find((d: any) => d.id === customer?.domainId)
        return {
          id: b.id, slot: b.slot, createdAt: b.createdAt,
          date: b.date, email: b.email, domainId: b.domainId,
          Customer: { Domain: { name: domain?.name } },
        }
      }),
    }
  } catch (error) {
    console.log(error)
  }
}

export const getUserAppointments = async () => {
  try {
    const user = await getCurrentUser()
    if (user) {
      const bookings = await client.bookings.count({
        where: {
          Customer: {
            Domain: {
              User: {
                id: user.id,
              },
            },
          },
        },
      })

      if (bookings) {
        return bookings
      }
    }
  } catch (error) {
    console.log(error)
  }
}
