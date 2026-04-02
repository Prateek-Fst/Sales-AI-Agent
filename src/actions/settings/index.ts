'use server'
import { client } from '@/lib/db'
import { connectToDatabase } from '@/lib/mongodb'
import { collections } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export const onIntegrateDomain = async (domain: string, icon: string) => {
  const user = await getCurrentUser()
  if (!user) return
  try {
    const subscription = await client.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        _count: {
          select: {
            domains: true,
          },
        },
        subscription: {
          select: {
            plan: true,
          },
        },
      },
    })
    const domainExists = await client.user.findFirst({
      where: {
        id: user.id,
        domains: {
          some: {
            name: domain,
          },
        },
      },
    })

    if (!domainExists) {
      if (
        (subscription?.subscription?.plan == 'STANDARD' &&
          subscription._count.domains < 1) ||
        (subscription?.subscription?.plan == 'PRO' &&
          subscription._count.domains < 5) ||
        (subscription?.subscription?.plan == 'ULTIMATE' &&
          subscription._count.domains < 10)
      ) {
        const newDomain = await client.user.update({
          where: {
            id: user.id,
          },
          data: {
            domains: {
              create: {
                name: domain,
                icon,
                chatBot: {
                  create: {
                    welcomeMessage: 'Hey there, have  a question? Text us here',
                  },
                },
              },
            },
          },
        })

        if (newDomain) {
          return { status: 200, message: 'Domain successfully added' }
        }
      }
      return {
        status: 400,
        message:
          "You've reached the maximum number of domains, upgrade your plan",
      }
    }
    return {
      status: 400,
      message: 'Domain already exists',
    }
  } catch (error) {
    console.log(error)
  }
}

export const onGetSubscriptionPlan = async () => {
  try {
    const user = await getCurrentUser()
    if (!user) return
    const plan = await client.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        subscription: {
          select: {
            plan: true,
          },
        },
      },
    })
    if (plan) {
      return plan.subscription?.plan
    }
  } catch (error) {
    console.log(error)
  }
}

export const onGetAllAccountDomains = async () => {
  const user = await getCurrentUser()
  if (!user) return
  try {
    const { db } = await connectToDatabase()
    const domains = await db.collection(collections.domains).find({ userId: user.id }).toArray()

    const domainsWithChatRooms = await Promise.all(
      domains.map(async (domain: any) => {
        const customers = await db.collection(collections.customers).find({ domainId: domain.id }).toArray()
        const customerWithRooms = await Promise.all(
          customers.map(async (customer: any) => {
            const chatRoom = await db.collection(collections.chatRooms).find({ customerId: customer.id }).toArray()
            return { chatRoom: chatRoom.map((r: any) => ({ id: r.id, live: r.live })) }
          })
        )
        return { id: domain.id, name: domain.name, icon: domain.icon, customer: customerWithRooms }
      })
    )
    return { id: user.id, domains: domainsWithChatRooms }
  } catch (error) {
    console.log(error)
  }
}
export const onUpdatePassword = async (password: string) => {
  try {
    const user = await getCurrentUser()

    if (!user) return null
    const hashedPassword = await bcrypt.hash(password, 12)
    const update = await client.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })
    if (update) {
      return { status: 200, message: 'Password updated' }
    }
  } catch (error) {
    console.log(error)
  }
}

export const onGetCurrentDomainInfo = async (domain: string) => {
  const user = await getCurrentUser()
  if (!user) return
  try {
    const { db } = await connectToDatabase()
    const subscription = await db.collection(collections.billings).findOne({ userId: user.id })
    const domains = await db.collection(collections.domains)
      .find({ userId: user.id, name: { $regex: domain, $options: 'i' } })
      .toArray()

    const domainsWithDetails = await Promise.all(
      domains.map(async (d: any) => {
        const chatBot = await db.collection(collections.chatBots).findOne({ domainId: d.id })
        const products = await db.collection(collections.products).find({ domainId: d.id }).toArray()
        return {
          id: d.id as string,
          name: d.name as string,
          icon: d.icon as string,
          userId: d.userId as string,
          products: products.map((p: any) => ({
            id: p.id as string,
            name: p.name as string,
            price: p.price as number,
            image: p.image as string,
            createdAt: new Date(p.createdAt),
            domainId: p.domainId as string | null,
          })),
          chatBot: chatBot ? { id: chatBot.id as string, welcomeMessage: chatBot.welcomeMessage as string, icon: chatBot.icon as string } : null,
        }
      })
    )
    return { subscription: { plan: subscription?.plan as 'STANDARD' | 'PRO' | 'ULTIMATE' }, domains: domainsWithDetails }
  } catch (error) {
    console.log(error)
  }
}

