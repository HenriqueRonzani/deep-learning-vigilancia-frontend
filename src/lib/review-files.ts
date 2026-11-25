import type { Inspection } from '../types/inspection'

export function reviewFiles(inspection: Pick<Inspection, 'status' | 'files'>) {
  if (inspection.status !== 'completed') return inspection.files
  return inspection.files.filter((file) =>
    file.file_reports.some(
      (report) =>
        report.irregularity === 'open_water_tank' || report.irregularity === 'abandoned_pool',
    ),
  )
}
