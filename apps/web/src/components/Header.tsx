import type { Page } from '../App'

interface HeaderProps {
  activePage: Page
  onNavigate: (page: Page) => void
}

const navigation: Array<{ id: Page; label: string }> = [
  { id: 'rooms', label: 'Rooms' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'agent', label: 'Mini Agent' },
  { id: 'operations', label: 'Cloud Agent Ops' },
]

export function Header({ activePage, onNavigate }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="brand" type="button" onClick={() => onNavigate('rooms')}>
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>
            <strong>Atlas</strong>
            <small>Platform operations</small>
          </span>
        </button>
        <nav aria-label="Primary navigation">
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
        <div className="user-badge" aria-label="Signed in as Mina Park">
          <span className="status-dot" aria-hidden="true" />
          <span className="user-name">Mina Park</span>
          <strong aria-hidden="true">MP</strong>
        </div>
      </div>
    </header>
  )
}
