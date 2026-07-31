import type { Reservation, Room } from '../types'

interface ReservationsPageProps {
  reservations: Reservation[]
  rooms: Room[]
  error: string
  onCancel: (id: number) => Promise<void>
  onFindRoom: () => void
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatReservationStatus(status: string) {
  if (status === 'confirmed') return '확정'
  if (status === 'cancelled') return '취소됨'
  return status
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
          <p className="eyebrow">업무 공간 일정</p>
          <h1>예약</h1>
          <p>다가오는 회의실 예약과 회의 정보를 관리하세요.</p>
        </div>
        <button type="button" className="primary-button" onClick={onFindRoom}>회의실 찾기</button>
      </div>
      {error && <p className="service-error" role="alert">{error}</p>}
      {reservations.length ? (
        <section className="reservation-list" aria-label="다가오는 예약">
          {reservations.map((reservation) => {
            const start = new Date(reservation.start)
            const duration = Math.round(
              (new Date(reservation.end).getTime() - start.getTime()) / 60_000,
            )
            const roomName =
              rooms.find((room) => room.id === reservation.room_id)?.name ??
              `회의실 ${reservation.room_id}`

            return (
              <article className="reservation-row" key={reservation.id}>
                <div className="date-tile">
                  <strong>{start.getDate()}</strong>
                  <span>{new Intl.DateTimeFormat('ko-KR', { month: 'short' }).format(start)}</span>
                </div>
                <div className="reservation-main">
                  <span className="reservation-time">
                    {formatDate(reservation.start)} · {formatTime(reservation.start)}
                  </span>
                  <h2>{reservation.title}</h2>
                  <p>{roomName} · {duration}분 · 상태: {formatReservationStatus(reservation.status)}</p>
                </div>
                <div className="reservation-owner">
                  <span>종료</span>
                  <strong>{formatTime(reservation.end)}</strong>
                </div>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => void onCancel(reservation.id)}
                  aria-label={`${reservation.title} 취소`}
                >
                  취소
                </button>
              </article>
            )
          })}
        </section>
      ) : (
        <div className="empty-state">
          <span aria-hidden="true">□</span>
          <h2>다가오는 예약이 없습니다</h2>
          <p>다음 회의를 위해 회의실을 찾아 예약해 보세요.</p>
          <button type="button" className="primary-button" onClick={onFindRoom}>회의실 보기</button>
        </div>
      )}
    </main>
  )
}
