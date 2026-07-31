import { afterEach, describe, expect, it, vi } from 'vitest'
import { reservationsApi, roomsApi } from './api'

function jsonResponse<T>(value: T) {
  return {
    ok: true,
    status: 200,
    json: async () => value,
  }
}

describe('meeting API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the implemented room and reservation paths and payload', async () => {
    const input = {
      room_id: 'atlas',
      title: 'Platform review',
      start: '2026-08-04T00:30:00.000Z',
      end: '2026-08-04T01:30:00.000Z',
    }
    const reservation = {
      id: 42,
      ...input,
      status: 'confirmed',
      created_at: '2026-07-31T05:30:00Z',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 'atlas', name: 'Aurora', capacity: 12, equipment: ['Display'] }]))
      .mockResolvedValueOnce(jsonResponse(reservation))
      .mockResolvedValueOnce(jsonResponse(reservation))
    vi.stubGlobal('fetch', fetchMock)

    await roomsApi.list()
    await reservationsApi.create(input)
    await reservationsApi.cancel(42)

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/rooms')
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:8000/reservations')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(input)
    expect(fetchMock.mock.calls[2][0]).toBe('http://localhost:8000/reservations/42')
    expect(fetchMock.mock.calls[2][1].method).toBe('DELETE')
  })
})
