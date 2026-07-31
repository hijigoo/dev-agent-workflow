import { useMemo, useState } from 'react'
import type { ReservationInput, Room } from '../types'

interface RoomsPageProps {
  rooms: Room[]
  onCreateReservation: (input: ReservationInput) => Promise<void>
  onViewReservations: () => void
  demoData?: boolean
}

function formatEquipment(value: string) {
  return value === 'Video conferencing' ? 'Video' : value
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
          <p className="eyebrow">Workspace · Seoul campus</p>
          <h1 id="rooms-title">Find the right room, right now.</h1>
          <p className="hero-copy">
            Search live availability, match the equipment you need, and reserve in seconds.
          </p>
        </div>
        <div className="availability-summary" aria-label="Room availability summary">
          <span className="live-indicator"><i aria-hidden="true" /> {demoData ? 'Demo data' : 'Live'}</span>
          <strong>{rooms.filter((room) => room.status === 'Available').length} rooms</strong>
          <small>{demoData ? 'Room API is currently offline' : 'available this afternoon'}</small>
        </div>
      </section>

      <main className="page-shell content-stack">
        <section className="filter-panel" aria-labelledby="filters-title">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Room finder</p>
              <h2 id="filters-title">What do you need?</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setCapacity(1)
                setEquipment('All')
              }}
            >
              Reset filters
            </button>
          </div>
          <div className="filters">
            <label>
              Minimum capacity
              <select
                aria-label="Minimum capacity"
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
              >
                <option value="1">Any size</option>
                <option value="4">4+ people</option>
                <option value="6">6+ people</option>
                <option value="10">10+ people</option>
                <option value="16">16+ people</option>
              </select>
            </label>
            <fieldset>
              <legend>Equipment</legend>
              <div className="chip-group">
                <button
                  type="button"
                  className={equipment === 'All' ? 'filter-chip selected' : 'filter-chip'}
                  aria-pressed={equipment === 'All'}
                  onClick={() => setEquipment('All')}
                >
                  All equipment
                </button>
                {equipmentOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={equipment === item ? 'filter-chip selected' : 'filter-chip'}
                    aria-pressed={equipment === item}
                    onClick={() => setEquipment(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <section aria-labelledby="results-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{demoData ? 'Clearly labeled sample inventory' : 'Current inventory'}</p>
              <h2 id="results-title">Available spaces</h2>
            </div>
            <p className="result-count" aria-live="polite">
              {filteredRooms.length} {filteredRooms.length === 1 ? 'match' : 'matches'}
            </p>
          </div>
          {filteredRooms.length > 0 ? (
            <div className="room-grid">
              {filteredRooms.map((room) => (
                <article className="room-card" key={room.id}>
                  <div className="room-visual" aria-hidden="true">
                    <span>{room.capacity}</span>
                    <small>seats</small>
                  </div>
                  <div className="room-content">
                    <div className="room-title-row">
                      <div>
                        <h3>{room.name}</h3>
                        <p>{room.floor}</p>
                      </div>
                      <span className={`status ${room.status.toLowerCase()}`}>{room.status}</span>
                    </div>
                    <p className="next-available">{room.nextAvailable}</p>
                    <ul className="equipment-list" aria-label={`${room.name} equipment`}>
                      {room.equipment.map((item) => (
                        <li key={item}>{formatEquipment(item)}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="primary-button full-width"
                      onClick={() => setSelectedRoom(room)}
                    >
                      Reserve {room.name}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span aria-hidden="true">⌕</span>
              <h3>No rooms match those filters</h3>
              <p>Try reducing capacity or selecting different equipment.</p>
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
      setError('Enter a valid reservation date and time.')
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
      setError('Reservation could not be created. Check the meeting API and try again.')
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
            <p className="eyebrow">New reservation</p>
            <h2 id="reservation-title">Reserve {room.name}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="dialog-summary">{room.floor} · Up to {room.capacity} people</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="span-two">
            Meeting title
            <input name="title" required placeholder="e.g. Design review" />
          </label>
          <label>
            Date
            <input name="date" required type="date" min={minDate} defaultValue={minDate} />
          </label>
          <label>
            Start time
            <input name="startTime" required type="time" defaultValue="14:00" />
          </label>
          <label className="span-two">
            Duration
            <select name="duration" defaultValue="60">
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
            </select>
          </label>
          {error && <p className="form-error span-two" role="alert">{error}</p>}
          <div className="form-actions span-two">
            <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? 'Reserving…' : 'Confirm reservation'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
