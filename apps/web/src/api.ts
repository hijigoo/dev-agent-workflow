import type {
  ApiRoom,
  Reservation,
  ReservationInput,
  WorkItemInput,
  WorkItemResponse,
} from './types'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
export const WORK_INTAKE_URL =
  import.meta.env.VITE_WORK_INTAKE_URL ?? 'http://localhost:8001'

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const roomsApi = {
  list: (signal?: AbortSignal) => request<ApiRoom[]>(API_URL, '/rooms', { signal }),
}

export const reservationsApi = {
  list: (signal?: AbortSignal) =>
    request<Reservation[]>(API_URL, '/reservations', { signal }),
  create: (input: ReservationInput) =>
    request<Reservation>(API_URL, '/reservations', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  cancel: (id: number) =>
    request<Reservation>(API_URL, `/reservations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
}

export const workIntakeApi = {
  create: (input: WorkItemInput) =>
    request<WorkItemResponse>(WORK_INTAKE_URL, '/work-items', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
}
