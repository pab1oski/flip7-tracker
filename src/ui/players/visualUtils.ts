import { useId, useSyncExternalStore } from 'react'

/** Up to two uppercase initials from a display name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length === 1 ? [...words[0]].slice(0, 2) : [[...words[0]][0], [...words[1]][0]]
  return letters.join('').toUpperCase()
}

/** Medal class for the top three ranks. */
export function medalClass(rank: number | undefined): string {
  return rank === 1 ? ' gold' : rank === 2 ? ' silver' : rank === 3 ? ' bronze' : ''
}

/** SVG gradient ids must be plain identifiers; React ids may contain other characters. */
export function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
}

const query = '(prefers-reduced-motion: reduce)'
const subscribe = (cb: () => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(query)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const snapshot = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false)

/** True when the user asked the OS to reduce motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
