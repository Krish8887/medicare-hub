import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

// Lazy, module-level singleton: created on first client-side access only,
// so SSR stays safe and we never rebuild the MediaQueryList per render.
let cachedMql: MediaQueryList | null = null

function getMql(): MediaQueryList {
  if (!cachedMql) cachedMql = window.matchMedia(MEDIA_QUERY)
  return cachedMql
}

function subscribe(onChange: () => void) {
  const mql = getMql()
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  // useSyncExternalStore subscribes to the external matchMedia system and
  // keeps React in sync without calling setState inside an effect body
  // (satisfies react-hooks/set-state-in-effect).
  return React.useSyncExternalStore(
    subscribe,
    () => getMql().matches,
    () => false
  )
}
