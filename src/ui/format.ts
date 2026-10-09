const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/** Formats integer cents as an es-ES EUR amount. */
export function formatCents(cents: number): string {
  return eur.format(cents / 100)
}

/** Parses a euro amount typed by the user ("1", "0,50", "2.5") into integer cents, or null if invalid. */
export function parseEurosToCents(input: string): number | null {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(input.trim())
  if (!m) return null
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
}
