import { useMemo, useState } from 'react'
import type { ReservationInput, Room } from '../types'

interface RoomsPageProps {
  rooms: Room[]
  onCreateReservation: (input: ReservationInput) => Promise<void>
  onViewReservations: () => void
  demoData?: boolean
}

function formatEquipment(value: string) {
  if (value === 'Display') return '디스플레이'
  if (value === 'Whiteboard') return '화이트보드'
  if (value === 'Video conferencing') return '화상 회의'
  if (value === 'Phone booth') return '폰 부스'
  return value
}

function formatRoomStatus(value: Room['status']) {
  return value === 'Available' ? '이용 가능' : '제한적'
}

export function RoomsPage({
  rooms,
  onCreateReservation,
  onViewReservations,
  demoData = false,
}: RoomsPageProps) {
  const [capacity, setCapacity] = useState(1)
  const [equipment, setEquipment] = useState('All')
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const equipmentOptions = useMemo(
    () => [...new Set(rooms.flatMap((room) => room.equipment))].sort(),
    [rooms],
  )

  const filteredRooms = useMemo(
    () =>
      rooms.filter(
        (room) =>
          room.capacity >= capacity &&
          (equipment === 'All' || room.equipment.includes(equipment)),
      ),
    [capacity, equipment, rooms],
  )

  return (
    <>
      <section className="hero page-shell" aria-labelledby="rooms-title">
        <div>
          <p className="eyebrow">업무 공간 · 서울 캠퍼스</p>
          <h1 id="rooms-title">지금 바로 맞는 회의실을 찾아보세요.</h1>
          <p className="hero-copy">
            실시간 이용 가능 여부를 확인하고 필요한 장비를 맞춰 몇 초 안에 예약하세요.
          </p>
        </div>
        <div className="availability-summary" aria-label="회의실 이용 가능 요약">
          <span className="live-indicator"><i aria-hidden="true" /> {demoData ? '데모 데이터' : '실시간'}</span>
          <strong>{rooms.filter((room) => room.status === 'Available').length}개 회의실</strong>
          <small>{demoData ? '현재 회의실 API에 연결할 수 없습니다' : '오늘 오후 이용 가능'}</small>
        </div>
      </section>

      <main className="page-shell content-stack">
        <section className="filter-panel" aria-labelledby="filters-title">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">회의실 찾기</p>
              <h2 id="filters-title">어떤 조건이 필요하신가요?</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setCapacity(1)
                setEquipment('All')
              }}
            >
              필터 초기화
            </button>
          </div>
          <div className="filters">
            <label>
              최소 수용 인원
              <select
                aria-label="최소 수용 인원"
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
              >
                <option value="1">모든 규모</option>
                <option value="4">4인 이상</option>
                <option value="6">6인 이상</option>
                <option value="10">10인 이상</option>
                <option value="16">16인 이상</option>
              </select>
            </label>
            <fieldset>
              <legend>장비</legend>
              <div className="chip-group">
                <button
                  type="button"
                  className={equipment === 'All' ? 'filter-chip selected' : 'filter-chip'}
                  aria-pressed={equipment === 'All'}
                  onClick={() => setEquipment('All')}
                >
                  모든 장비
                </button>
                {equipmentOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={equipment === item ? 'filter-chip selected' : 'filter-chip'}
                    aria-pressed={equipment === item}
                    onClick={() => setEquipment(item)}
                  >
                    {formatEquipment(item)}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <section aria-labelledby="results-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{demoData ? '샘플 인벤토리(명확히 표기됨)' : '현재 인벤토리'}</p>
              <h2 id="results-title">이용 가능한 공간</h2>
            </div>
            <p className="result-count" aria-live="polite">
              {filteredRooms.length}건 일치
            </p>
          </div>
          {filteredRooms.length > 0 ? (
            <div className="room-grid">
              {filteredRooms.map((room) => (
                <article className="room-card" key={room.id}>
                  <div className="room-visual" aria-hidden="true">
                    <span>{room.capacity}</span>
                    <small>좌석</small>
                  </div>
                  <div className="room-content">
                    <div className="room-title-row">
                      <div>
                        <h3>{room.name}</h3>
                        <p>{room.floor}</p>
                      </div>
                      <span className={`status ${room.status.toLowerCase()}`}>{formatRoomStatus(room.status)}</span>
                    </div>
                    <p className="next-available">{room.nextAvailable}</p>
                    <ul className="equipment-list" aria-label={`${room.name} 장비`}>
                      {room.equipment.map((item) => (
                        <li key={item}>{formatEquipment(item)}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="primary-button full-width"
                      onClick={() => setSelectedRoom(room)}
                    >
                      {room.name} 예약
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span aria-hidden="true">⌕</span>
              <h3>해당 필터와 일치하는 회의실이 없습니다</h3>
              <p>수용 인원을 낮추거나 다른 장비를 선택해 보세요.</p>
            </div>
          )}
        </section>
      </main>

      {selectedRoom && (
        <ReservationDialog
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onSubmit={async (input) => {
            await onCreateReservation(input)
            setSelectedRoom(null)
            onViewReservations()
          }}
        />
      )}
    </>
  )
}

interface ReservationDialogProps {
  room: Room
  onClose: () => void
  onSubmit: (input: ReservationInput) => Promise<void>
}

function ReservationDialog({ room, onClose, onSubmit }: ReservationDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const minDate = new Date().toISOString().slice(0, 10)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const start = new Date(`${String(form.get('date'))}T${String(form.get('startTime'))}:00`)
    const duration = Number(form.get('duration'))

    if (Number.isNaN(start.getTime())) {
      setError('유효한 예약 날짜와 시간을 입력하세요.')
      return
    }
    const end = new Date(start.getTime() + duration * 60_000)

    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        room_id: room.id,
        title: String(form.get('title')),
        start: start.toISOString(),
        end: end.toISOString(),
      })
    } catch {
      setError('예약을 생성하지 못했습니다. 회의 API를 확인한 뒤 다시 시도하세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <p className="eyebrow">새 예약</p>
            <h2 id="reservation-title">{room.name} 예약</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <p className="dialog-summary">{room.floor} · 최대 {room.capacity}명</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="span-two">
            회의 제목
            <input name="title" required placeholder="예: 디자인 리뷰" />
          </label>
          <label>
            날짜
            <input name="date" required type="date" min={minDate} defaultValue={minDate} />
          </label>
          <label>
            시작 시간
            <input name="startTime" required type="time" defaultValue="14:00" />
          </label>
          <label className="span-two">
            진행 시간
            <select name="duration" defaultValue="60">
              <option value="30">30분</option>
              <option value="45">45분</option>
              <option value="60">1시간</option>
              <option value="90">1시간 30분</option>
            </select>
          </label>
          {error && <p className="form-error span-two" role="alert">{error}</p>}
          <div className="form-actions span-two">
            <button className="secondary-button" type="button" onClick={onClose}>취소</button>
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? '예약 중…' : '예약 확정'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
