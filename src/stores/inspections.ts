import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  Feedback,
  FileReport,
  Inspection,
  InspectionFile,
  Irregularity,
} from '@/types/inspection'

function makeReport(fileId: string, category: Irregularity): FileReport {
  return {
    file_id: fileId,
    irregularity: category,
    status: 'completed',
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
    url: null,
    report: makeReport(id, category),
  }
}
export const useInspectionsStore = defineStore('inspections', () => {
  const now = Date.now()
  const inspections = ref<Inspection[]>([
    {
      id: 1048,
      name: 'Vistoria · Santa Bárbara',
      requested_at: new Date(now - 180000).toISOString(),
      status: 'processing',
      finishesAt: now + 90000,
      files: [
        { ...exampleFile('41', 'registro_01.jpg', 'abandoned_pool'), report: null },
        { ...exampleFile('42', 'registro_02.jpg', 'open_water_tank'), report: null },
      ],
    },
    {
      id: 1047,
      name: 'Reservatórios · Centro',
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
      requested_at: new Date(now - 86400000).toISOString(),
      status: 'completed',
      files: [exampleFile('21', 'sobrevoo_001.jpg', 'abandoned_pool')],
    },
    {
      id: 1045,
      name: 'Levantamento aéreo · Rio Maina',
      requested_at: new Date(now - 172800000).toISOString(),
      status: 'completed',
      files: [
        exampleFile('11', 'registro_001.jpg', 'abandoned_pool'),
        exampleFile('12', 'registro_002.jpg', 'open_water_tank'),
      ],
    },
  ])
  const pending = computed(() =>
    inspections.value.filter((i) => ['queued', 'processing'].includes(i.status)),
  )
  const completed = computed(() => inspections.value.filter((i) => i.status === 'completed'))
  const reviewed = computed(
    () => inspections.value.flatMap((i) => i.files).filter((f) => f.report?.user_feedback).length,
  )
  function create(name: string, files: File[]) {
    const id = Math.max(0, ...inspections.value.map((i) => i.id)) + 1
    const item: Inspection = {
      id,
      name: name.trim(),
      requested_at: new Date().toISOString(),
      status: 'queued',
      beginsAt: Date.now() + 6000,
      finishesAt: Date.now() + 20000,
      files: files.map((file, index) => ({
        id: `${id}-${index}`,
        name: file.name,
        mime_type: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
        report: null,
      })),
    }
    inspections.value.unshift(item)
    return item
  }
  function tick(time: number) {
    for (const item of pending.value) {
      if (item.status === 'queued' && time >= (item.beginsAt ?? Infinity))
        item.status = 'processing'
      if (time >= (item.finishesAt ?? Infinity)) {
        item.status = 'completed'
        item.files.forEach((file, i) => {
          file.report = makeReport(file.id, i % 2 ? 'open_water_tank' : 'abandoned_pool')
        })
      }
    }
  }
  function feedback(inspectionId: number, fileId: string, value: Feedback) {
    const report = inspections.value
      .find((i) => i.id === inspectionId)
      ?.files.find((f) => f.id === fileId)?.report
    if (report) report.user_feedback = value
  }
  function dispose() {
    inspections.value.forEach((i) =>
      i.files.forEach((f) => {
        if (f.url) URL.revokeObjectURL(f.url)
      }),
    )
  }
  return { inspections, pending, completed, reviewed, create, tick, feedback, dispose }
})
