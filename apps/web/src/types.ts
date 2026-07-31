export interface ApiRoom {
  id: string
  name: string
  capacity: number
  equipment: string[]
}

export interface Room extends ApiRoom {
  floor: string
  status: 'Available' | 'Limited'
  nextAvailable: string
}

export interface ReservationInput {
  room_id: string
  title: string
  start: string
  end: string
}

export interface Reservation extends ReservationInput {
  id: number
  status: string
  created_at: string
}

export type WorkDestination = 'local' | 'jira'

export interface WorkScenario {
  id: string
  externalKey: string
  label: string
  description: string
  defaultTitle: string
  defaultLabels: string[]
}

export interface WorkItemInput {
  external_key: string
  title: string
  description: string
  source: WorkDestination
  status: string
  labels: string[]
}

export interface WorkItem {
  id: string | number
  external_key: string
  title: string
  description: string
  source: string
  status: string
  labels: string[]
  delivery_mode: string
  delivery_status: string
  preview_body: {
    title: string
    body: string
    labels: string[]
  } | null
  github_issue_number: number | null
  github_issue_url: string | null
  created_at: string
}

export interface WorkItemResponse {
  work_item: WorkItem
  idempotent_replay: boolean
}
