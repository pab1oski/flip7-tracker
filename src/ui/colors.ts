const PALETTE = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c', '#a3e635', '#e879f9']

/** One distinct color per player position in a game. */
export function playerColor(index: number): string {
  return PALETTE[index % PALETTE.length]
}

/**
 * Stable color per player profile, from a stable player ordering (see `playerOrder`
 * in domain/playerProfile). Unknown ids fall back to the accent color.
 */
export function profileColors(order: readonly string[]): (id: string) => string {
  const map = new Map(order.map((id, i) => [id, playerColor(i)]))
  return (id) => map.get(id) ?? '#ff8a3d'
}

/** Money colors for charts (mirror --win / --lose). */
export const moneyColors = { pos: '#34d399', neg: '#f87171' } as const

/** Chart colors (SVG attributes cannot use CSS variables reliably, so they live here). */
export const chartTheme = {
  grid: 'rgba(186, 214, 200, 0.13)',
  axis: '#8f9c94',
  zero: 'rgba(243, 238, 228, 0.45)',
  tooltipBg: '#15231f',
  tooltipBorder: 'rgba(186, 214, 200, 0.25)',
  tooltipText: '#f3eee4',
} as const

export const tooltipStyle = {
  background: chartTheme.tooltipBg,
  border: `1px solid ${chartTheme.tooltipBorder}`,
  borderRadius: 12,
  color: chartTheme.tooltipText,
  fontSize: 13,
  boxShadow: '0 8px 24px rgba(0,0,0,.35)',
} as const
