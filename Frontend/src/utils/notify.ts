import { createElement } from 'react'
import { toast, type ToastOptions } from 'react-toastify'
import { errorMessage } from './apiError'

type Action = { label: string; onClick: () => void }
type Options = { description?: string; action?: Action }

// Title, an optional second line, and an optional button inside the toast.
function body(text: string, o: Options) {
  return createElement(
    'div',
    { className: 'grid gap-0.5' },
    createElement('p', { className: 'font-semibold text-slate-900' }, text),
    o.description ? createElement('p', { className: 'text-[13px] text-slate-600' }, o.description) : null,
    o.action
      ? createElement(
          'button',
          {
            type: 'button',
            onClick: o.action.onClick,
            className:
              'mt-1.5 w-fit rounded-md bg-teal-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-800',
          },
          o.action.label,
        )
      : null,
  )
}

const show = (kind: 'success' | 'info' | 'warning', text: string, o: Options, extra: ToastOptions = {}) =>
  toast[kind](body(text, o), extra)

/**
 * The one way to tell the user how an action went ("Report deleted.", "Could not save."): a toast that goes
 * away by itself. Problems the user must fix in a form stay next to the form instead.
 */
export const notify = {
  success: (text: string, o: Options = {}) => show('success', text, o),
  info: (text: string, o: Options = {}) => show('info', text, o),
  warning: (text: string, o: Options = {}) => show('warning', text, o, { autoClose: 10_000 }),
  /** `e` can be a caught RTK Query error: the backend's message is shown, or the fallback. */
  error: (e: unknown, fallback = 'Something went wrong. Try again.') => {
    const message = typeof e === 'string' ? e : errorMessage(e)
    toast.error(message === 'Something went wrong. Please try again.' ? fallback : message, { autoClose: 8_000 })
  },
}
