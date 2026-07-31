import { useEffect, useState } from 'react'
import { reservationsApi, roomsApi } from './api'
import { sampleRooms, toRoomView } from './data'
import { Header } from './components/Header'
import { AgentLabPage } from './components/AgentLabPage'
import { ReservationsPage } from './components/ReservationsPage'
import { RoomsPage } from './components/RoomsPage'
import { useTheme } from './useTheme'
import type { Reservation, ReservationInput, Room } from './types'

export type Page = 'rooms' | 'reservations' | 'agent'

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const [page, setPage] = useState<Page>('rooms')
  const [rooms, setRooms] = useState<Room[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [usingDemoRooms, setUsingDemoRooms] = useState(false)
  const [reservationError, setReservationError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    void roomsApi
      .list(controller.signal)
      .then((items) => setRooms(items.map(toRoomView)))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setRooms(sampleRooms)
        setUsingDemoRooms(true)
      })

    void reservationsApi
      .list(controller.signal)
      .then(setReservations)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setReservationError('회의 API에서 예약 목록을 불러오지 못했습니다.')
      })

    return () => controller.abort()
  }, [])

  async function createReservation(input: ReservationInput) {
    setReservationError('')
    try {
      const created = await reservationsApi.create(input)
      setReservations((current) => [...current, created])
    } catch {
      setReservationError('회의 API에서 예약을 생성하지 못했습니다.')
      throw new Error('Reservation creation failed')
    }
  }

  async function cancelReservation(id: number) {
    setReservationError('')
    try {
      await reservationsApi.cancel(id)
      setReservations((current) => current.filter((item) => item.id !== id))
    } catch {
      setReservationError('예약을 취소하지 못했습니다. 일정에는 그대로 유지됩니다.')
    }
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <Header activePage={page} onNavigate={setPage} theme={theme} onToggleTheme={toggleTheme} />
      <div id="main-content">
        {page === 'rooms' && (
          <RoomsPage
            rooms={rooms}
            onCreateReservation={createReservation}
            onViewReservations={() => setPage('reservations')}
            demoData={usingDemoRooms}
          />
        )}
        {page === 'reservations' && (
          <ReservationsPage
            reservations={reservations}
            rooms={rooms}
            error={reservationError}
            onCancel={cancelReservation}
            onFindRoom={() => setPage('rooms')}
          />
        )}
        {page === 'agent' && <AgentLabPage />}
      </div>
      <footer>
        <div className="page-shell">
          <span>아틀라스 운영</span>
          <span>API 연동 데모 · 브라우저에 자격 증명을 저장하지 않습니다</span>
        </div>
      </footer>
    </div>
  )
}
