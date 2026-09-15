import type { Irregularity, ReportStatus } from '@/types/inspection'
export const statusLabels: Record<ReportStatus, string> = {
  queued: 'Na fila',
  processing: 'Em análise',
  completed: 'Finalizada',
  failed: 'Falhou',
}
export const categoryLabels: Record<Irregularity, string> = {
  open_water_tank: 'Caixa-d’água aberta',
  abandoned_pool: 'Possível piscina abandonada',
}
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
export const MAX_FILES = 20
export const MAX_FILE_SIZE = 50 * 1024 * 1024
export function validateFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type))
    return `${file.name}: formato não suportado.`
  if (file.size === 0) return `${file.name}: arquivo vazio.`
  if (file.size > MAX_FILE_SIZE) return `${file.name}: o limite é 50 MB por arquivo.`
  return null
}
