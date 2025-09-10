import { useToast } from '@/components/ui/use-toast'
import { UserLoginProps, UserLoginSchema } from '@/schemas/auth.schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

export const useSignInForm = () => {
  const [loading, setLoading] = useState<boolean>(false)
  const router = useRouter()
  const { toast } = useToast()
  const methods = useForm<UserLoginProps>({
    resolver: zodResolver(UserLoginSchema),
    mode: 'onChange',
  })
  
  const onHandleSubmit = methods.handleSubmit(
    async (values: UserLoginProps) => {
      try {
        setLoading(true)
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        })

        const data = await response.json()

        if (response.ok) {
          toast({
            title: 'Success',
            description: 'Welcome back!',
          })
          router.push('/dashboard')
        } else {
          toast({
            title: 'Error',
            description: data.error || 'Login failed',
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
    loading,
  }
}
