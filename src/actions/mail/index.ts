'use server'

import { client } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import nodemailer from 'nodemailer'

export const onGetAllCustomers = async (id: string) => {
  try {
    const { db } = await import('@/lib/mongodb').then(m => m.connectToDatabase())
    const { collections } = await import('@/lib/models')

    const billingsCollection = db.collection(collections.billings)
    const subscription = await billingsCollection.findOne({ userId: id })

    const domainsCollection = db.collection(collections.domains)
    const domains = await domainsCollection.find({ userId: id }).toArray()
    const domainIds = domains.map((d: any) => d.id)

    const customersCollection = db.collection(collections.customers)
    const customers = await customersCollection.find({ domainId: { $in: domainIds } }).toArray()

    const customersWithDomain = customers.map((c: any) => {
      const domain = domains.find((d: any) => d.id === c.domainId)
      return { id: c.id, email: c.email, Domain: domain ? { name: domain.name } : null }
    })

    return {
      subscription: subscription as { plan: 'STANDARD' | 'PRO' | 'ULTIMATE'; credits: number } | null,
      domains: [{ customer: customersWithDomain }],
    }
  } catch (error) {}
}

export const onGetAllCampaigns = async (id: string) => {
  try {
    const campaigns = await client.user.findUnique({
      where: {
        id: id,
      },
      select: {
        campaign: {
          select: {
            name: true,
            id: true,
            customers: true,
            createdAt: true,
          },
        },
      },
    })

    if (campaigns) {
      return campaigns
    }
  } catch (error) {
    console.log(error)
  }
}

export const onCreateMarketingCampaign = async (name: string) => {
  try {
    const user = await getCurrentUser()
    if (!user) return null

    const campaign = await client.user.update({
      where: {
        id: user.id,
      },
      data: {
        campaign: {
          create: {
            name,
          },
        },
      },
    })

    if (campaign) {
      return { status: 200, message: 'You campaign was created' }
    }
  } catch (error) {
    console.log(error)
  }
}

export const onSaveEmailTemplate = async (
  template: string,
  campainId: string
) => {
  try {
    const newTemplate = await client.campaign.update({
      where: {
        id: campainId,
      },
      data: {
        template,
      },
    })

    return { status: 200, message: 'Email template created' }
  } catch (error) {
    console.log(error)
  }
}

export const onAddCustomersToEmail = async (
  customers: string[],
  id: string
) => {
  try {
    console.log(customers, id)
    const customerAdd = await client.campaign.update({
      where: {
        id,
      },
      data: {
        customers,
      },
    })

    if (customerAdd) {
      return { status: 200, message: 'Customer added to campaign' }
    }
  } catch (error) {}
}

export const onBulkMailer = async (email: string[], campaignId: string) => {
  try {
    const user = await getCurrentUser()
    if (!user) return null

    //get the template for this campaign
    const template = await client.campaign.findUnique({
      where: {
        id: campaignId,
      },
      select: {
        name: true,
        template: true,
      },
    })

    if (template && template.template) {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.NODE_MAILER_EMAIL,
          pass: process.env.NODE_MAILER_GMAIL_APP_PASSWORD,
        },
      })

      const mailOptions = {
        to: email,
        subject: template.name,
        text: JSON.parse(template.template),
      }

      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error)
        } else {
          console.log('Email sent: ' + info.response)
        }
      })

      const creditsUsed = await client.user.update({
        where: {
          id: user.id,
        },
        data: {
          subscription: {
            update: {
              credits: { decrement: email.length },
            },
          },
        },
      })
      if (creditsUsed) {
        return { status: 200, message: 'Campaign emails sent' }
      }
    }
  } catch (error) {
    console.log(error)
  }
}

export const onGetAllCustomerResponses = async (id: string) => {
  try {
    const user = await getCurrentUser()
    if (!user) return null

    const { db } = await import('@/lib/mongodb').then(m => m.connectToDatabase())
    const { collections } = await import('@/lib/models')

    const domains = await db.collection(collections.domains).find({ userId: user.id }).toArray()
    const domainIds = domains.map((d: any) => d.id)
    const customers = await db.collection(collections.customers).find({ domainId: { $in: domainIds } }).toArray()
    const customerIds = customers.map((c: any) => c.id)

    const responses = await db.collection(collections.customerResponses).find({
      customerId: id,
      answered: { $exists: true, $ne: null },
    }).toArray()

    return [{ customer: [{ questions: responses.map((r: any) => ({ question: r.question as string, answered: (r.answered ?? null) as string | null })) }] }]
  } catch (error) {
    console.log(error)
  }
}


export const onGetEmailTemplate = async (id: string) => {
  try {
    const template = await client.campaign.findUnique({
      where: {
        id,
      },
      select: {
        template: true,
      },
    });

    if (template) {
      return template.template;
    }
  } catch (error) {
    console.log(error);
  }
};
