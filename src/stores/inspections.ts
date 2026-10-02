import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  api,
  apiMode,
  listAllInspections,
  normalizeInspection,
  submitInspection,
} from '../services/api.ts'
import type {
  Feedback,
  FileReport,
  Inspection,
  InspectionFile,
  Irregularity,
  CreateInspection,
} from '@/types/inspection'

function makeReport(fileId: string, category: Irregularity): FileReport {
  return {
    id: Number(fileId.replace(/\D/g, '')) * 10 + (category === 'open_water_tank' ? 1 : 2),
    file_id: fileId,
    irregularity: category,
    status: 'created',
    user_feedback: null,
    agent_report:
      category === 'open_water_tank'
        ? 'Relatório de exemplo: possível reservatório sem tampa. O agente deve verificar a condição de cobertura da caixa-d’água.'
        : 'Relatório de exemplo: piscina com sinais que justificariam uma inspeção. A condição de abandono deve ser verificada pelo agente.',
  }
}
function exampleFile(id: string, name: string, category: Irregularity): InspectionFile {
  return {
    id,
    name,
    mime_type: 'image/jpeg',
    size: 2840000,
    path: `demo/${name}`,
    url: null,
    file_reports: [makeReport(id, category)],
  }
}
export const useInspectionsStore = defineStore('inspections', () => {
  const now = Date.now()
  const isDemo = !apiMode
  const loading = ref(false)
  const error = ref('')
  const pollingError = ref('')
  const progress = ref('')
  const inspections = ref<Inspection[]>([
    {
      id: 1048,
      name: 'Vistoria · Santa Bárbara',
      address: 'Rua Emílio Hulse, 2120, Santa Bárbara, Criciúma',
      type: 'active',
      dengue_breeding_site_spotted: false,
      filesLoaded: true,
      requested_at: new Date(now - 180000).toISOString(),
      status: 'processing',
      finishesAt: now + 90000,
      files: [
        { ...exampleFile('41', 'registro_01.jpg', 'abandoned_pool'), file_reports: [] },
        { ...exampleFile('42', 'registro_02.jpg', 'open_water_tank'), file_reports: [] },
      ],
    },
    {
      id: 1047,
      name: 'Reservatórios · Centro',
      address: 'Rua de demonstração, 10, Centro, Criciúma',
      type: 'report',
      dengue_breeding_site_spotted: true,
      filesLoaded: true,
      requested_at: new Date(now - 3600000).toISOString(),
      status: 'completed',
      files: [
        exampleFile('31', 'drone_001.jpg', 'open_water_tank'),
        exampleFile('32', 'drone_002.jpg', 'open_water_tank'),
      ],
    },
    {
      id: 1046,
      name: 'Verificação de piscinas · Próspera',
      address: 'Rua de demonstração, 100, Próspera, Criciúma',
      type: 'dengue_breeding_site',
      dengue_breeding_site_spotted: true,
      filesLoaded: true,
      requested_at: new Date(now - 86400000).toISOString(),
      status: 'completed',
      files: [exampleFile('21', 'sobrevoo_001.jpg', 'abandoned_pool')],
    },
    {
      id: 1045,
      name: 'Levantamento aéreo · Rio Maina',
      address: 'Rua de demonstração, 200, Rio Maina, Criciúma',
      type: 'active',
      dengue_breeding_site_spotted: true,
      filesLoaded: true,
      requested_at: new Date(now - 172800000).toISOString(),
      status: 'completed',
      files: [
        exampleFile('11', 'registro_001.jpg', 'abandoned_pool'),
        exampleFile('12', 'registro_002.jpg', 'open_water_tank'),
      ],
    },
  ])
  if (!isDemo) inspections.value = []
  // Demonstrate that one image can have two independently reviewed reports.
  const sample = inspections.value[1]?.files[0]
  if (sample) sample.file_reports.push(makeReport(sample.id, 'abandoned_pool'))
  const pending = computed(() =>
    inspections.value.filter((i) => ['queued', 'processing'].includes(i.status)),
  )
  const completed = computed(() => inspections.value.filter((i) => i.status === 'completed'))
  const reviewed = computed(
    () =>
      inspections.value
        .flatMap((i) => i.files)
        .flatMap((f) => f.file_reports)
        .filter((r) => r.user_feedback).length,
  )
  async function create(payload: CreateInspection, files: File[]) {
    if (!isDemo) {
      const dto = await submitInspection(payload, files, (text) => {
        progress.value = text
      })
      const result = normalizeInspection(dto)
      upsert(result)
      return result
    }
    const id = Math.max(0, ...inspections.value.map((i) => i.id)) + 1
    const item: Inspection = {
      id,
      ...payload,
      name: payload.name.trim(),
      address: payload.address.trim(),
      filesLoaded: true,
      requested_at: new Date().toISOString(),
      status: 'queued',
      beginsAt: Date.now() + 6000,
      finishesAt: Date.now() + 20000,
      files: files.map((file, index) => ({
        id: `${id}-${index}`,
        name: file.name,
        mime_type: file.type,
        size: file.size,
        path: `demo/${file.name}`,
        url: URL.createObjectURL(file),
        file_reports: [],
      })),
    }
    inspections.value.unshift(item)
    return item
  }
  function tick(time: number) {
    if (!isDemo) return
    for (const item of pending.value) {
      if (item.status === 'queued' && time >= (item.beginsAt ?? Infinity))
        item.status = 'processing'
      if (time >= (item.finishesAt ?? Infinity)) {
        item.status = 'completed'
        item.files.forEach((file, i) => {
          file.file_reports = [makeReport(file.id, i % 2 ? 'open_water_tank' : 'abandoned_pool')]
        })
      }
    }
  }
  async function feedback(inspectionId: number, fileId: string, reportId: number, value: Feedback) {
    const report = inspections.value
      .find((i) => i.id === inspectionId)
      ?.files.find((f) => f.id === fileId)
      ?.file_reports.find((r) => r.id === reportId)
    if (!report) throw new Error('Relatório não encontrado.')
    if (!isDemo) {
      const saved = await api.feedback(reportId, value)
      Object.assign(report, saved, { file_id: String(saved.file_id) })
    } else report.user_feedback = value
  }
  function upsert(item: Inspection) {
    const index = inspections.value.findIndex((i) => i.id === item.id)
    if (index < 0) inspections.value.unshift(item)
    else inspections.value[index] = item
  }
  async function loadList() {
    if (isDemo || loading.value) return
    loading.value = true
    error.value = ''
    try {
      const rows = await listAllInspections()
      const existing = new Map(inspections.value.map((i) => [i.id, i]))
      inspections.value = rows.map((dto) => {
        const next = normalizeInspection(dto)
        const old = existing.get(dto.id)
        if (old?.filesLoaded && old.status === next.status) {
          next.files = old.files
          next.filesLoaded = true
        }
        return next
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erro ao carregar solicitações.'
    } finally {
      loading.value = false
    }
  }
  async function loadDetail(id: number) {
    if (isDemo) return
    upsert(normalizeInspection(await api.detail(id)))
  }
  let polling = false
  async function poll() {
    if (isDemo || polling) return
    polling = true
    try {
      const results = await Promise.allSettled(
        pending.value.map(async (item) => {
          const result = await api.status(item.id)
          // Fetch the entire terminal result before changing status, so errors retry next poll.
          if (['completed', 'failed'].includes(result.status)) await loadDetail(item.id)
          else item.status = result.status
        }),
      )
      pollingError.value = results.some((r) => r.status === 'rejected')
        ? 'Não foi possível atualizar todas as análises. Nova tentativa automática em 5 segundos.'
        : ''
    } finally {
      polling = false
    }
  }
  function dispose() {
    inspections.value.forEach((i) =>
      i.files.forEach((f) => {
        if (f.url?.startsWith('blob:')) URL.revokeObjectURL(f.url)
      }),
    )
  }
  return {
    inspections,
    pending,
    completed,
    reviewed,
    create,
    tick,
    feedback,
    dispose,
    isDemo,
    loading,
    error,
    pollingError,
    progress,
    loadList,
    loadDetail,
    poll,
  }
})
