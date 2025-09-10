'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { useAuthContextHook } from '@/context/use-auth-context'
import { useFormContext } from 'react-hook-form'
import TypeSelectionForm from './type-selection-form'
import { Spinner } from '@/components/spinner'

const LoadingSpinner = () => <Spinner noPadding={false} />

const DetailForm = dynamic(() => import('./account-details-form'), {
  ssr: false,
  loading: LoadingSpinner,
})

type Props = {}

const RegistrationFormStep = (props: Props) => {
  const {
    register,
    formState: { errors },
  } = useFormContext()
  const { currentStep } = useAuthContextHook()
  const [onUserType, setOnUserType] = useState<'owner' | 'student'>('owner')

  switch (currentStep) {
    case 1:
      return (
        <TypeSelectionForm
          register={register}
          userType={onUserType}
          setUserType={setOnUserType}
        />
      )
    case 2:
      return (
        <DetailForm
          errors={errors}
          register={register}
        />
      )
  }

  return <div>RegistrationFormStep</div>
}

export default RegistrationFormStep
