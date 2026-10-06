import { useState } from 'react';
import { useAppState } from '../lib/store';
import { useNav } from '../lib/nav';
import { PHASES, ACTIVITY_CATEGORIES, BOUNDARY_TEMPLATES, EARLY_SIGNS, TRIGGER_CATALOG } from '../data/content';
import {
  addActivity, addBoundary, addPrediction, completeActivity, logDay, mapEpisodePractice, recordCheckIn,
  resolveBoundary, resolvePrediction, saveRelapsePlan, toggleBoundary, updateCheckIn,
} from '../lib/actions';
import { Button, Chip, Screen } from '../components/ui';
import { ThoughtSelector, TriggerSelector, UrgeSlider } from '../components/checkin';
import { PauseIntervention } from '../components/PauseIntervention';
import { BoundaryCard } from '../components/cards';
import { episodes, mode } from '../engine/stats';
import { bestPauseMinutes } from '../engine/recommend';
import { detectRisk } from '../engine/safety';
import type { BoundaryCategory, PhaseId } from '../types';

export function Practice({ phase, resolve }: { phase: PhaseId; resolve?: boolean }) {
  const st = useAppState();
  switch (phase) {
    case 1: return <MapPractice />;
    case 2: {
      const top = mode(episodes(st).map((e) => e.trigger_id!));
      return <PauseIntervention triggerId={top?.value ?? null} source="practice" minutes={bestPauseMinutes(st) ?? 10} />;
    }
    case 3: return <TestPractice resolve={resolve} />;
    case 4: return <RetakePractice />;
    case 5: return <BoundaryPractice />;
    case 6: return <SustainPractice />;
  }
}

function Intro({ phase, children }: { phase: PhaseId; children?: React.ReactNode }) {
  const ph = PHASES[phase - 1];
  return (
    <div className="stack">
      <span className="tiny">Fase {phase} · {ph.name}</span>
      {children}
    </div>
  );
}

/* ---- Fase 1 · Entender ---- */
function MapPractice() {
  const st = useAppState();
  const nav = useNav();
  const [step, setStep] = useState(0);
  const [trigger, setTrigger] = useState<{ id: string | null; custom?: string }>({ id: null });
  const [thought, setThought] = useState<string | null>(null);
  const [urge, setUrge] = useState(6);
  const [behavior, setBehavior] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const risk = () => nav.replace('crisis');
  const back = () => (step === 0 ? nav.pop() : setStep(step - 1));

  const finish = () => {
    const id = recordCheckIn({ mood: 'anxious', triggerId: trigger.id, customTrigger: trigger.custom ?? null, thought, urge, source: 'practice' });
    updateCheckIn(id, { action_taken: behavior === 'wait' ? 'waited' : behavior === 'check' ? 'none' : 'acted' });
    if (behavior === 'cancel') logDay({ plans_cancelled: 1 });
    mapEpisodePractice();
    nav.say('Episódio mapeado. Seu ciclo ficou um pouco mais claro.');
    nav.home();
  };

  const behaviors = [['wait', 'Esperei'], ['check', 'Chequei WhatsApp/redes'], ['message', 'Mandei mensagem'], ['search', 'Procurei a pessoa'], ['cancel', 'Cancelei um plano meu']];
  const afters = ['Alívio rápido', 'Esperança de que dê certo', 'Culpa ou arrependimento', 'Mais ansiedade depois', 'Aceitei algo que não queria', 'Nada de especial'];

  return (
    <Screen title="Entender" onBack={back}>
      <div className="stack-lg">
        {step === 0 && <><Intro phase={1}><h1>Pense num episódio recente. O que desencadeou?</h1></Intro><TriggerSelector onRisk={risk} onPick={(id, custom) => { setTrigger({ id, custom }); setStep(1); }} /></>}
        {step === 1 && <><h1>Qual pensamento veio primeiro?</h1><ThoughtSelector st={st} onRisk={risk} onPick={(t) => { setThought(t); setStep(2); }} /></>}
        {step === 2 && <><h1>Qual era a vontade de agir na hora?</h1><UrgeSlider value={urge} onChange={setUrge} /><Button onClick={() => setStep(3)}>Continuar</Button></>}
        {step === 3 && (
          <>
            <h1>O que você fez — e o que veio depois?</h1>
            <div className="stack"><span className="tiny">O que fiz</span><div className="chips">{behaviors.map(([v, l]) => <Chip key={v} label={l} on={behavior === v} onClick={() => setBehavior(v)} />)}</div></div>
            <div className="stack"><span className="tiny">Depois</span><div className="chips">{afters.map((l) => <Chip key={l} label={l} on={after === l} onClick={() => setAfter(l)} />)}</div></div>
            <Button disabled={!behavior || !after} onClick={finish}>Salvar episódio</Button>
          </>
        )}
        {trigger.id && step > 0 && <p className="small muted">Gatilho: {TRIGGER_CATALOG.find((t) => t.id === trigger.id)?.name}</p>}
      </div>
    </Screen>
  );
}

