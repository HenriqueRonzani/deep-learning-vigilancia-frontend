import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { validateFile, MAX_FILE_SIZE } from '../src/lib/format.ts'
import { useInspectionsStore } from '../src/stores/inspections.ts'

test('validacao distingue formatos, arquivos vazios e limite de tamanho', () => {
  assert.equal(validateFile({ name: 'foto.jpg', type: 'image/jpeg', size: MAX_FILE_SIZE }), null)
  assert.equal(validateFile({ name: 'video.mp4', type: 'video/mp4', size: 100 }), null)
  assert.match(
    validateFile({ name: 'grande.png', type: 'image/png', size: MAX_FILE_SIZE + 1 }),
    /50 MB/,
  )
  assert.match(validateFile({ name: 'vazio.png', type: 'image/png', size: 0 }), /vazio/)
  assert.match(validateFile({ name: 'nao-imagem.jpg', type: 'text/plain', size: 10 }), /formato/)
})

test('solicitacao percorre fila e processamento antes do relatorio e feedback por arquivo', () => {
  setActivePinia(createPinia())
  const store = useInspectionsStore()
  const record = store.create('  Teste de vistoria  ', [
    new File(['imagem'], 'teste.png', { type: 'image/png' }),
    new File(['outra'], 'outra.png', { type: 'image/png' }),
  ])
  const item = store.inspections.find((i) => i.id === record.id)
  assert.equal(item.name, 'Teste de vistoria')
  assert.equal(item.status, 'queued')
  assert.equal(item.files[0].report, null)
  store.tick(item.beginsAt - 1)
  assert.equal(item.status, 'queued')
  store.tick(item.beginsAt)
  assert.equal(item.status, 'processing')
  assert.equal(item.files[0].report, null)
  store.tick(item.finishesAt)
  assert.equal(item.status, 'completed')
  assert.equal(item.files[0].report.status, 'completed')
  store.feedback(item.id, item.files[0].id, 'incorrect')
  assert.equal(item.files[0].report.user_feedback, 'incorrect')
  assert.equal(item.files[1].report.user_feedback, null)
  store.feedback(item.id, item.files[0].id, 'correct')
  assert.equal(item.files[0].report.user_feedback, 'correct')
  assert.equal(store.reviewed, 1)
  store.dispose()
})
