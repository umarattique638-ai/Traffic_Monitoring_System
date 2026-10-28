import type { ApiErrorBody } from '../types/api'

const API = import.meta.env.VITE_API_URL as string

/** Thrown when a download fails: same `data.error` shape as an RTK Query error, so errorMessage() reads it. */
export class DownloadError extends Error {
  readonly data: ApiErrorBody
  constructor(status: number, data: Partial<ApiErrorBody>) {
    const message = data.error?.message ?? `Download failed (${status}).`
    super(message)
    this.data = { success: false, error: { code: data.error?.code ?? 'download_failed', message } }
  }
}

async function get(path: string): Promise<Response> {
  return fetch(`${API}${path}`, { credentials: 'include' })
}

/** Saves a blob under `filename` through a temporary link. */
function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Downloads a file from the API (a saved CSV, the account export). The file is fetched first, so an error
 * is shown as a message instead of being saved as the file. An expired access token is refreshed once.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  let res: Response
  try {
    res = await get(path)
    if (res.status === 401) {
      const refreshed = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' })
      if (refreshed.ok) res = await get(path)
    }
  } catch {
    throw new DownloadError(0, {
      error: { code: 'network', message: 'Cannot reach the server. Is the backend running?' },
    })
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Partial<ApiErrorBody>
    throw new DownloadError(res.status, data)
  }
  const name = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName
  save(await res.blob(), name)
}
