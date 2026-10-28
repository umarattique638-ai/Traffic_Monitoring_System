import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDeleteAccountMutation } from '../../features/account/accountApi'
import { notify } from '../../utils/notify'
import { useAction } from '../common/useAction'

const CONFIRM_WORD = 'DELETE'

/** "Delete account": the password and the word DELETE; then the session ends and Log in opens. */
export function useDeleteAccount() {
  const navigate = useNavigate()
  const [remove] = useDeleteAccountMutation()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const ready = password.length > 0 && confirm === CONFIRM_WORD

  const { run, busy, error, setError } = useAction(async () => {
    const { data } = await remove({ password, confirm }).unwrap()
    const { trackingStopped, finishesWithinDays } = data.erasure
    notify.success(`Account deleted. ${trackingStopped ? 'Tracking has stopped.' : 'Tracking stops within a day.'}`, {
      description: `Your data is being erased now. We e-mail you once we have confirmed nothing is left (within ${finishesWithinDays} days).`,
    })
    navigate('/login', { replace: true })
  }, 'The account could not be deleted.')

  const close = () => {
    setOpen(false)
    setPassword('')
    setConfirm('')
    setError(null)
  }

  return {
    open,
    start: () => setOpen(true),
    close,
    password,
    setPassword,
    confirm,
    setConfirm,
    ready,
    submit: run,
    busy,
    error,
  }
}
