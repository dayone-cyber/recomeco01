import type { ReactNode } from 'react';
import { useNav, type Tab } from '../lib/nav';

const ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Hoje', icon: '◐' },
  { id: 'journey', label: 'Jornada', icon: '⌇' },
  { id: 'sos', label: 'SOS', icon: '' },
  { id: 'progress', label: 'Progresso', icon: '↗' },
];

export function BottomNavigation() {
  const nav = useNav();
  return (
    <nav className="nav" aria-label="Navegação principal">
      {ITEMS.map((it) =>
        it.id === 'sos' ? (
          <button key={it.id} className={`sos ${nav.tab === 'sos' ? 'on' : ''}`} onClick={() => nav.setTab('sos')} aria-label="SOS">
            <span className="btn-sos">SOS</span>
          </button>
        ) : (
          <button key={it.id} className={nav.tab === it.id ? 'on' : ''} onClick={() => nav.setTab(it.id)} aria-current={nav.tab === it.id ? 'page' : undefined}>
            <span className="ico" aria-hidden>{it.icon}</span>
            {it.label}
          </button>
        ),
      )}
    </nav>
  );
}

export function AppShell({ children, showNav }: { children: ReactNode; showNav: boolean }) {
  const nav = useNav();
  return (
    <div className="app">
      {children}
      {showNav && <BottomNavigation />}
      {nav.toast && <div className="toast" role="status">{nav.toast}</div>}
    </div>
  );
}
