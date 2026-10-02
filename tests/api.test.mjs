import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  api,
  listAllInspections,
  normalizeInspection,
  submitInspection,
  SubmissionError,
} from '../src/services/api.ts'
import { filterInspections } from '../src/lib/inspection-query.ts'

const payload = {
  name: 'Sobrevoo',
  address: 'Rua São José, 10, Centro',
  type: 'active',
  dengue_breeding_site_spotted: true,
}
const dto = (id, extra = {}) => ({
  ...payload,
  id,
  status: 'completed',
  requested_at: '2026-10-01T12:00:00Z',
  ...extra,
})
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })

test('consulta todas as páginas antes de filtrar endereços e não confunde número 10 com 100', async (t) => {
  const paths = []
  t.mock.method(globalThis, 'fetch', async (path) => {
    paths.push(path)
    return json(
      path.endsWith('page=1')
        ? {
            data: [dto(1, { address: 'Rua São José, 100, Centro' })],
            current_page: 1,
            last_page: 2,
            total: 2,
          }
        : { data: [dto(2)], current_page: 2, last_page: 2, total: 2 },
    )
  })
  const items = (await listAllInspections()).map(normalizeInspection)
  const filters = {
    search: '',
    address: '  RUA SAO JOSE,  10, CENTRO ',
    exact: true,
    type: 'all',
    status: 'all',
    scope: 'all',
  }
  assert.deepEqual(
    filterInspections(items, filters).map((i) => i.id),
    [2],
  )
  assert.equal(
    filterInspections(items, { ...filters, address: 'São José', exact: false }).length,
    2,
  )
  assert.equal(filterInspections(items, { ...filters, type: 'report' }).length, 0)
  assert.deepEqual(paths, ['/api/inspections?page=1', '/api/inspections?page=2'])
})

test('falha na segunda página não retorna lista incompleta como resultado válido', async (t) => {
  t.mock.method(globalThis, 'fetch', async (path) =>
    path.endsWith('page=1')
      ? json({ data: [dto(1)], current_page: 1, last_page: 2 })
      : json({ message: 'Indisponível' }, 503),
  )
  await assert.rejects(listAllInspections(), /Indisponível/)
})

test('normaliza múltiplos relatórios sem inventar URL de leitura ou tamanho', () => {
  const item = normalizeInspection(
    dto(2, {
      dengue_breeding_site_spotted: 0,
      files: [
        {
          id: 12,
          name: 'foto.jpg',
          path: 'private/foto.jpg',
          mime_type: 'image/jpeg',
          file_reports: [
            {
              id: 1,
              file_id: 12,
              irregularity: 'open_water_tank',
              status: 'created',
              agent_report: 'A',
              user_feedback: null,
            },
            {
              id: 2,
              file_id: 12,
              irregularity: 'abandoned_pool',
              status: 'created',
              agent_report: 'B',
              user_feedback: 'incorrect',
            },
          ],
        },
      ],
    }),
  )
  assert.equal(item.dengue_breeding_site_spotted, false)
  assert.equal(item.filesLoaded, true)
  assert.equal(item.files[0].id, '12')
  assert.equal(item.files[0].url, null)
  assert.equal(item.files[0].size, null)
  assert.equal(item.files[0].file_reports.length, 2)
  assert.equal(normalizeInspection(dto(2)).filesLoaded, false)
})

