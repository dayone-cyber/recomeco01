import { useEffect } from 'react';
import { useAppState } from '../lib/store';
import { useNav } from '../lib/nav';
import { track } from '../lib/analytics';
import { sosPlan } from '../engine/recommend';
import { SOSSelector } from '../components/SOSSelector';
import { BoundaryCard } from '../components/cards';
import { Button, Screen } from '../components/ui';
import { TRIGGER_CATALOG } from '../data/content';

/** SOS: nunca abre chat. Abre direto "O que aconteceu?" e devolve UMA ação. */
export function Sos() {
  const nav = useNav();
  useEffect(() => track('sos_opened'), []);
  return (
    <div className="scroll">
      <div className="blob b" />
      <div className="layer stack-lg">
        <div className="stack">
          <h1>O que aconteceu?</h1>
          <p className="muted">Toque no que está mais perto de agora. Vou buscar o que já sei sobre você.</p>
        </div>
        <SOSSelector onPick={(o) => { track('sos_reason_selected', { reason: o.id }); nav.push('sosplan', { triggerId: o.trigger }); }} />
        <button className="link" onClick={() => nav.push('crisis')}>Estou em risco ou com medo agora</button>
      </div>
    </div>
  );
}

export function SosPlan({ triggerId }: { triggerId: string }) {
  const st = useAppState();
  const nav = useNav();
  const plan = sosPlan(st, triggerId);
  const name = TRIGGER_CATALOG.find((t) => t.id === triggerId)!.name;
  return (
    <Screen title="SOS">
      <div className="stack-lg">
        <div className="stack">
          <span className="tiny">{name}</span>
          <h1>{plan.headline}</h1>
          <p style={{ fontSize: 19 }}>{plan.body}</p>
        </div>
        {plan.hasHistory ? (
          <div className="card lilac stack">
            <span className="tiny" style={{ color: 'var(--ink-2)' }}>Isso já aconteceu antes</span>
            {plan.facts.map((f, i) => <p key={i} style={{ fontWeight: 650 }}>{f}</p>)}
          </div>
        ) : (
          <div className="card yellow"><p style={{ fontWeight: 650 }}>Ainda estamos aprendendo esse gatilho. Esta pausa já ensina o app para a próxima vez.</p></div>
        )}
        {plan.boundary && <BoundaryCard boundary={plan.boundary} />}
        <Button onClick={() => nav.replace('pause', { triggerId, source: 'sos', minutes: plan.minutes, headline: plan.headline, intro: plan.body })}>{plan.cta}</Button>
        <p className="small muted" style={{ textAlign: 'center' }}>{plan.minutes} minutos · você escolhe depois o que fazer</p>
      </div>
    </Screen>
  );
}
