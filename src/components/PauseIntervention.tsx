import { useEffect, useRef, useState } from 'react';
import { useAppState } from '../lib/store';
import { useNav } from '../lib/nav';
import { track } from '../lib/analytics';
import { completeIntervention, recordCheckIn, resolveBoundary, startIntervention } from '../lib/actions';
import { memoryLines, relevantBoundary, bestPauseMinutes } from '../engine/recommend';
import { triggerHistory } from '../engine/stats';
import { Button, Screen } from './ui';
import { UrgeSlider } from './checkin';
import { BoundaryCard } from './cards';

interface Props {
  triggerId: string | null;
  checkInId?: string | null;
  urge?: number | null;
  minutes?: number;
  source: 'home' | 'sos' | 'practice';
  headline?: string;
  intro?: string;
}

type Step = 'urge0' | 'intro' | 'timer' | 'after' | 'did' | 'done';

const INSTRUCTIONS = [
  'Afaste o celular — de preferência para outro cômodo.',
  'Nomeie o pensamento: “estou tendo o pensamento de que…”.',
  'Não tente resolver a relação agora.',
  'Aguarde o pico diminuir. Respire devagar.',
  'Reavalie a decisão depois, não durante.',
];

export function PauseIntervention(p: Props) {
  const st = useAppState();
  const nav = useNav();
  const [step, setStep] = useState<Step>(p.urge != null ? 'intro' : 'urge0');
  const [urge0, setUrge0] = useState(p.urge ?? 7);
  const [urge1, setUrge1] = useState(4);
  const [acted, setActed] = useState<boolean | null>(null);
  const [boundaryDone, setBoundaryDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const ids = useRef<{ checkIn: string | null; intervention: string | null; started: number }>({ checkIn: p.checkInId ?? null, intervention: null, started: 0 });

  const hist = p.triggerId ? triggerHistory(st, p.triggerId, ids.current.checkIn ?? undefined) : null;
  const planned = p.minutes ?? hist?.bestMinutes ?? bestPauseMinutes(st) ?? 10;
  const speed = st.settings.demo_speed;
  const totalSec = Math.round((planned * 60) / speed);
  const boundary = p.triggerId ? relevantBoundary(st, p.triggerId) : null;
  const memory = memoryLines(st, p.triggerId, ids.current.checkIn ?? undefined);

  useEffect(() => {
    if (step === 'intro') track('intervention_shown', { type: 'pause', source: p.source });
  }, [step, p.source]);

  useEffect(() => {
    if (boundary && step === 'intro') track('boundary_prompt_shown', { category: boundary.category });
  }, [boundary?.id, step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== 'timer') return;
    const t = setInterval(() => {
      const e = Math.floor((Date.now() - ids.current.started) / 1000);
      setElapsed(e);
      if (e >= totalSec) {
        clearInterval(t);
        setStep('after');
      }
    }, 500);
    return () => clearInterval(t);
  }, [step, totalSec]);

  const begin = () => {
    if (!ids.current.checkIn) {
      ids.current.checkIn = recordCheckIn({ mood: 'impulse', triggerId: p.triggerId, urge: urge0, source: p.source });
    }
    ids.current.intervention = startIntervention('pause', p.triggerId, urge0, planned);
    ids.current.started = Date.now();
    setElapsed(0);
    setStep('timer');
  };

  const finish = (didAct: boolean) => {
    setActed(didAct);
    const realMs = Math.max(60_000, (Date.now() - ids.current.started) * speed);
    completeIntervention(
      ids.current.intervention!,
      ids.current.checkIn,
      urge1,
      didAct ? 'acted' : 'waited',
      new Date(ids.current.started + realMs).toISOString(),
    );
    setStep('done');
  };

  if (step === 'urge0') {
    return (
      <Screen title="Pausa">
        <div className="stack-lg">
          <h1>Qual é a vontade de agir agora?</h1>
          <UrgeSlider value={urge0} onChange={setUrge0} />
          <Button onClick={() => setStep('intro')}>Continuar</Button>
        </div>
      </Screen>
    );
  }

  if (step === 'intro') {
    return (
      <Screen title="Pausa">
        <div className="stack-lg">
          <div className="stack">
            <h1>{p.headline ?? 'Não responda no pico.'}</h1>
            <p className="muted">{p.intro ?? 'A urgência parece uma ordem, mas funciona mais como uma onda. Primeiro vamos deixar ela baixar.'}</p>
          </div>

          <div className="card lilac stack">
            <span className="tiny" style={{ color: 'var(--ink-2)' }}>O que o app lembra de você</span>
            {memory.length ? memory.map((l, i) => <p key={i} style={{ fontWeight: 650 }}>{l}</p>) : <p style={{ fontWeight: 650 }}>Ainda estamos aprendendo. Esta pausa já vai ensinar algo ao seu acompanhamento.</p>}
            {hist && hist.lastIntervention && hist.lastIntervention.urge_before != null && (
              <p className="small muted">Na última vez: {hist.lastIntervention.urge_before} → {hist.lastIntervention.urge_after}</p>
            )}
          </div>

          {boundary && !boundaryDone && (
            <BoundaryCard
              boundary={boundary}
              prompt
              onKeep={() => { resolveBoundary(boundary.id, true); setBoundaryDone(true); nav.say('Limite mantido. Isso conta.'); }}
              onBreak={() => { resolveBoundary(boundary.id, false); setBoundaryDone(true); }}
            />
          )}

          <ol className="steps">{INSTRUCTIONS.map((i) => <li key={i}>{i}</li>)}</ol>
          <Button onClick={begin}>Começar minha pausa</Button>
          <p className="small muted" style={{ textAlign: 'center' }}>{planned} minutos · você pode encerrar antes</p>
        </div>
      </Screen>
    );
  }

  if (step === 'timer') {
    const left = Math.max(0, totalSec - elapsed);
    const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
    return (
      <Screen noBack>
        <div className="stack-lg" style={{ textAlign: 'center', paddingTop: 24 }}>
          <h2>Deixe a onda baixar.</h2>
          <div className="breath" role="timer" aria-live="off">{mm}:{ss}</div>
          <p className="muted">Respire devagar. Você não precisa decidir nada agora.</p>
          <ol className="steps" style={{ textAlign: 'left' }}>{INSTRUCTIONS.slice(0, 3).map((i) => <li key={i}>{i}</li>)}</ol>
          <Button variant="secondary" onClick={() => setStep('after')}>Encerrar mais cedo</Button>
        </div>
      </Screen>
    );
  }

  if (step === 'after') {
    return (
      <Screen noBack>
        <div className="stack-lg">
          <h1>Como está a urgência agora?</h1>
          <UrgeSlider value={urge1} onChange={setUrge1} />
          <Button onClick={() => setStep('did')}>Continuar</Button>
        </div>
      </Screen>
    );
  }

  if (step === 'did') {
    return (
      <Screen noBack>
        <div className="stack-lg">
          <h1>E o que você fez?</h1>
          <p className="muted">Qualquer resposta é informação útil. Nada aqui reinicia seu progresso.</p>
          <div className="stack">
            <button className="choice" onClick={() => finish(false)}>Não agi no impulso<span className="sub">Esperei, adiei ou decidi diferente.</span></button>
            <button className="choice" onClick={() => finish(true)}>Acabei agindo<span className="sub">Respondi, procurei ou chequei.</span></button>
          </div>
        </div>
      </Screen>
    );
  }

  const drop = urge0 - urge1;
  return (
    <Screen noBack>
      <div className="stack-lg">
        {acted ? (
          <>
            <h1>Isso é informação, não retrocesso.</h1>
            <p className="muted">Você já atravessou antes e seus registros continuam aqui. Vamos usar o que aconteceu para ajustar o próximo passo.</p>
            <div className="card coral stack">
              <span className="tiny">O que registramos</span>
              <p style={{ fontWeight: 700 }}>Urgência {urge0} → {urge1}, e você agiu no impulso.</p>
              <p className="small">A etapa Pausar volta a ter prioridade por um tempo. Depois, você retoma de onde estava.</p>
            </div>
          </>
        ) : (
          <>
            <h1>{drop >= 2 ? 'A onda baixou.' : 'Você criou espaço.'}</h1>
            <div className="card green stack">
              <span className="tiny">Antes → depois</span>
              <div className="big">{urge0} → {urge1}</div>
              <p className="small">{drop >= 2 ? `A urgência caiu ${drop} pontos sem você agir no pico. O app guardou isso para a próxima vez.` : 'A urgência ainda não caiu muito, mas você não agiu no pico. Isso também ensina o app.'}</p>
            </div>
            {urge1 >= 7 && <p className="muted">A urgência ainda está alta. Quer mais alguns minutos antes de decidir?</p>}
          </>
        )}
        {!acted && urge1 >= 7 && <Button variant="soft" onClick={() => { setStep('intro'); setUrge0(urge1); ids.current.checkIn = null; }}>Mais uma pausa</Button>}
        <Button onClick={nav.home}>Voltar para Hoje</Button>
      </div>
    </Screen>
  );
}
