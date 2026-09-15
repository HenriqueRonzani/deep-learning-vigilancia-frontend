export type ReportStatus = 'queued' | 'processing' | 'completed' | 'failed'
export type Irregularity = 'open_water_tank' | 'abandoned_pool'
export type Feedback = 'correct' | 'incorrect'
export interface FileReport {
  file_id: string
  irregularity: Irregularity | null
  status: ReportStatus
  agent_report: string
  user_feedback: Feedback | null
}
export interface InspectionFile {
  id: string
  name: string
  mime_type: string
  size: number
  url: string | null
  report: FileReport | null
}
export interface Inspection {
  id: number
  name: string
  requested_at: string
  status: ReportStatus
  files: InspectionFile[]
  beginsAt?: number
  finishesAt?: number
}
