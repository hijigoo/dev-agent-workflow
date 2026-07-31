import { useEffect, useState } from 'react'
import { reservationsApi, roomsApi } from './api'
import { sampleRooms, toRoomView } from './data'
import { Header } from './components/Header'
import { AgentLabPage } from './components/AgentLabPage'
import { OperationsPage } from './components/OperationsPage'
import { ReservationsPage } from './components/ReservationsPage'
import { RoomsPage } from './components/RoomsPage'
import { WorkIntakePage } from './components/WorkIntakePage'
import type { Reservation, ReservationInput, Room } from './types'

export type Page = 'rooms' | 'reservations' | 'agent' | 'operations' | 'intake'

export default function App() {
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
        setReservationError('Reservations could not be loaded from the meeting API.')
      })

    return () => controller.abort()
  }, [])

  async function createReservation(input: ReservationInput) {
    setReservationError('')
    try {
      const created = await reservationsApi.create(input)
      setReservations((current) => [...current, created])
    } catch {
      setReservationError('Reservation could not be created by the meeting API.')
      throw new Error('Reservation creation failed')
    }
  }

  async function cancelReservation(id: number) {
    setReservationError('')
    try {
      await reservationsApi.cancel(id)
      setReservations((current) => current.filter((item) => item.id !== id))
    } catch {
      setReservationError('Reservation could not be cancelled. It remains on your schedule.')
    }
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header activePage={page} onNavigate={setPage} />
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
        {page === 'operations' && <OperationsPage />}
        {page === 'agent' && <AgentLabPage />}
        {page === 'intake' && <WorkIntakePage />}
      </div>
      <footer>
        <div className="page-shell">
          <span>Atlas Operations</span>
          <span>API-ready demo · No credentials stored in the browser</span>
        </div>
      </footer>
    </div>
  )
}
