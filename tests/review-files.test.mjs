import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reviewFiles } from '../src/lib/review-files.ts'

const files = [
  { id: '1', file_reports: [] },
  { id: '2', file_reports: [{ irregularity: null }] },
  { id: '3', file_reports: [{ irregularity: 'abandoned_pool', user_feedback: 'incorrect' }] },
  { id: '4', file_reports: [{ irregularity: null }, { irregularity: 'open_water_tank' }] },
]

test('resultados concluídos exibem sinalizações sem apagar os arquivos nem depender do feedback', () => {
  assert.deepEqual(
    reviewFiles({ status: 'completed', files }).map((f) => f.id),
    ['3', '4'],
  )
  assert.equal(files.length, 4)
})

test('ausência de relatório não oculta arquivos pendentes ou com falha', () => {
  for (const status of ['draft', 'queued', 'processing', 'failed']) {
    assert.equal(reviewFiles({ status, files }), files)
  }
})

test('conclusão sem sinalização permite estado vazio e nova seleção válida', () => {
  assert.deepEqual(reviewFiles({ status: 'completed', files: files.slice(0, 2) }), [])
  const pending = reviewFiles({ status: 'processing', files })
  const completed = reviewFiles({ status: 'completed', files })
  assert.equal(pending[0].id, '1')
  assert.equal(
    completed.some((f) => f.id === pending[0].id),
    false,
  )
  assert.equal(completed[0].id, '3')
})
