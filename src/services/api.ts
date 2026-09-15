const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
async function request(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${base}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  if (!response.ok)
    throw new Error(`Não foi possível concluir a operação (HTTP ${response.status}).`)
  return response.status === 204 ? null : response.json()
}
export const api = {
  list: () => request('/inspections'),
  detail: (id: number) => request(`/inspections/${id}`),
  status: (id: number) => request(`/inspections/${id}/status`),
  create: (payload: unknown) =>
    request('/inspections', { method: 'POST', body: JSON.stringify(payload) }),
  uploadUrls: (id: number, payload: unknown) =>
    request(`/inspections/${id}/batch-upload-urls`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  process: (id: number) => request(`/inspections/${id}/process`, { method: 'POST' }),
  feedback: (payload: unknown) =>
    request('/files/report/feedback', { method: 'PATCH', body: JSON.stringify(payload) }),
}
export async function uploadToSignedUrl(
  url: string,
  file: File,
  headers: Record<string, string> = {},
) {
  if (new URL(url).protocol !== 'https:') throw new Error('O upload requer uma URL HTTPS assinada.')
  const response = await fetch(url, {
    method: 'PUT',
    body: file,
    credentials: 'omit',
    headers: { 'Content-Type': file.type, ...headers },
  })
  if (!response.ok) throw new Error(`Falha no upload de ${file.name}.`)
}
