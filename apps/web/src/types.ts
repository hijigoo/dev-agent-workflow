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

export interface AgentResponse {
  answer: string
  intent: string
  confidence: number
  stages: string[]
  runtime_version: string
  pipeline_version: string
}
