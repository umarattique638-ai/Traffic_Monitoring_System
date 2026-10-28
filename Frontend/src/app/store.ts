import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import authReducer from '../features/auth/authSlice'
import siteReducer, { persistSiteState } from '../features/sites/siteSlice'
import { baseApi } from '../services/baseApi'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    site: siteReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
})

// Remember the selected site and period whenever they change.
let lastSite = store.getState().site
store.subscribe(() => {
  const site = store.getState().site
  if (site !== lastSite) {
    lastSite = site
    persistSiteState(site)
  }
})

// Lets RTK Query know when the tab is focused or back online (polling pauses in a hidden tab).
setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