/* ---- Fase 3 · Testar ---- */
const PREDICTIONS = ['Vou perder a pessoa', 'A pessoa vai se afastar de vez', 'Vou me sentir insuportável', 'Vai acontecer algo ruim'];

function TestPractice({ resolve }: { resolve?: boolean }) {
  const st = useAppState();
  const nav = useNav();
  const pending = st.predictions.filter((p) => !p.outcome);
  const [step, setStep] = useState(resolve && pending.length ? 'resolve' : 'thought');
  const [thought, setThought] = useState('');
  const [prediction, setPrediction] = useState('');
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState('');
  const risk = () => nav.replace('crisis');
  const done = st.predictions.filter((p) => p.outcome);
  const notHappened = done.filter((p) => p.outcome === 'not_happened').length;

  if (step === 'resolve') {
    const p = pending[0];
    return (
      <Screen title="Testar">
        <div className="stack-lg">
          <h1>O que realmente aconteceu?</h1>
          <div className="card lilac stack"><span className="tiny">Sua previsão</span><p style={{ fontWeight: 700 }}>“{p.prediction}”</p><p className="small muted">Você escolheu {p.behavior === 'waited' ? 'esperar' : 'agir como sempre'}.</p></div>
          {[['as_predicted', 'Aconteceu como eu previ'], ['partly', 'Aconteceu em parte'], ['not_happened', 'Não aconteceu']].map(([v, l]) => (
            <button key={v} className="choice" onClick={() => { resolvePrediction(p.id, v as 'partly'); nav.say('Previsão × realidade registrada.'); nav.home(); }}>{l}</button>
          ))}
        </div>
      </Screen>
    );
  }
  if (step === 'thought') {
    return (
      <Screen title="Testar">
        <div className="stack-lg">
          <Intro phase={3}><h1>Qual pensamento você quer testar?</h1><p className="muted">Pensamentos automáticos parecem fatos. Aqui eles viram hipóteses.</p></Intro>
          {done.length > 0 && <div className="card green"><p style={{ fontWeight: 650 }}>{notHappened} de {done.length} {done.length === 1 ? 'previsão não se confirmou' : 'previsões não se confirmaram'} até agora.</p></div>}
          <ThoughtSelector st={st} onRisk={risk} onPick={(t) => { setThought(t ?? 'Pensamento recorrente'); setStep('prediction'); }} />
        </div>
      </Screen>
    );
  }
  if (step === 'prediction') {
    return (
      <Screen title="Testar" onBack={() => setStep('thought')}>
        <div className="stack-lg">
          <h1>Se você não agir no impulso, o que prevê que vai acontecer?</h1>
          {!custom ? (
            <div className="stack">
              {PREDICTIONS.map((p) => <button key={p} className="choice" onClick={() => { setPrediction(p); setStep('behavior'); }}>{p}</button>)}
              <button className="choice" onClick={() => setCustom(true)}>Outra previsão</button>
            </div>
          ) : (
            <div className="stack"><input className="field" autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={140} placeholder="Minha previsão" />
              <Button disabled={!text.trim()} onClick={() => (detectRisk(text) ? risk() : (setPrediction(text.trim()), setStep('behavior')))}>Continuar</Button></div>
          )}
        </div>
      </Screen>
    );
  }
  return (
    <Screen title="Testar" onBack={() => setStep('prediction')}>
      <div className="stack-lg">
        <h1>Qual comportamento você vai escolher?</h1>
        <p className="muted">Previsão: “{prediction}”</p>
        <button className="choice" onClick={() => { addPrediction(thought, prediction, 'waited'); nav.say('Teste criado. Volte depois para comparar com a realidade.'); nav.home(); }}>Esperar pelo menos uma hora antes de agir<span className="sub">É o experimento mais informativo.</span></button>
        <button className="choice" onClick={() => { addPrediction(thought, prediction, 'acted'); nav.say('Teste criado. Volte depois para comparar com a realidade.'); nav.home(); }}>Agir como de costume<span className="sub">Serve como ponto de comparação.</span></button>
      </div>
    </Screen>
  );
}

