import { useState, type ReactNode } from 'react'
import {
  useForm,
  type FieldValues,
  type Path,
  type RegisterOptions,
  type SubmitHandler,
  type DefaultValues,
  Controller,
} from 'react-hook-form'
import { LuEye, LuEyeOff } from 'react-icons/lu'
import OtpInput from './OtpInput'

export type Field<T extends FieldValues> = {
  name: Path<T>
  label?: string
  otpLength?: number
  type?: string
  placeholder?: string
  autoComplete?: string
  labelRight?: ReactNode
  rules?: RegisterOptions<T, Path<T>>
}

type FormProps<T extends FieldValues> = {
  fields: Field<T>[]
  onSubmit: SubmitHandler<T>
  defaultValues?: DefaultValues<T>
  submitText?: string
  title?: string
  subtitle?: string
  footer?: ReactNode
  loading?: boolean
}

function Form<T extends FieldValues>({
  fields,
  onSubmit,
  defaultValues,
  submitText = 'Submit',

  title,
  subtitle,
  footer,
  loading = false,
}: FormProps<T>) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<T>({ defaultValues })

  // Kaunsa password field dikh raha hai
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({})

  return (
    // Card
    <div className='w-full max-w-sm sm:max-w-md rounded-2xl bg-white p-5 sm:p-8 lg:p-10 shadow-xl'>
      {title && <h2 className='text-xl sm:text-2xl font-bold text-gray-900'>{title}</h2>}
      {subtitle && <p className='mt-1 text-xs sm:text-sm text-gray-500'>{subtitle}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className='mt-5 sm:mt-8 flex flex-col gap-3 sm:gap-5'>
        {fields.map((field) => {
          const error = errors[field.name]
          const isPassword = field.type === 'password'
          const visible = showPassword[field.name]

          // OTP fields are drawn as one box per digit
          if (field.type === 'otp') {
            const len = field.otpLength ?? 6
            return (
              <div key={field.name}>
                {field.label && (
                  <label
                    htmlFor={field.name}
                    className='mb-1 sm:mb-1.5 block text-xs sm:text-sm font-medium text-gray-700'
                  >
                    {field.label}
                  </label>
                )}
                <Controller
                  name={field.name}
                  control={control}
                  rules={{
                    ...field.rules,
                    validate: (v) => String(v ?? '').length === len || `Enter all ${len} digits`,
                  }}
                  render={({ field: f }) => (
                    <OtpInput
                      id={field.name}
                      length={len}
                      value={String(f.value ?? '')}
                      onChange={f.onChange}
                      onBlur={f.onBlur}
                      invalid={!!error}
                    />
                  )}
                />
                {error && (
                  <span className='mt-1 block text-[11px] sm:text-xs text-red-500'>
                    {(error.message as string) || 'This field is required'}
                  </span>
                )}
              </div>
            )
          }
          return (
            <div key={field.name}>
              {(field.label || field.labelRight) && (
                <div className='mb-1 sm:mb-1.5 flex items-center justify-between'>
                  {field.label && (
                    <label htmlFor={field.name} className='text-xs sm:text-sm font-medium text-gray-700'>
                      {field.label}
                    </label>
                  )}
                  {field.labelRight}
                </div>
              )}

              <div className='relative'>
                <input
                  id={field.name}
                  type={isPassword && visible ? 'text' : (field.type ?? 'text')}
                  placeholder={field.placeholder}
                  autoComplete={field.autoComplete ?? 'off'}
                  className='w-full rounded-lg border border-gray-300 px-3 py-2 sm:px-4 sm:py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20'
                  {...register(field.name, field.rules)}
                />

                {isPassword && (
                  <button
                    type='button'
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => ({ ...prev, [field.name]: !prev[field.name] }))}
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer'
                  >
                    {visible ? <LuEyeOff /> : <LuEye />}
                  </button>
                )}
              </div>

              {error && (
                <span className='mt-1 block text-[11px] sm:text-xs text-red-500'>
                  {(error.message as string) || 'This field is required'}
                </span>
              )}
            </div>
          )
        })}

        <button
          type='submit'
          disabled={loading}
          className='mt-1 w-full rounded-lg bg-teal-700 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white hover:bg-teal-800 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60'
        >
          {loading ? 'Please wait...' : submitText}
        </button>
      </form>

      {footer && <div className='mt-4 sm:mt-6 text-center text-xs sm:text-sm text-gray-500'>{footer}</div>}
    </div>
  )
}

export default Form
