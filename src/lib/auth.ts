import { cookies } from 'next/headers'
import { verifyToken } from './jwt'
import { client } from './prisma'

export const getCurrentUser = async () => {
  const cookieStore = cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  const user = await client.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      fullname: true,
      email: true,
      type: true,
    },
  })

  return user
}