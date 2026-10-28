import { useCallback, useEffect, useRef, useState } from 'react'
import { useVerifySetupMutation } from '../../features/setup/setupApi'
import type { Setup, Site, VerifyResult } from '../../types/tailwatch'
import type { Step } from '../../components/onboarding/CheckList'
import { errorMessage } from '../../utils/apiError'

/** Pause between two steps turning green: quick, but slow enough to follow. */
const STEP_MS = 380
/** After the last step turns green: long enough to see it, then the dashboard opens. */
const DONE_MS = 900

/** The verifier's steps, in the order the backend runs them (backend/src/services/verifier.service.ts CHECK_ORDER). */
export const CHECKS: { id: string; label: string }[] = [
  { id: 'reach', label: 'Site reachable' },
  { id: 'present', label: 'Snippet in page source' },
  { id: 'noscript', label: 'Not in noscript or a comment' },
  { id: 'once', label: 'Only one snippet' },
  { id: 'script', label: 'Script loads' },
  { id: 'csp', label: 'Content-Security-Policy allows it' },
  { id: 'id', label: 'Site key matches' },
]

/**
 * Setup step 3, "Verify". The server opens the page like a visitor and runs 7 checks; the first failing step
 * stops the check. When every step passes the server saves the site and returns it. The check starts by itself
 * once, and again on "Check again". Results are revealed one step at a time.
 */
export function useInstallCheck(setup: Setup | null, onSaved: (site: Site) => void) {
  const [verify, { isLoading: running }] = useVerifySetupMutation()
  const [url, setUrl] = useState(setup ? `https://${setup.domain}/` : '')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [saved, setSaved] = useState<Site | null>(null)
  const [shown, setShown] = useState(0)
  const [checkError, setCheckError] = useState<string | null>(null)
  const started = useRef<string | null>(null)
  const onSite = useRef(onSaved)
  useEffect(() => {
    onSite.current = onSaved
  })

  const run = useCallback(
    async (target: string) => {
      setCheckError(null)
      setResult(null)
      setShown(0)
      try {
        const { data } = await verify({ url: target }).unwrap()
        setResult(data)
        if (data.site) setSaved(data.site)
      } catch (e) {
        setCheckError(errorMessage(e))
      }
    },
    [verify],
  )

  // The check starts by itself once per setup (a new setup on this page starts over).
  useEffect(() => {
    if (!setup || started.current === setup.publicKey) return
    started.current = setup.publicKey
    setUrl(`https://${setup.domain}/`)
    void run(`https://${setup.domain}/`)
  }, [setup, run])

  /** Index of the step the check stopped at (the first failure), or -1. Nothing after it is shown. */
  const stoppedAt = result ? result.checks.findIndex((c) => c.status === 'fail') : -1
  const lastShown = result ? (stoppedAt >= 0 ? stoppedAt + 1 : result.checks.length) : 0

  // Reveal the results one by one, up to the step that failed.
  useEffect(() => {
    if (!result || shown >= lastShown) return
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 150 : STEP_MS)
    return () => clearTimeout(t)
  }, [result, shown, lastShown])

  const revealed = !!result && shown >= lastShown
  const passed = revealed && !!result?.ok
  const failed = revealed && !result?.ok
  const allGood = passed && !!saved

  // Every step is green and the site is saved: a moment to see it, then hand it over.
  useEffect(() => {
    if (!allGood || !saved) return
    const t = setTimeout(() => onSite.current(saved), DONE_MS)
    return () => clearTimeout(t)
  }, [allGood, saved])

  const steps: Step[] = (failed ? CHECKS.slice(0, stoppedAt + 1) : CHECKS).map((c, i) => {
    const r = result?.checks.find((x) => x.id === c.id)
    if (r && i < shown) return { id: c.id, label: r.label, state: r.status, message: r.message }
    const isNext = (running && !result && i === 0) || (!!result && i === shown)
    return { id: c.id, label: c.label, state: isNext ? 'running' : 'waiting' }
  })
  const total = CHECKS.length
  const done = failed ? stoppedAt : steps.filter((s) => s.state === 'pass').length

  return {
    steps,
    total,
    stoppedAt: failed ? stoppedAt + 1 : null,
    progress: failed ? Math.max(stoppedAt, 0.5) / total : done / total,
    done,
    url,
    setUrl,
    run,
    running,
    checkError,
    allGood,
    failed,
  }
}
