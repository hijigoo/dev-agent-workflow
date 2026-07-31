import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkIntakePage } from './WorkIntakePage'

const responsePayload = {
  work_item: {
    id: 'wi-42',
    external_key: 'cloud-agent:security-alert',
    title: '클라우드 에이전트 보안 알림 대응',
    description: '의존성 또는 플랫폼 보안 알림을 분류하고 대응합니다.',
    source: 'jira',
    status: 'open',
    labels: ['security', 'cloud-agent', 'priority:p2'],
    delivery_mode: 'github',
    delivery_status: 'delivered',
    preview_body: {
      title: '클라우드 에이전트 보안 알림 대응',
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

    await user.click(screen.getByText('보안 알림 대응'))
    await user.click(screen.getByRole('button', { name: 'Jira 유사 큐' }))
    await user.click(screen.getByRole('button', { name: '작업 항목 생성' }))

    expect(await screen.findByRole('status')).toHaveTextContent('작업 항목을 생성했습니다')
    expect(screen.getByRole('heading', { name: '클라우드 에이전트 보안 알림 대응' }))
      .toBeInTheDocument()
    expect(screen.getByRole('link', { name: '생성된 이슈 열기' }))
      .toHaveAttribute('href', responsePayload.work_item.github_issue_url)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8001/work-items')
    expect(JSON.parse(init.body)).toEqual({
      external_key: 'cloud-agent:security-alert',
      title: '클라우드 에이전트 보안 알림 대응',
      description: '의존성 또는 플랫폼 보안 알림을 분류하고 대응합니다.',
      source: 'jira',
      status: 'open',
      labels: ['security', 'cloud-agent', 'priority:p2'],
    })
  })

  it('reports an API failure without fabricating a work item', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const user = userEvent.setup()
    render(<WorkIntakePage />)

    await user.click(screen.getByRole('button', { name: '작업 항목 생성' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('생성하지 못했습니다')
    expect(screen.queryByText('준비됨')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '생성된 이슈 열기' })).not.toBeInTheDocument()
  })
})
