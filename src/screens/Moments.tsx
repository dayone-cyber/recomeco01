import { useEffect } from 'react';
import { useAppState } from '../lib/store';
import { useNav } from '../lib/nav';
import { track } from '../lib/analytics';
import { pushFlag, setFlag } from '../lib/actions';
import { weeklySummary } from '../engine/weekly';
import { discoverPattern } from '../engine/pattern';
import { currentPhase } from '../engine/recommend';
import { WeeklySummaryCard } from '../components/cards';
import { Button, Chain, Screen } from '../components/ui';
import { isoWeekKey, fmtNum, avg } from '../lib/time';
import { episodes, mode, thoughtText, triggerName } from '../engine/stats';
import { PHASES } from '../data/content';

export function Weekly() {
  const st = useAppState();
  const nav = useNav();
  const now = new Date();
  const w = weeklySummary(st, now);
  useEffect(() => track('weekly_summary_viewed'), []);
  return (
    <Screen title="Resumo semanal">
      <div className="stack-lg">
        <h1>Sua semana</h1>
        {w.episodeCount === 0 && <div className="card yellow"><p style={{ fontWeight: 650 }}>Semana sem crises registradas. Isso também é um dado — e o que te ajudou a chegar aqui vale ser lembrado.</p></div>}
        <WeeklySummaryCard w={w} />
        <Button onClick={() => { pushFlag('weekly_viewed', isoWeekKey(now)); nav.home(); }}>Começar a semana com esse foco</Button>
      </div>
    </Screen>
  );
}

export function PatternScreen() {
  const st = useAppState();
  const nav = useNav();
  const p = discoverPattern(st);
  if (!p) return <Screen title="Padrão"><p className="muted">Ainda estamos aprendendo esse padrão.</p></Screen>;
  return (
    <Screen title="Padrão">
      <div className="stack-lg">
        <span className="tiny">Descobrimos um padrão</span>
        <h1>{p.title}</h1>
        <p className="muted" style={{ fontSize: 18 }}>{p.body}</p>
        <Chain nodes={p.chain} loop />
        <div className="card lilac stack"><span className="tiny" style={{ color: 'var(--ink-2)' }}>A mudança mais útil agora</span><h2>{p.focus}</h2></div>
        <Button onClick={() => { pushFlag('patterns_seen', p.id); nav.replace('practice', { phase: p.focusPhase }); }}>{p.cta}</Button>
        <Button variant="ghost" onClick={() => { pushFlag('patterns_seen', p.id); nav.pop(); }}>Depois</Button>
      </div>
    </Screen>
  );
}

/** Dia 22: o acompanhamento continua, agora personalizado. */
export function Day22() {
  const st = useAppState();
  const nav = useNav();
  const now = new Date();
  useEffect(() => track('day22_viewed'), []);
  const eps = episodes(st);
  const trig = mode(eps.map((e) => e.trigger_id!));
  const th = mode(eps.map((e) => e.automatic_thought_id).filter(Boolean) as string[]);
  const hours = mode(eps.map((e) => new Date(e.timestamp).getHours()));
  const phase = PHASES[currentPhase(st, now) - 1];
  const u = avg(eps.map((e) => e.urge_before).filter((x): x is number => x != null));
  const learned: [string, string | null][] = [
    ['Gatilho principal', trig ? triggerName(st, trig.value) : null],
    ['Pensamento recorrente', th ? `“${thoughtText(st, th.value)}”` : null],
    ['Horário de maior risco', hours && eps.length >= 4 ? `por volta das ${hours.value}h` : null],
    ['Urgência média', u != null ? fmtNum(u) : null],
    ['Episódios registrados', String(eps.length)],
  ];
  return (
    <Screen noBack>
      <div className="stack-lg">
        <div className="stack">
          <span className="tiny">Dia 22</span>
          <h1>Os 21 dias acabaram. O acompanhamento não.</h1>
          <p className="muted" style={{ fontSize: 18 }}>Agora o Recomeço conhece melhor seus gatilhos, horários de risco, pensamentos recorrentes e quais estratégias costumam funcionar para você.</p>
        </div>
        <div className="card stack">{learned.map(([k, v]) => <div key={k} className="kv"><span className="muted">{k}</span><b>{v ?? 'Ainda aprendendo'}</b></div>)}</div>
        <div className="stack">
          {[['Monitoramento de padrões', 'Continua aprendendo com novos episódios.'], ['SOS personalizado', 'Usa seu histórico na hora crítica.'], ['Etapas adaptativas', 'Retoma um treino quando um padrão antigo reaparece.']].map(([t, d]) => (
            <div key={t} className="card"><b>{t}</b><p className="small muted">{d}</p></div>
          ))}
        </div>
        <div className="card lilac stack"><span className="tiny" style={{ color: 'var(--ink-2)' }}>Novo foco</span><h2>{phase.user}.</h2>
          <p className="muted">{st.profile!.primary_goal === 'reconnect' ? 'Seu ciclo está se organizando, mas o contato inesperado ainda pede atenção a limites e reciprocidade.' : 'O seu ciclo está menos intenso, mas um contato inesperado ainda pode aumentar sua urgência.'}</p></div>
        <Button onClick={() => { setFlag('day22_seen', true); nav.home(); }}>Continuar meu acompanhamento</Button>
        <p className="muted" style={{ textAlign: 'center', fontWeight: 650 }}>A jornada não zera. Ela fica mais personalizada.</p>
      </div>
    </Screen>
  );
}
