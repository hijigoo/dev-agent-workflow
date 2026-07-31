import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Header } from './Header'

function renderHeader(theme: 'light' | 'dark' = 'light', onToggleTheme = vi.fn()) {
  return render(
    <Header
      activePage="rooms"
      onNavigate={vi.fn()}
      theme={theme}
      onToggleTheme={onToggleTheme}
    />,
  )
}

describe('Header theme toggle', () => {
  it('shows moon icon and dark-mode label when theme is light', () => {
    renderHeader('light')
    const btn = screen.getByRole('button', { name: '다크 모드로 전환' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('🌙')
  })

  it('shows sun icon and light-mode label when theme is dark', () => {
    renderHeader('dark')
    const btn = screen.getByRole('button', { name: '라이트 모드로 전환' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('☀️')
  })

  it('calls onToggleTheme when the toggle button is clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    renderHeader('light', onToggle)
    await user.click(screen.getByRole('button', { name: '다크 모드로 전환' }))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
