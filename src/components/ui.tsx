import type { ReactNode } from 'react';
import { useNav } from '../lib/nav';

export function Button({ children, onClick, variant = '', disabled, small }: { children: ReactNode; onClick?: () => void; variant?: '' | 'secondary' | 'soft' | 'coral' | 'ghost'; disabled?: boolean; small?: boolean }) {
  return (
    <button className={`btn ${variant} ${small ? 'small' : ''}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Choice({ label, sub, on, onClick }: { label: string; sub?: string; on?: boolean; onClick: () => void }) {
  return (
    <button className={`choice ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={!!on}>
      {label}
      {sub && <span className="sub">{sub}</span>}
    </button>
  );
}

export function Chip({ label, on, onClick }: { label: string; on?: boolean; onClick: () => void }) {
  return (
    <button className={`chip ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={!!on}>
      {label}
    </button>
  );
}

export function BackBar({ title, onBack }: { title?: string; onBack?: () => void }) {
  const nav = useNav();
  return (
    <div className="topbar">
      <button className="back" aria-label="Voltar" onClick={onBack ?? nav.pop}>←</button>
      <span className="tiny">{title}</span>
      <span style={{ width: 44 }} />
    </div>
  );
}

/** Tela cheia sobre a navegação (fluxos). */
export function Screen({ children, title, onBack, noBack }: { children: ReactNode; title?: string; onBack?: () => void; noBack?: boolean }) {
  return (
    <div className="scroll no-nav fade">
      <div className="layer">
        {!noBack && <BackBar title={title} onBack={onBack} />}
        {children}
      </div>
    </div>
  );
}

export function Confidence({ level }: { level: 'low' | 'medium' | 'high' }) {
  const t = { low: 'Em observação', medium: 'Padrão provável', high: 'Padrão consistente' }[level];
  return <span className={`pill ${level}`}>{t}</span>;
}

export function Learning({ text = 'Ainda estamos aprendendo.', action, onAction }: { text?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="card yellow stack">
      <p style={{ fontWeight: 650 }}>{text}</p>
      {action && onAction && <Button variant="secondary" onClick={onAction}>{action}</Button>}
    </div>
  );
}

export function Chain({ nodes, loop }: { nodes: string[]; loop?: boolean }) {
  return (
    <div className={`chain ${loop ? 'loop' : ''}`}>
      {nodes.map((n, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <div className="node">{n}</div>
          {i < nodes.length - 1 && <div className="arrow">↓</div>}
        </div>
      ))}
    </div>
  );
}
