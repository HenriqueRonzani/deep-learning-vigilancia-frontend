import type {
  CreateInspection,
  Feedback,
  Inspection,
  InspectionFile,
  FileReport,
  InspectionStatus,
} from '../types/inspection'

export const apiMode = import.meta.env?.VITE_DATA_MODE === 'api'
const base = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
export interface InspectionDTO extends CreateInspection {
  id: number
  status: InspectionStatus
  requested_at: string
  files?: (Omit<InspectionFile, 'id' | 'size' | 'url' | 'file_reports'> & {
    id: number
    size?: number
    url?: string
    file_reports?: FileReport[]
  })[]
}
interface Page {
  data: InspectionDTO[]
  current_page: number
  last_page: number
  total: number
}
export interface SignedUpload {
  ref_id: string
  path: string
  upload_url: { url: string; headers: Record<string, string | string[]> }
}
export function normalizeInspection(dto: InspectionDTO): Inspection {
  return {
    ...dto,
    dengue_breeding_site_spotted:
      dto.dengue_breeding_site_spotted === true || Number(dto.dengue_breeding_site_spotted) === 1,
    filesLoaded: Array.isArray(dto.files),
    files: (dto.files || []).map((file) => ({
      ...file,
      id: String(file.id),
      size: file.size ?? null,
      url: file.url && /^https?:\/\//i.test(file.url) ? file.url : null,
      file_reports: (file.file_reports || []).map((report) => ({
        ...report,
        file_id: String(report.file_id),
      })),
    })),
  }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(30000),
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError(
      'Não foi possível confirmar a resposta do servidor. Verifique a conexão antes de tentar novamente.',
      0,
    )
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const validation = data?.errors ? Object.values(data.errors).flat().join(' ') : ''
    throw new ApiError(
      validation || data?.message || `Falha na operação (HTTP ${response.status}).`,
      response.status,
    )
  }
  if (!data && response.status !== 204)
    throw new ApiError('Resposta inválida da API.', response.status)
  return data as T
}
export const api = {
  list: (page = 1) => request<Page>(`/inspections?page=${page}`),
  detail: (id: number) => request<InspectionDTO>(`/inspections/${id}`),
  status: (id: number) => request<{ status: InspectionStatus }>(`/inspections/${id}/status`),
  create: (payload: CreateInspection) =>
    request<InspectionDTO>('/inspections', { method: 'POST', body: JSON.stringify(payload) }),
  uploadUrls: (id: number, files: { ref_id: string; filename: string }[]) =>
    request<{ urls: SignedUpload[] }>(`/inspections/${id}/batch-upload-urls`, {
      method: 'POST',
      body: JSON.stringify({ files }),
    }),
  process: (id: number, files: { name: string; path: string; mime_type: string }[]) =>
    request<{ inspection: InspectionDTO; files: NonNullable<InspectionDTO['files']> }>(
      `/inspections/${id}/process`,
      { method: 'POST', body: JSON.stringify({ files }) },
    ),
  feedback: (id: number, value: Feedback) =>
    request<FileReport>(`/file-report/${id}/feedback`, {
      method: 'PATCH',
      body: JSON.stringify({ feedback: value }),
    }),
}
export async function listAllInspections() {
  const results: InspectionDTO[] = []
  for (let page = 1; page <= 200; page++) {
    const response = await api.list(page)
    if (
      !Array.isArray(response.data) ||
      response.current_page !== page ||
      !Number.isInteger(response.last_page)
    )
      throw new Error('Paginação inválida recebida da API.')
    results.push(...response.data)
    if (page >= response.last_page)
      return [...new Map(results.map((item) => [item.id, item])).values()]
  }
  throw new Error(
    'A listagem excedeu o limite de 200 páginas. É necessário implementar filtros no servidor para este volume.',
  )
}
export async function uploadToSignedUrl(signed: SignedUpload['upload_url'], file: File) {
  const url = new URL(signed.url)
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  )
    throw new Error('URL de upload insegura. Use HTTPS ou armazenamento local em localhost.')
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(signed.headers || {})) {
    if (!['host', 'content-length'].includes(name.toLowerCase()))
      headers[name] = Array.isArray(value) ? value.join(', ') : value
  }
  const response = await fetch(url, {
    method: 'PUT',
    body: file,
    credentials: 'omit',
    headers,
    signal: AbortSignal.timeout(120000),
  })
  if (!response.ok) throw new Error(`Falha no upload de ${file.name} (HTTP ${response.status}).`)
}

export class SubmissionError extends Error {
  inspectionId: number | null
  constructor(message: string, inspectionId: number | null) {
    super(message)
    this.inspectionId = inspectionId
  }
}
export async function submitInspection(
  payload: CreateInspection,
  files: File[],
  progress: (text: string) => void,
): Promise<InspectionDTO> {
  let id: number | null = null
  try {
    progress('Criando rascunho…')
    const draft = await api.create(payload)
    id = draft.id
    progress('Preparando envio dos arquivos…')
    const { urls } = await api.uploadUrls(
      id,
      files.map((file, index) => ({ ref_id: String(index), filename: file.name })),
    )
    if (
      !Array.isArray(urls) ||
      urls.length !== files.length ||
      new Set(urls.map((u) => u.ref_id)).size !== files.length
    )
      throw new Error('O servidor não retornou uma URL única para cada arquivo.')
    const uploaded: { name: string; path: string; mime_type: string }[] = []
    for (const [index, file] of files.entries()) {
      const signed = urls.find((item) => item.ref_id === String(index))
      if (!signed?.path || !signed.upload_url?.url)
        throw new Error(`URL de envio ausente para ${file.name}.`)
      progress(`Enviando arquivo ${index + 1} de ${files.length}…`)
      await uploadToSignedUrl(signed.upload_url, file)
      uploaded.push({ name: file.name, path: signed.path, mime_type: file.type })
    }
    progress('Solicitando processamento…')
    const result = await api.process(id, uploaded)
    return { ...result.inspection, files: result.files }
  } catch (error) {
    // A rejected draft is safe to correct and resubmit; ambiguous network failures are not.
    if (id === null && error instanceof ApiError && error.status === 422) throw error
    throw new SubmissionError(
      `${error instanceof Error ? error.message : 'Falha no envio.'} ${id ? `A solicitação #${id} já foi criada. Confira seu estado antes de um novo envio.` : 'Se houve falha de conexão, confira a listagem antes de reenviar.'}`,
      id,
    )
  }
}
