export type InspectionStatus = 'draft' | 'queued' | 'processing' | 'completed' | 'failed'
export type ReportStatus = 'created' | 'provided_feedback'
export type DemandType = 'active' | 'dengue_breeding_site' | 'report'
export type Irregularity = 'open_water_tank' | 'abandoned_pool'
export type Feedback = 'correct' | 'incorrect'
export interface FileReport {
  id: number
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
  size: number | null
  path: string
  url: string | null
  file_reports: FileReport[]
}
export interface Inspection {
  id: number
  name: string
  address: string
  type: DemandType
  dengue_breeding_site_spotted: boolean
  requested_at: string
  status: InspectionStatus
  filesLoaded: boolean
  files: InspectionFile[]
  beginsAt?: number
  finishesAt?: number
}
export interface CreateInspection {
  name: string
  address: string
  type: DemandType
  dengue_breeding_site_spotted: boolean
}
