'use client'
import { useToast } from '@/components/ui/use-toast'
import {
  UserRegistrationProps,
  UserRegistrationSchema,
} from '@/schemas/auth.schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

export const useSignUpForm = () => {
  const { toast } = useToast()
  const [loading, setLoading] = useState<boolean>(false)
  const router = useRouter()
  const methods = useForm<UserRegistrationProps>({
    resolver: zodResolver(UserRegistrationSchema),
    defaultValues: {
      type: 'owner',
    },
    mode: 'onChange',
  })

  const onGenerateOTP = async (
    email: string,
    password: string,
    onNext: React.Dispatch<React.SetStateAction<number>>
  ) => {
    // For simplicity, skip OTP verification in JWT implementation
    onNext((prev) => prev + 1)
  }

  const onHandleSubmit = methods.handleSubmit(
    async (values: UserRegistrationProps) => {
      try {
        setLoading(true)
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        })

        const data = await response.json()

        if (response.ok) {
          toast({
            title: 'Success',
            description: 'Account created successfully!',
          })
          router.push('/dashboard')
        } else {
          toast({
            title: 'Error',
            description: data.error || 'Registration failed',
          })
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Something went wrong',
        })
      } finally {
        setLoading(false)
      }
    }
  )
  
  return {
    methods,
    onHandleSubmit,
    onGenerateOTP,
    loading,
  }
}
