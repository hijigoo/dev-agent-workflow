import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkIntakePage } from './WorkIntakePage'

const responsePayload = {
  work_item: {
    id: 'wi-42',
    external_key: 'cloud-agent:security-alert',
    title: 'Remediate Cloud Agent security alert',
    description: 'Triage and remediate a dependency or platform security alert.',
    source: 'jira',
    status: 'open',
    labels: ['security', 'cloud-agent', 'priority:p2'],
    delivery_mode: 'github',
    delivery_status: 'delivered',
    preview_body: {
      title: 'Remediate Cloud Agent security alert',
      body: '## Security remediation\n\nInvestigate and patch.',
      labels: ['security', 'cloud-agent', 'priority:p2'],
    },
    github_issue_number: 42,
    github_issue_url: 'https://github.com/example/cloud-agent/issues/42',
    created_at: '2026-07-31T05:30:00Z',
  },
  idempotent_replay: false,
}

describe('WorkIntakePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps a scenario to the backend contract and renders its issue response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => responsePayload,
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<WorkIntakePage />)

    await user.click(screen.getByText('Security alert remediation'))
    await user.click(screen.getByRole('button', { name: 'Jira-like queue' }))
    await user.click(screen.getByRole('button', { name: 'Generate work item' }))

    expect(await screen.findByRole('status')).toHaveTextContent('created by the intake service')
    expect(screen.getByRole('heading', { name: 'Remediate Cloud Agent security alert' }))
      .toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open generated issue' }))
      .toHaveAttribute('href', responsePayload.work_item.github_issue_url)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8001/work-items')
    expect(JSON.parse(init.body)).toEqual({
      external_key: 'cloud-agent:security-alert',
      title: 'Remediate Cloud Agent security alert',
      description: 'Triage and remediate a dependency or platform security alert.',
      source: 'jira',
      status: 'open',
      labels: ['security', 'cloud-agent', 'priority:p2'],
    })
  })

  it('reports an API failure without fabricating a work item', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const user = userEvent.setup()
    render(<WorkIntakePage />)

    await user.click(screen.getByRole('button', { name: 'Generate work item' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be created')
    expect(screen.queryByText('Ready')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open generated issue' })).not.toBeInTheDocument()
  })
})
