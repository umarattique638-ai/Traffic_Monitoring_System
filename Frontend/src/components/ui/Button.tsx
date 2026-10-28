import type { ButtonHTMLAttributes } from 'react'
import Spinner from './Spinner'
import { buttonVariants, type Variant } from './buttonVariants'

type Size = 'sm' | 'md'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const base =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition ' +
  'focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60'

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-[15px]',
}

/**
 * The one button. `type` defaults to "button" so a button inside a form never submits by accident;
 * pass type="submit" for the form's main action.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`${base} ${sizes[size]} ${buttonVariants[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}
