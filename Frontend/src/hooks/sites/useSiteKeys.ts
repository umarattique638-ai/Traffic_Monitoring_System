import { useState } from 'react'
import { useCreateKeyMutation, useRevokeKeyMutation } from '../../features/sites/sitesApi'
import type { Site, SiteKey } from '../../types/tailwatch'
import { notify } from '../../utils/notify'

/**
 * Site keys: add a new one (put the new snippet on the site), then revoke the old one. The last active key
 * cannot be revoked (the server refuses it). Revoking waits for a confirmation, since it stops counting.
 */
export function useSiteKeys(site: Site) {
  const [create, { isLoading: creating }] = useCreateKeyMutation()
  const [revoke, { isLoading: revoking }] = useRevokeKeyMutation()
  const [toRevoke, setToRevoke] = useState<SiteKey | null>(null)
  const active = site.keys.filter((k) => k.status === 'active')

  const addKey = async () => {
    try {
      const res = await create(site.id).unwrap()
      notify.success('New key added', { description: res.message })
    } catch (e) {
      notify.error(e, 'Could not add a key.')
    }
  }

  const confirmRevoke = async () => {
    if (!toRevoke) return
    try {
      await revoke({ id: site.id, keyId: toRevoke.id }).unwrap()
      notify.success('Key revoked', { description: 'Hits sent with it are no longer counted.' })
    } catch (e) {
      notify.error(e, 'Could not revoke the key.')
    } finally {
      setToRevoke(null)
    }
  }

  return {
    active,
    addKey,
    creating,
    toRevoke,
    askRevoke: setToRevoke,
    cancelRevoke: () => setToRevoke(null),
    confirmRevoke,
    revoking,
  }
}
