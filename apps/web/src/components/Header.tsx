import type { Page } from '../App'
import type { Theme } from '../useTheme'

interface HeaderProps {
  activePage: Page
  onNavigate: (page: Page) => void
  theme: Theme
  onToggleTheme: () => void
}

const navigation: Array<{ id: Page; label: string }> = [
  { id: 'rooms', label: '회의실' },
  { id: 'reservations', label: '예약' },
  { id: 'agent', label: '미니 에이전트' },
]

export function Header({ activePage, onNavigate, theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="brand" type="button" onClick={() => onNavigate('rooms')}>
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>
            <strong>아틀라스</strong>
            <small>플랫폼 운영</small>
          </span>
        </button>
        <nav aria-label="기본 탐색">
          <ul className="nav-list">
            {navigation.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={activePage === item.id ? 'nav-link active' : 'nav-link'}
                  aria-current={activePage === item.id ? 'page' : undefined}
                  onClick={() => onNavigate(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          className="theme-toggle icon-button"
          aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <div className="user-badge" aria-label="미나 박으로 로그인됨">
          <span className="status-dot" aria-hidden="true" />
          <span className="user-name">미나 박</span>
          <strong aria-hidden="true">MP</strong>
        </div>
      </div>
    </header>
  )
}
