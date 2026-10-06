import type { Boundary, Insight } from '../types';
import type { NextAction } from '../engine/recommend';
import type { ProgressData } from '../engine/progress';
import type { WeeklySummary as WS } from '../engine/weekly';
import { PHASES } from '../data/content';
import { Button, Confidence } from './ui';
import { fmtNum } from '../lib/time';

export function TodayFocusCard({ action, onGo }: { action: NextAction; onGo: () => void }) {
  return (
    <div className="card lilac focus stack">
      <span className="tiny" style={{ color: 'var(--ink-2)' }}>Seu foco agora</span>
      <div>
        <span className="phase">{action.label}</span>
        <h2>{action.title}</h2>
      </div>
      <p className="muted">{action.context}</p>
      <Button onClick={onGo}>{action.cta}</Button>
      <p className="small muted" style={{ textAlign: 'center' }}>{action.minutes} min</p>
    </div>
  );
}

export function PersonalInsight({ insight, onOpen }: { insight: Insight; onOpen?: () => void }) {
  return (
    <div className="card stack" onClick={onOpen} role={onOpen ? 'button' : undefined}>
      <div className="row between"><span className="tiny">{insight.title}</span><Confidence level={insight.confidence} /></div>
      <p style={{ fontWeight: 600 }}>{insight.description}</p>
    </div>
  );
}

export function BoundaryCard({ boundary, prompt, onKeep, onBreak }: { boundary: Boundary; prompt?: boolean; onKeep?: () => void; onBreak?: () => void }) {
  return (
    <div className="card yellow stack">
      <span className="tiny">Um limite seu</span>
      {prompt && <p className="small">Você definiu este limite quando estava pensando com mais calma.</p>}
      <p style={{ fontWeight: 700, fontSize: 18 }}>“{boundary.description}”</p>
      {prompt ? (
        <>
          <p style={{ fontWeight: 650 }}>Quer mantê-lo hoje?</p>
          <div className="row"><Button small onClick={onKeep}>Sim, manter</Button><Button small variant="secondary" onClick={onBreak}>Hoje não</Button></div>
        </>
      ) : (
        <p className="small muted">Mantido {boundary.respected_count}× · Quebrado {boundary.broken_count}×</p>
      )}
    </div>
  );
}

export function BehaviorProgress({ data }: { data: ProgressData }) {
  const max = Math.max(10, ...data.weeklyUrge.map((w) => w.value ?? 0));
  return (
    <div className="stack">
      <div className="card stack">
        <span className="tiny">Checagens de WhatsApp / redes</span>
        {data.checks.now != null ? (
          <>
            <div className="row between"><span className="muted">Antes: {fmtNum(data.checks.before, 0)}/dia</span><span className="muted">Agora: {fmtNum(data.checks.now, 0)}/dia</span></div>
            <div className="big" style={{ color: (data.checks.pct ?? 0) <= 0 ? 'var(--green-ink)' : 'var(--danger)' }}>{data.checks.pct! > 0 ? '+' : '−'}{Math.abs(data.checks.pct!)}%</div>
          </>
        ) : (
          <p className="muted">Ainda estamos aprendendo. Registre o fechamento do dia por 2 dias para comparar com o seu ponto de partida ({fmtNum(data.checks.before, 0)}/dia).</p>
        )}
      </div>
      <div className="row" style={{ alignItems: 'stretch' }}>
        <div className="card green stack" style={{ flex: 1 }}>
          <span className="tiny">Urgências atravessadas</span>
          <div className="big">{data.crossed}</div>
          <p className="small">sem agir no pico</p>
        </div>
        <div className="card coral stack" style={{ flex: 1 }}>
          <span className="tiny">Planos protegidos</span>
          <div className="big">{data.plansProtected}</div>
          <p className="small">que você manteve</p>
        </div>
      </div>
      <div className="card stack">
        <span className="tiny">Urgência média por semana</span>
        {data.weeklyUrge.some((w) => w.value != null) ? (
          <div className="bars">
            {data.weeklyUrge.map((w) => (
              <div key={w.label} className={`b ${w.value == null ? 'none' : ''}`}>
                <span>{w.value != null ? fmtNum(w.value) : '–'}</span>
                <i style={{ height: `${w.value != null ? (w.value / max) * 100 : 6}%` }} />
                <span className="small muted">{w.label.replace('Semana ', 'S')}</span>
              </div>
            ))}
          </div>
        ) : <p className="muted">Ainda estamos aprendendo. São necessários alguns episódios por semana.</p>}
      </div>
    </div>
  );
}

export function WeeklySummaryCard({ w }: { w: WS }) {
  const rows: [string, string | null][] = [
    ['O que mais te ativou', w.topTrigger],
    ['Pensamento mais recorrente', w.topThought ? `“${w.topThought}”` : null],
    ['Urgência média', w.avgUrge],
    ['Estratégia que mais ajudou', w.bestStrategy],
    ['Uma mudança observada', w.change],
    ['Próximo foco', w.nextFocus],
  ];
  return (
    <div className="card stack">
      {rows.map(([k, v]) => (
        <div key={k} className="kv"><span className="muted">{k}</span><b style={{ textAlign: 'right' }}>{v ?? 'Ainda aprendendo'}</b></div>
      ))}
    </div>
  );
}

export function JourneyStage({ phase, state, here, detour, count, onOpen }: { phase: number; state: 'done' | 'here' | 'todo'; here?: boolean; detour?: boolean; count: number; onOpen: () => void }) {
  const ph = PHASES[phase - 1];
  return (
    <div className={`stage ${state}`}>
      <div className="dot">{state === 'done' ? '✓' : state === 'here' ? '●' : '○'}</div>
      <div className="body stack" style={{ gap: 6 }}>
        {here && <span className="here-tag">VOCÊ ESTÁ AQUI{detour ? ' · ↺ retomando Pausar' : ''}</span>}
        <h3>{ph.name} <span className="muted small" style={{ fontWeight: 500 }}>· {ph.user}</span></h3>
        <p className="small muted">{ph.blurb}</p>
        <p className="small muted">{count > 0 ? `${count} ${count === 1 ? 'prática' : 'práticas'}` : 'Ainda não explorada'}</p>
        <div><Button small variant={here ? '' : 'secondary'} onClick={onOpen}>{count > 0 ? 'Praticar de novo' : 'Começar'}</Button></div>
      </div>
    </div>
  );
}
