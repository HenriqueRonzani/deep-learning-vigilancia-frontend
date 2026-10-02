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

test('solicitacao percorre fila e processamento antes do relatorio e feedback por arquivo', async () => {
  setActivePinia(createPinia())
  const store = useInspectionsStore()
  const record = await store.create(
    {
      name: '  Teste de vistoria  ',
      address: 'Rua A, 10',
      type: 'active',
      dengue_breeding_site_spotted: false,
    },
    [
      new File(['imagem'], 'teste.png', { type: 'image/png' }),
      new File(['outra'], 'outra.png', { type: 'image/png' }),
    ],
  )
  const item = store.inspections.find((i) => i.id === record.id)
  assert.equal(item.name, 'Teste de vistoria')
  assert.equal(item.status, 'queued')
  assert.deepEqual(item.files[0].file_reports, [])
  store.tick(item.beginsAt - 1)
  assert.equal(item.status, 'queued')
  store.tick(item.beginsAt)
  assert.equal(item.status, 'processing')
  assert.deepEqual(item.files[0].file_reports, [])
  store.tick(item.finishesAt)
  assert.equal(item.status, 'completed')
  assert.equal(
    item.dengue_breeding_site_spotted,
    false,
    'o processamento não altera a marcação do usuário',
  )
  assert.equal(item.files[0].file_reports[0].status, 'created')
  await store.feedback(item.id, item.files[0].id, item.files[0].file_reports[0].id, 'incorrect')
  assert.equal(item.files[0].file_reports[0].user_feedback, 'incorrect')
  assert.equal(item.files[1].file_reports[0].user_feedback, null)
  await store.feedback(item.id, item.files[0].id, item.files[0].file_reports[0].id, 'correct')
  assert.equal(item.files[0].file_reports[0].user_feedback, 'correct')
  assert.equal(store.reviewed, 1)
  store.dispose()
})

test('feedback pertence ao relatório, incluindo dois relatórios na mesma imagem', async () => {
  setActivePinia(createPinia())
  const store = useInspectionsStore()
  const item = store.inspections.find((i) => i.id === 1047)
  const file = item.files[0]
  assert.equal(file.file_reports.length, 2)
  await store.feedback(item.id, file.id, file.file_reports[1].id, 'incorrect')
  assert.equal(file.file_reports[0].user_feedback, null)
  assert.equal(file.file_reports[1].user_feedback, 'incorrect')
})
