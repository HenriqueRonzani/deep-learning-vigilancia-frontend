import type { Inspection } from '../types/inspection'

export function normalizeAddress(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
    .replace(/\s+/g, ' ')
}
export function filterInspections(
  items: Inspection[],
  filters: {
    search: string
    address: string
    exact: boolean
    type: string
    status: string
    scope: string
  },
) {
  const address = normalizeAddress(filters.address)
  const query = normalizeAddress(filters.search)
  return items
    .filter((item) => {
      if (filters.scope === 'queue' && !['queued', 'processing'].includes(item.status)) return false
      if (filters.scope === 'completed' && item.status !== 'completed') return false
      if (filters.status !== 'all' && item.status !== filters.status) return false
      if (filters.type !== 'all' && item.type !== filters.type) return false
      if (!normalizeAddress(`${item.id} ${item.name}`).includes(query)) return false
      const target = normalizeAddress(item.address)
      return !address || (filters.exact ? target === address : target.includes(address))
    })
    .sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at) || b.id - a.id)
}
