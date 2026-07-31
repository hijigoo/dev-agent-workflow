import type { Reservation, Room } from '../types'

interface ReservationsPageProps {
  reservations: Reservation[]
  rooms: Room[]
  error: string
  onCancel: (id: number) => Promise<void>
  onFindRoom: () => void
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function ReservationsPage({
  reservations,
  rooms,
  error,
  onCancel,
  onFindRoom,
}: ReservationsPageProps) {
  return (
    <main className="page-shell content-stack page-top">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Workspace schedule</p>
          <h1>Reservations</h1>
          <p>Manage your upcoming rooms and meeting details.</p>
        </div>
        <button type="button" className="primary-button" onClick={onFindRoom}>Find a room</button>
      </div>
      {error && <p className="service-error" role="alert">{error}</p>}
      {reservations.length ? (
        <section className="reservation-list" aria-label="Upcoming reservations">
          {reservations.map((reservation) => {
            const start = new Date(reservation.start)
            const duration = Math.round(
              (new Date(reservation.end).getTime() - start.getTime()) / 60_000,
            )
            const roomName =
              rooms.find((room) => room.id === reservation.room_id)?.name ??
              `Room ${reservation.room_id}`

            return (
              <article className="reservation-row" key={reservation.id}>
                <div className="date-tile">
                  <strong>{start.getDate()}</strong>
                  <span>{new Intl.DateTimeFormat('en', { month: 'short' }).format(start)}</span>
                </div>
                <div className="reservation-main">
                  <span className="reservation-time">
                    {formatDate(reservation.start)} · {formatTime(reservation.start)}
                  </span>
                  <h2>{reservation.title}</h2>
                  <p>{roomName} · {duration} min · Status: {reservation.status}</p>
                </div>
                <div className="reservation-owner">
                  <span>Ends</span>
                  <strong>{formatTime(reservation.end)}</strong>
                </div>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => void onCancel(reservation.id)}
                  aria-label={`Cancel ${reservation.title}`}
                >
                  Cancel
                </button>
              </article>
            )
          })}
        </section>
      ) : (
        <div className="empty-state">
          <span aria-hidden="true">□</span>
          <h2>No upcoming reservations</h2>
          <p>Find a room to schedule your next meeting.</p>
          <button type="button" className="primary-button" onClick={onFindRoom}>Browse rooms</button>
        </div>
      )}
    </main>
  )
}
