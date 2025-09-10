'use server'

import { getCurrentUser } from '@/lib/auth'
import { onGetAllAccountDomains } from '../settings'
import { redirect } from 'next/navigation'

export const onLoginUser = async () => {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/auth/sign-in')
  } else {
    try {
      const domains = await onGetAllAccountDomains()
      return { status: 200, user, domain: domains?.domains }
    } catch (error) {
      return { status: 400 }
    }
  }
}
