import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { AgentLabPage } from './AgentLabPage'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('runs the local mini agent and displays trace evidence', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      answer: 'Choose a room and confirm the reservation.',
      intent: 'reservation-help',
      confidence: 0.96,
      stages: ['normalize', 'classify:reservation-help', 'respond:reservation-help'],
      runtime_version: 'v1.0.0',
      pipeline_version: 'v1.0.0',
    }),
  }))

  render(<AgentLabPage />)
  await userEvent.click(screen.getByRole('button', { name: 'Run Mini Agent' }))

  expect(await screen.findByText('Choose a room and confirm the reservation.')).toBeVisible()
  expect(screen.getByText('reservation-help')).toBeVisible()
  expect(screen.getAllByText('v1.0.0')).toHaveLength(2)
})

it('classifies Korean room-search request and displays room-search intent', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      answer: 'Use capacity and equipment filters to find a room. Atlas is the smallest seeded room.',
      intent: 'room-search',
      confidence: 0.93,
      stages: ['normalize', 'classify:room-search', 'respond:room-search'],
      runtime_version: 'v1.0.0',
      pipeline_version: 'v1.0.0',
    }),
  }))

  render(<AgentLabPage />)
  await userEvent.clear(screen.getByRole('textbox', { name: 'Message' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), '화상회의가 가능한 10명 회의실을 찾아줘')
  await userEvent.click(screen.getByRole('button', { name: 'Run Mini Agent' }))

  expect(await screen.findByText('Use capacity and equipment filters to find a room. Atlas is the smallest seeded room.')).toBeVisible()
  expect(screen.getByText('room-search')).toBeVisible()
  expect(screen.getByText(/classify:room-search/)).toBeVisible()
})