export const onUpdateDomain = async (id: string, name: string) => {
  try {
    //check if domain with name exists
    const domainExists = await client.domain.findFirst({
      where: {
        name: {
          contains: name,
        },
      },
    })

    if (!domainExists) {
      const domain = await client.domain.update({
        where: {
          id,
        },
        data: {
          name,
        },
      })

      if (domain) {
        return {
          status: 200,
          message: 'Domain updated',
        }
      }

      return {
        status: 400,
        message: 'Oops something went wrong!',
      }
    }

    return {
      status: 400,
      message: 'Domain with this name already exists',
    }
  } catch (error) {
    console.log(error)
  }
}

export const onChatBotImageUpdate = async (id: string, icon: string) => {
  const user = await getCurrentUser()

  if (!user) return

  try {
    const domain = await client.domain.update({
      where: {
        id,
      },
      data: {
        chatBot: {
          update: {
            data: {
              icon,
            },
          },
        },
      },
    })

    if (domain) {
      return {
        status: 200,
        message: 'Domain updated',
      }
    }

    return {
      status: 400,
      message: 'Oops something went wrong!',
    }
  } catch (error) {
    console.log(error)
  }
}

export const onUpdateWelcomeMessage = async (
  message: string,
  domainId: string
) => {
  try {
    const update = await client.domain.update({
      where: {
        id: domainId,
      },
      data: {
        chatBot: {
          update: {
            data: {
              welcomeMessage: message,
            },
          },
        },
      },
    })

    if (update) {
      return { status: 200, message: 'Welcome message updated' }
    }
  } catch (error) {
    console.log(error)
  }
}

export const onDeleteUserDomain = async (id: string) => {
  const user = await getCurrentUser()

  if (!user) return

  try {
    //first verify that domain belongs to user
    const validUser = await client.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        id: true,
      },
    })

    if (validUser) {
      //check that domain belongs to this user and delete
      const deletedDomain = await client.domain.delete({
        where: {
          userId: validUser.id,
          id,
        },
        select: {
          name: true,
        },
      })

      if (deletedDomain) {
        return {
          status: 200,
          message: `${deletedDomain.name} was deleted successfully`,
        }
      }
    }
  } catch (error) {
    console.log(error)
  }
}

export const onCreateHelpDeskQuestion = async (
  id: string,
  question: string,
  answer: string
) => {
  try {
    const helpDeskQuestion = await client.domain.update({
      where: {
        id,
      },
      data: {
        helpdesk: {
          create: {
            question,
            answer,
          },
        },
      },
      include: {
        helpdesk: {
          select: {
            id: true,
            question: true,
            answer: true,
          },
        },
      },
    })

    if (helpDeskQuestion) {
      return {
        status: 200,
        message: 'New help desk question added',
        questions: helpDeskQuestion.helpdesk,
      }
    }

    return {
      status: 400,
      message: 'Oops! something went wrong',
    }
  } catch (error) {
    console.log(error)
  }
}

export const onGetAllHelpDeskQuestions = async (id: string) => {
  try {
    const questions = await client.helpDesk.findMany({
      where: {
        domainId: id,
      },
      select: {
        question: true,
        answer: true,
        id: true,
      },
    })

    return {
      status: 200,
      message: 'New help desk question added',
      questions: questions,
    }
  } catch (error) {
    console.log(error)
  }
}

export const onCreateFilterQuestions = async (id: string, question: string) => {
  try {
    const filterQuestion = await client.domain.update({
      where: {
        id,
      },
      data: {
        filterQuestions: {
          create: {
            question,
          },
        },
      },
      include: {
        filterQuestions: {
          select: {
            id: true,
            question: true,
          },
        },
      },
    })

    if (filterQuestion) {
      return {
        status: 200,
        message: 'Filter question added',
        questions: filterQuestion.filterQuestions,
      }
    }
    return {
      status: 400,
      message: 'Oops! something went wrong',
    }
  } catch (error) {
    console.log(error)
  }
}

export const onGetAllFilterQuestions = async (id: string) => {
  try {
    const questions = await client.filterQuestions.findMany({
      where: {
        domainId: id,
      },
      select: {
        question: true,
        id: true,
      },
      orderBy: {
        question: 'asc',
      },
    })

    return {
      status: 200,
      message: '',
      questions: questions,
    }
  } catch (error) {
    console.log(error)
  }
}

export const onGetPaymentConnected = async () => {
  try {
    const user = await getCurrentUser()
    if (user) {
      const connected = await client.user.findUnique({
        where: {
          id: user.id,
        },
        select: {
          stripeId: true,
        },
      })
      if (connected) {
        return connected.stripeId
      }
    }
  } catch (error) {
    console.log(error)
  }
}

export const onCreateNewDomainProduct = async (
  id: string,
  name: string,
  image: string,
  price: string
) => {
  try {
    const product = await client.domain.update({
      where: {
        id,
      },
      data: {
        products: {
          create: {
            name,
            image,
            price: parseInt(price),
          },
        },
      },
    })

    if (product) {
      return {
        status: 200,
        message: 'Product successfully created',
      }
    }
  } catch (error) {
    console.log(error)
  }
}
