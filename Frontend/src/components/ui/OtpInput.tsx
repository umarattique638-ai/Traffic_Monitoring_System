import React, { useRef } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  length?: number
  invalid?: boolean
  id?: string
}

/** OTP: har box mein ek hi number. Khud aage barhta hai, Backspace pichle box par, paste se sab bhar jate hain. */
function OtpInput({ value, onChange, onBlur, length = 6, invalid, id }: Props) {
  const boxes = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const focus = (i: number) => boxes.current[Math.max(0, Math.min(length - 1, i))]?.focus()

  const setAt = (i: number, d: string) => {
    const next = digits.slice()
    next[i] = d
    onChange(next.join('').slice(0, length))
  }

  const onType = (i: number, raw: string) => {
    const only = raw.replace(/\D/g, '')
    if (!only) return
    if (only.length > 1) {
      // Kai numbers ek saath (paste, ya phone ka SMS auto-fill): is box se aage bhar do
      const next = digits.slice()
      only.split('').forEach((d, k) => {
        if (i + k < length) next[i + k] = d
      })
      onChange(next.join('').slice(0, length))
      focus(i + only.length)
      return
    }
    setAt(i, only)
    focus(i + 1)
  }

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) setAt(i, '')
      else if (i > 0) {
        setAt(i - 1, '')
        focus(i - 1)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focus(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focus(i + 1)
    }
  }

  return (
    <div className='flex justify-between gap-2 sm:gap-3' onBlur={onBlur}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el
          }}
          id={i === 0 ? id : undefined}
          value={d}
          onChange={(e) => onType(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onFocus={(e) => e.target.select()}
          onPaste={(e) => {
            e.preventDefault()
            onType(i, e.clipboardData.getData('text'))
          }}
          inputMode='numeric'
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          aria-label={`Digit ${i + 1} of ${length}`}
          className={`h-12 w-full min-w-0 rounded-lg border bg-white text-center text-xl font-semibold text-slate-900 tabular-nums transition focus:outline-none focus:ring-4 sm:h-14 dark:bg-slate-900 dark:text-slate-100 ${
            invalid
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15'
              : 'border-slate-300 hover:border-slate-400 focus:border-teal-600 focus:ring-teal-600/15 dark:border-slate-700 dark:focus:border-teal-400 dark:focus:ring-teal-400/15'
          }`}
        />
      ))}
    </div>
  )
}

export default OtpInput