/* ---- Fase 4 · Retomar ---- */
function RetakePractice() {
  const st = useAppState();
  const nav = useNav();
  const [cat, setCat] = useState<string | null>(null);
  const [when, setWhen] = useState<'today' | 'tomorrow'>('today');
  const pending = st.activities.filter((a) => !a.done_at);
  return (
    <Screen title="Retomar">
      <div className="stack-lg">
        <Intro phase={4}><h1>Um passo seu, só seu.</h1><p className="muted">Não é para se distrair. É para reconstruir fontes próprias de prazer, rotina e identidade.</p></Intro>
        {pending.length > 0 && (
          <div className="card stack"><span className="tiny">Planejado</span>
            {pending.map((a) => (
              <div key={a.id} className="row between"><span style={{ fontWeight: 600 }}>{a.description} <span className="muted small">· {a.planned_for === 'today' ? 'hoje' : 'amanhã'}</span></span>
                <Button small variant="soft" onClick={() => { completeActivity(a.id); logDay({ plans_protected: 1 }); nav.say('Feito. Um plano seu mantido.'); }}>Fiz</Button></div>
            ))}
          </div>
        )}
        <div className="stack"><span className="tiny">O que você quer retomar?</span>
          <div className="stack">{ACTIVITY_CATEGORIES.map((c) => <button key={c.id} className={`choice ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.label}</button>)}</div></div>
        <div className="chips"><Chip label="Hoje" on={when === 'today'} onClick={() => setWhen('today')} /><Chip label="Amanhã" on={when === 'tomorrow'} onClick={() => setWhen('tomorrow')} /></div>
        <Button disabled={!cat} onClick={() => { addActivity(cat!, ACTIVITY_CATEGORIES.find((c) => c.id === cat)!.label, when); nav.say('Plano criado. Ele é seu, independente de qualquer resposta.'); nav.home(); }}>Combinar comigo mesmo(a)</Button>
      </div>
    </Screen>
  );
}

/* ---- Fase 5 · Limites ---- */
const CATS: [BoundaryCategory, string][] = [['plans', 'Planos'], ['messaging', 'Mensagens'], ['respect', 'Respeito'], ['meeting', 'Encontros'], ['social', 'Redes sociais'], ['other', 'Outro']];

export function BoundaryPractice() {
  const st = useAppState();
  const nav = useNav();
  const [text, setText] = useState('');
  const [cat, setCat] = useState<BoundaryCategory>('other');
  const review = st.boundaries.find((b) => b.active && b.broken_count > b.respected_count);
  const add = (t: string, c: BoundaryCategory) => {
    if (detectRisk(t)) return nav.replace('crisis');
    addBoundary(t, c);
    nav.say('Limite criado. Ele será lembrado quando o gatilho aparecer.');
    setText('');
  };
  return (
    <Screen title="Limites">
      <div className="stack-lg">
        <Intro phase={5}><h1>Decida agora, com calma, o que você não vai negociar no pico.</h1></Intro>
        {review && <BoundaryCard boundary={review} prompt onKeep={() => { resolveBoundary(review.id, true); nav.say('Mantido.'); }} onBreak={() => resolveBoundary(review.id, false)} />}
        <div className="stack"><span className="tiny">Sugestões</span>
          {BOUNDARY_TEMPLATES.filter((t) => !st.boundaries.some((b) => b.description === t.text)).map((t) => <button key={t.text} className="choice" onClick={() => add(t.text, t.category)}>{t.text}</button>)}</div>
        <div className="stack"><span className="tiny">Ou escreva o seu</span>
          <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Não vou…" maxLength={140} />
          <div className="chips">{CATS.map(([c, l]) => <Chip key={c} label={l} on={cat === c} onClick={() => setCat(c)} />)}</div>
          <Button disabled={!text.trim()} onClick={() => add(text.trim(), cat)}>Adicionar limite</Button></div>
        {st.boundaries.length > 0 && <div className="stack"><span className="tiny">Meus limites</span>{st.boundaries.map((b) => (
          <div key={b.id} className="stack"><BoundaryCard boundary={b} /><Button small variant="ghost" onClick={() => toggleBoundary(b.id)}>{b.active ? 'Pausar este limite' : 'Reativar'}</Button></div>))}</div>}
      </div>
    </Screen>
  );
}

/* ---- Fase 6 · Sustentar ---- */
const PLANS = ['Fazer uma pausa de 10 minutos', 'Falar com alguém de confiança', 'Reler meus limites', 'Sair para caminhar', 'Abrir o SOS'];

function SustainPractice() {
  const st = useAppState();
  const nav = useNav();
  const [signs, setSigns] = useState<string[]>(st.profile!.early_signs);
  const [plan, setPlan] = useState<string[]>(st.profile!.relapse_plan ? st.profile!.relapse_plan.split(' · ') : []);
  const tog = (xs: string[], set: (x: string[]) => void, v: string) => set(xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]);
  return (
    <Screen title="Sustentar">
      <div className="stack-lg">
        <Intro phase={6}><h1>Reconhecer cedo é mais fácil do que reverter tarde.</h1><p className="muted">Um episódio não é fracasso e nada volta ao zero. É um sinal para retomar uma estratégia.</p></Intro>
        <div className="stack"><span className="tiny">Meus sinais precoces</span><div className="chips">{EARLY_SIGNS.map((s) => <Chip key={s} label={s} on={signs.includes(s)} onClick={() => tog(signs, setSigns, s)} />)}</div></div>
        <div className="stack"><span className="tiny">Se eu notar isso, eu…</span><div className="chips">{PLANS.map((s) => <Chip key={s} label={s} on={plan.includes(s)} onClick={() => tog(plan, setPlan, s)} />)}</div></div>
        <Button disabled={!signs.length || !plan.length} onClick={() => { saveRelapsePlan(signs, plan.join(' · ')); nav.say('Plano de prevenção salvo.'); nav.home(); }}>Salvar meu plano</Button>
      </div>
    </Screen>
  );
}

/* ---- Fechamento do dia ---- */
export function CloseDay() {
  const nav = useNav();
  const [checks, setChecks] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<number | null>(null);
  const [kept, setKept] = useState(0);
  const [cancelled, setCancelled] = useState(0);
  const Row = ({ title, opts, val, set }: { title: string; opts: [string, number][]; val: number | null; set: (n: number) => void }) => (
    <div className="stack"><span className="tiny">{title}</span><div className="chips">{opts.map(([l, v]) => <Chip key={l} label={l} on={val === v} onClick={() => set(v)} />)}</div></div>
  );
  return (
    <Screen title="Fechamento do dia">
      <div className="stack-lg">
        <h1>Como foi o dia, em números rápidos?</h1>
        <Row title="Quantas vezes chequei WhatsApp/redes da pessoa" val={checks} set={setChecks} opts={[['0', 0], ['1–3', 2], ['4–7', 6], ['8–12', 10], ['13+', 15]]} />
        <Row title="Quantas vezes tentei contato" val={attempts} set={setAttempts} opts={[['0', 0], ['1', 1], ['2', 2], ['3+', 3]]} />
        <div className="stack"><span className="tiny">Planos</span>
          <div className="row"><Button small variant="soft" onClick={() => setKept(kept + 1)}>+ Mantive um plano ({kept})</Button><Button small variant="secondary" onClick={() => setCancelled(cancelled + 1)}>+ Cancelei ({cancelled})</Button></div></div>
        <Button disabled={checks == null || attempts == null} onClick={() => { logDay({ whatsapp_checks: checks!, contact_attempts: attempts!, plans_protected: kept, plans_cancelled: cancelled }); nav.say('Dia registrado.'); nav.home(); }}>Salvar</Button>
      </div>
    </Screen>
  );
}