test('envio respeita URLs por ref_id, cabeçalhos assinados e payload do processamento', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const path = String(url)
    calls.push({ path, ...options })
    if (path === '/api/inspections') return json(dto(9, { status: 'draft' }), 201)
    if (path.endsWith('/batch-upload-urls'))
      return json({
        urls: [1, 0].map((i) => ({
          ref_id: String(i),
          path: `raw/${i}.png`,
          upload_url: {
            url: `https://storage.example/${i}`,
            headers: {
              Host: 'storage.example',
              'Content-Type': ['image/png'],
              'x-amz-meta-test': 'signed',
            },
          },
        })),
      })
    if (path.startsWith('https:')) return new Response(null, { status: 200 })
    if (path.endsWith('/process'))
      return json({ inspection: dto(9, { status: 'queued' }), files: [] })
    throw new Error(`Unexpected ${path}`)
  })
  const files = [
    new File(['A'], 'a.png', { type: 'image/png' }),
    new File(['B'], 'b.png', { type: 'image/png' }),
  ]
  const result = await submitInspection(payload, files, () => {})
  assert.equal(result.status, 'queued')
  assert.deepEqual(JSON.parse(calls[0].body), payload)
  assert.deepEqual(JSON.parse(calls[1].body), {
    files: [
      { ref_id: '0', filename: 'a.png' },
      { ref_id: '1', filename: 'b.png' },
    ],
  })
  assert.equal(calls[2].path, 'https://storage.example/0')
  assert.equal(calls[2].method, 'PUT')
  assert.equal(calls[2].body, files[0])
  assert.equal(calls[2].credentials, 'omit')
  assert.deepEqual(calls[2].headers, { 'Content-Type': 'image/png', 'x-amz-meta-test': 'signed' })
  assert.deepEqual(JSON.parse(calls[4].body), {
    files: [
      { name: 'a.png', path: 'raw/0.png', mime_type: 'image/png' },
      { name: 'b.png', path: 'raw/1.png', mime_type: 'image/png' },
    ],
  })
})

test('upload falho preserva identificador do rascunho e nunca solicita processamento', async (t) => {
  let processed = false
  t.mock.method(globalThis, 'fetch', async (url) => {
    const path = String(url)
    if (path === '/api/inspections') return json(dto(9, { status: 'draft' }))
    if (path.endsWith('/batch-upload-urls'))
      return json({
        urls: [
          {
            ref_id: '0',
            path: 'raw/a',
            upload_url: { url: 'https://storage.example/a', headers: {} },
          },
        ],
      })
    if (path.endsWith('/process')) processed = true
    return new Response(null, { status: 403 })
  })
  await assert.rejects(
    submitInspection(payload, [new File(['A'], 'a.png', { type: 'image/png' })], () => {}),
    (error) => error instanceof SubmissionError && error.inspectionId === 9,
  )
  assert.equal(processed, false)
})

test('feedback usa PATCH no relatório e preserva erro de validação Laravel', async (t) => {
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, '/api/file-report/42/feedback')
    assert.equal(options.method, 'PATCH')
    assert.deepEqual(JSON.parse(options.body), { feedback: 'incorrect' })
    return json({ errors: { feedback: ['Feedback inválido'] } }, 422)
  })
  await assert.rejects(
    api.feedback(42, 'incorrect'),
    (error) => error.status === 422 && error.message === 'Feedback inválido',
  )
})

test('validação de cadastro permite corrigir e reenviar sem bloquear como rascunho existente', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    json({ errors: { address: ['Endereço obrigatório'] } }, 422),
  )
  await assert.rejects(
    submitInspection(payload, [], () => {}),
    (error) => error.status === 422 && !(error instanceof SubmissionError),
  )
})

test('resposta perdida no processamento não repete a solicitação e informa o rascunho', async (t) => {
  let attempts = 0
  t.mock.method(globalThis, 'fetch', async (url) => {
    const path = String(url)
    if (path === '/api/inspections') return json(dto(9, { status: 'draft' }))
    if (path.endsWith('/batch-upload-urls'))
      return json({
        urls: [
          {
            ref_id: '0',
            path: 'raw/a',
            upload_url: { url: 'https://storage.example/a', headers: {} },
          },
        ],
      })
    if (path.endsWith('/process')) {
      attempts++
      throw new Error('Connection lost')
    }
    return new Response(null, { status: 200 })
  })
  await assert.rejects(
    submitInspection(payload, [new File(['A'], 'a.png', { type: 'image/png' })], () => {}),
    (error) => error instanceof SubmissionError && error.inspectionId === 9,
  )
  assert.equal(attempts, 1)
})
