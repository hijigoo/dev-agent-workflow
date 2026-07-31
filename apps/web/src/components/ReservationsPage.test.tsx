import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReservationsPage } from './ReservationsPage'

describe('ReservationsPage', () => {
  it('renders backend reservation fields and cancels by numeric id', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn().mockResolvedValue(undefined)

    render(
      <ReservationsPage
        reservations={[
          {
            id: 42,
            room_id: 'atlas',
            title: 'Platform review',
            start: '2026-08-04T00:30:00.000Z',
            end: '2026-08-04T01:30:00.000Z',
            status: 'confirmed',
            created_at: '2026-07-31T05:30:00Z',
          },
        ]}
        rooms={[
          {
            id: 'atlas',
            name: 'Aurora',
            capacity: 12,
            equipment: ['Display'],
            floor: '12F',
            status: 'Available',
            nextAvailable: 'Available now',
          },
        ]}
        error=""
        onCancel={onCancel}
        onFindRoom={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Platform review' })).toBeInTheDocument()
    expect(screen.getByText(/Aurora · 60 min · Status: confirmed/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel Platform review' }))
    expect(onCancel).toHaveBeenCalledWith(42)
  })
})
