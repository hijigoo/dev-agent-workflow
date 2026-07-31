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

    await user.selectOptions(screen.getByLabelText('최소 수용 인원'), '16')
    await user.click(screen.getByRole('button', { name: '화상 회의' }))

    expect(screen.getByRole('heading', { name: '오르빗(데모)' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '오로라(데모)' })).not.toBeInTheDocument()
    expect(screen.getByText('1건 일치')).toBeInTheDocument()
  })

  it('creates timezone-aware start and end values from the form', async () => {
    const user = userEvent.setup()
    const onCreateReservation = vi.fn().mockResolvedValue(undefined)
    renderRooms(onCreateReservation)

    await user.click(screen.getByRole('button', { name: '시더(데모) 예약' }))
    await user.type(screen.getByLabelText('회의 제목'), 'Design review')
    const date = screen.getByLabelText('날짜')
    const startTime = screen.getByLabelText('시작 시간')
    await user.clear(date)
    await user.type(date, '2026-08-04')
    await user.clear(startTime)
    await user.type(startTime, '09:30')
    await user.selectOptions(screen.getByLabelText('진행 시간'), '90')
    await user.click(screen.getByRole('button', { name: '예약 확정' }))

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

    await user.click(screen.getByRole('button', { name: '오로라(데모) 예약' }))
    await user.type(screen.getByLabelText('회의 제목'), 'Design review')
    await user.click(screen.getByRole('button', { name: '예약 확정' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('생성하지 못했습니다')
  })
})
