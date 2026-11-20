import { STATUS_LABEL } from '../../utils/constants.js'

export default function Header({ snap, darkTheme, onToggleTheme }) {
  const [label, tone] = STATUS_LABEL[snap?.mission?.status] || ['Idle', 'idle']
  return (
    <header>
      <h1>Security Team <span>Inspired from Digital mindscape</span></h1>
      <div className="header-actions">
        <div className={`chip ${tone}`}>{label}</div>
        <button
          className="theme-toggle"
          type="button"
          aria-pressed={darkTheme}
          aria-label={`Switch to ${darkTheme ? 'light' : 'dark'} theme`}
          onClick={onToggleTheme}
        >
          {darkTheme ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </header>
  )
}
