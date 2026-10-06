import { useState } from 'react';
import { useAppState } from '../lib/store';
import { useNav } from '../lib/nav';
import { track } from '../lib/analytics';
import { recordCheckIn } from '../lib/actions';
import { decideAfterCheckIn, memoryLines } from '../engine/recommend';
import { MOOD_LABEL } from '../data/content';
import { Button, Screen } from '../components/ui';
import { ThoughtSelector, TriggerSelector, UrgeSlider } from '../components/checkin';
import type { Mood } from '../types';

type Step = 'what' | 'thought' | 'urge' | 'result';

/** Microfluxo de ~30s: o que aconteceu → pensamento → urgência → decisão do motor. */
export function CheckinFlow({ mood }: { mood: Mood }) {
  const st = useAppState();
  const nav = useNav();
  const [step, setStep] = useState<Step>('what');
  const [trigger, setTrigger] = useState<{ id: string | null; custom?: string } | null>(null);
  const [thought, setThought] = useState<string | null>(null);
  const [urge, setUrge] = useState(6);
  const [saved, setSaved] = useState<{ id: string; decision: ReturnType<typeof decideAfterCheckIn>; memory: string[]; triggerId: string | null } | null>(null);

  const risk = () => nav.replace('crisis');

  const save = () => {
    const triggerId = trigger?.id ?? null;
    // decisão e memória usam o histórico anterior a este check-in
    const decision = decideAfterCheckIn(st, triggerId, urge);
    const memory = memoryLines(st, triggerId);
    const id = recordCheckIn({ mood, triggerId, customTrigger: trigger?.custom ?? null, thought, urge });
    track('urge_recorded', { urge });
    track('checkin_completed', { mood, urge, decision: decision.decision });
    setSaved({ id, decision, memory, triggerId });
    setStep('result');
  };

  const stepBack = () => (step === 'what' ? nav.pop() : step === 'thought' ? setStep('what') : setStep('thought'));

  if (step === 'what') {
    return (
      <Screen title={`Check-in · ${MOOD_LABEL[mood]}`} onBack={stepBack}>
        <div className="stack-lg">
          <h1>O que aconteceu?</h1>
          <TriggerSelector
            onRisk={risk}
            onPick={(id, custom) => {
              setTrigger({ id, custom });
              track('trigger_selected', { trigger: id ?? 'custom' });
              setStep('thought');
            }}
          />
        </div>
      </Screen>
    );
  }
  if (step === 'thought') {
    return (
      <Screen title="Check-in" onBack={stepBack}>
        <div className="stack-lg">
          <h1>Qual pensamento apareceu primeiro?</h1>
          <ThoughtSelector st={st} onRisk={risk} onPick={(t) => { setThought(t); if (t) track('thought_selected'); setStep('urge'); }} />
        </div>
      </Screen>
    );
  }
  if (step === 'urge') {
    return (
      <Screen title="Check-in" onBack={stepBack}>
        <div className="stack-lg">
          <h1>Qual é a vontade de agir agora?</h1>
          <UrgeSlider value={urge} onChange={setUrge} />
          <Button onClick={save}>Registrar</Button>
        </div>
      </Screen>
    );
  }

  const d = saved!.decision.decision;
  const tid = saved!.triggerId;
  const goPause = (minutes?: number) => nav.replace('pause', { triggerId: tid, checkInId: saved!.id, urge, minutes, source: 'home' });
  return (
    <Screen noBack>
      <div className="stack-lg">
        <div className="stack">
          <h1>{d === 'record' ? 'Registrado.' : d === 'practice' ? 'Vamos criar um pouco de espaço.' : d === 'sos' ? 'Esse é um momento delicado.' : 'Não responda no pico.'}</h1>
          <p className="muted">
            {d === 'record' && 'A urgência está baixa. Cada registro ajuda o acompanhamento a conhecer o seu padrão.'}
            {d === 'practice' && 'A urgência está moderada. Uma pausa curta costuma ser suficiente.'}
            {(d === 'intervene' || d === 'sos') && 'A urgência parece uma ordem, mas funciona mais como uma onda. Primeiro vamos deixar ela baixar.'}
          </p>
        </div>
        {saved!.memory.length > 0 && (
          <div className="card lilac stack">
            <span className="tiny" style={{ color: 'var(--ink-2)' }}>Isso já aconteceu antes?</span>
            {saved!.memory.map((l, i) => <p key={i} style={{ fontWeight: 650 }}>{l}</p>)}
          </div>
        )}
        {d === 'record' ? (
          <Button onClick={nav.home}>Voltar para Hoje</Button>
        ) : (
          <>
            <Button onClick={() => goPause(d === 'practice' ? 3 : undefined)}>{d === 'practice' ? 'Fazer uma pausa de 3 min' : 'Vamos repetir?'}</Button>
            <Button variant="ghost" onClick={nav.home}>Agora não</Button>
          </>
        )}
      </div>
    </Screen>
  );
}
