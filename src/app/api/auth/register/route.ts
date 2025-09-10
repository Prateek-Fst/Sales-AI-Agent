import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { client } from '@/lib/prisma'
import { signToken } from '@/lib/jwt'

export async function POST(request: NextRequest) {
  try {
    const { fullname, email, password, type } = await request.json()

    const existingUser = await client.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await client.user.create({
      data: {
        fullname,
        email,
        password: hashedPassword,
        type,
        subscription: {
          create: {},
        },
      },
      select: {
        id: true,
        fullname: true,
        email: true,
        type: true,
      },
    })

    const token = signToken({ userId: user.id, email: user.email })

    const response = NextResponse.json({ user })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}