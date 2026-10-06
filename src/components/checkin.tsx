import { useState } from 'react';
import { MOODS, CHECKIN_TRIGGERS, TRIGGER_CATALOG, THOUGHT_SUGGESTIONS } from '../data/content';
import type { AppState, Mood } from '../types';
import { Chip } from './ui';
import { detectRisk } from '../engine/safety';

export function MoodSelector({ value, onSelect }: { value?: Mood | null; onSelect: (m: Mood) => void }) {
  return (
    <div className="moods" role="group" aria-label="Como você está agora?">
      {MOODS.map((m) => (
        <button key={m.value} className={`mood ${value === m.value ? 'on' : ''}`} onClick={() => onSelect(m.value)}>
          <span className="e" aria-hidden>{m.emoji}</span>
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** "Outro" abre texto livre opcional. O texto passa pela detecção de segurança. */
function OtherInput({ onSubmit, onRisk, placeholder }: { onSubmit: (t: string) => void; onRisk: () => void; placeholder: string }) {
  const [t, setT] = useState('');
  return (
    <div className="stack fade">
      <input className="field" autoFocus value={t} onChange={(e) => setT(e.target.value)} placeholder={placeholder} maxLength={140} />
      <button
        className="btn"
        disabled={!t.trim()}
        onClick={() => (detectRisk(t) ? onRisk() : onSubmit(t.trim()))}
      >
        Continuar
      </button>
    </div>
  );
}

export function TriggerSelector({ onPick, onRisk }: { onPick: (id: string | null, custom?: string) => void; onRisk: () => void }) {
  const [other, setOther] = useState(false);
  if (other) return <OtherInput placeholder="Em poucas palavras" onRisk={onRisk} onSubmit={(t) => onPick(null, t)} />;
  return (
    <div className="stack">
      {CHECKIN_TRIGGERS.map((id) => (
        <button key={id} className="choice" onClick={() => onPick(id)}>
          {TRIGGER_CATALOG.find((t) => t.id === id)!.name}
        </button>
      ))}
      <button className="choice" onClick={() => setOther(true)}>Outro</button>
      <button className="link" onClick={onRisk}>Me senti ameaçado(a) ou em risco</button>
    </div>
  );
}

export function ThoughtSelector({ st, onPick, onRisk }: { st: AppState; onPick: (t: string | null) => void; onRisk: () => void }) {
  const [other, setOther] = useState(false);
  if (other) return <OtherInput placeholder="O que passou pela sua cabeça?" onRisk={onRisk} onSubmit={onPick} />;
  // sugestões baseadas no histórico: pensamentos já registrados, mais frequentes primeiro
  const mine = [...st.thoughts].sort((a, b) => b.occurrence_count - a.occurrence_count).map((t) => t.content);
  const list = [...new Set([...mine, ...THOUGHT_SUGGESTIONS])].slice(0, 7);
  return (
    <div className="stack">
      {list.map((t, i) => (
        <button key={t} className="choice" onClick={() => onPick(t)}>
          {t}
          {i < mine.length && i < 3 && mine.length > 0 && st.thoughts.find((x) => x.content === t)!.occurrence_count >= 2 && (
            <span className="sub">Já apareceu {st.thoughts.find((x) => x.content === t)!.occurrence_count} vezes</span>
          )}
        </button>
      ))}
      <button className="choice" onClick={() => setOther(true)}>Outro</button>
      <button className="link" onClick={() => onPick(null)}>Pular</button>
    </div>
  );
}

export function UrgeSlider({ value, onChange, label = '0 = nenhuma · 10 = muito forte' }: { value: number; onChange: (n: number) => void; label?: string }) {
  return (
    <div className="slider-wrap">
      <div className="slider-val" aria-live="polite">{value}</div>
      <input type="range" min={0} max={10} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label="Intensidade da urgência de zero a dez" />
      <div className="slider-scale"><span>Quase nada</span><span>{label.includes('·') ? '' : ''}Muito forte</span></div>
    </div>
  );
}

export function QuickPick({ options, onPick }: { options: { v: string; l: string }[]; onPick: (v: string) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <Chip key={o.v} label={o.l} onClick={() => onPick(o.v)} />
      ))}
    </div>
  );
}
