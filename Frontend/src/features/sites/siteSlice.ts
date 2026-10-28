import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RangeKey } from '../../types/tailwatch'

const LAST_SITE = 'tw_last_site'
const RANGE = 'tw_range'

const isRange = (v: unknown): v is RangeKey => v === 'today' || v === '7d' || v === '30d'

// Browser storage can be blocked (private mode): then the choice simply lasts until reload.
function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}
function write(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) storage().removeItem(key)
    else storage().setItem(key, value)
  } catch {
    // storage blocked
  }
}

function rememberedSite(): number | null {
  const v = Number(read(() => localStorage, LAST_SITE))
  return Number.isSafeInteger(v) && v > 0 ? v : null
}

function rememberedRange(): RangeKey {
  const v = read(() => sessionStorage, RANGE)
  return isRange(v) ? v : '7d'
}

/**
 * What the user is looking at: the selected site (remembered on this device) and the period of the report
 * pages (remembered for this tab). The sites themselves always come from the API.
 */
export interface SiteState {
  selectedId: number | null
  range: RangeKey
}

const initialState: SiteState = { selectedId: rememberedSite(), range: rememberedRange() }

const siteSlice = createSlice({
  name: 'site',
  initialState,
  reducers: {
    selectSite(state, action: PayloadAction<number | null>) {
      state.selectedId = action.payload
    },
    setRange(state, action: PayloadAction<RangeKey>) {
      state.range = action.payload
    },
  },
})

/** Saves the choices (called by the store on every change; reducers stay pure). */
export function persistSiteState(state: SiteState) {
  write(() => localStorage, LAST_SITE, state.selectedId ? String(state.selectedId) : null)
  write(() => sessionStorage, RANGE, state.range)
}

export const { selectSite, setRange } = siteSlice.actions
export default siteSlice.reducer
