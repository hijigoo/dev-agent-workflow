import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { sampleRooms } from '../data'
import { RoomsPage } from './RoomsPage'

function renderRooms(onCreateReservation = vi.fn().mockResolvedValue(undefined)) {
  return render(
    <RoomsPage
      rooms={sampleRooms}
      onCreateReservation={onCreateReservation}
      onViewReservations={vi.fn()}
    />,
  )
}

describe('RoomsPage', () => {
  it('filters rooms by capacity and equipment', async () => {
    const user = userEvent.setup()
    renderRooms()

    await user.selectOptions(screen.getByLabelText('Minimum capacity'), '16')
    await user.click(screen.getByRole('button', { name: 'Video conferencing' }))

    expect(screen.getByRole('heading', { name: 'Orbit (Demo)' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Aurora (Demo)' })).not.toBeInTheDocument()
    expect(screen.getByText('1 match')).toBeInTheDocument()
  })

  it('creates timezone-aware start and end values from the form', async () => {
    const user = userEvent.setup()
    const onCreateReservation = vi.fn().mockResolvedValue(undefined)
    renderRooms(onCreateReservation)

    await user.click(screen.getByRole('button', { name: 'Reserve Cedar (Demo)' }))
    await user.type(screen.getByLabelText('Meeting title'), 'Design review')
    const date = screen.getByLabelText('Date')
    const startTime = screen.getByLabelText('Start time')
    await user.clear(date)
    await user.type(date, '2026-08-04')
    await user.clear(startTime)
    await user.type(startTime, '09:30')
    await user.selectOptions(screen.getByLabelText('Duration'), '90')
    await user.click(screen.getByRole('button', { name: 'Confirm reservation' }))

    expect(onCreateReservation).toHaveBeenCalledWith(
      {
        room_id: 'demo-cedar',
        title: 'Design review',
        start: new Date('2026-08-04T09:30:00').toISOString(),
        end: new Date('2026-08-04T11:00:00').toISOString(),
      },
    )
  })

  it('shows a visible error when reservation creation fails', async () => {
    const user = userEvent.setup()
    renderRooms(vi.fn().mockRejectedValue(new Error('offline')))

    await user.click(screen.getByRole('button', { name: 'Reserve Aurora (Demo)' }))
    await user.type(screen.getByLabelText('Meeting title'), 'Design review')
    await user.click(screen.getByRole('button', { name: 'Confirm reservation' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be created')
  })
})
