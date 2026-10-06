import { useEffect, useState } from 'react';
import { useAppState } from '../lib/store';
import { createAccount, saveOnboarding } from '../lib/actions';
import { track } from '../lib/analytics';
import { fetchRemoteConfig, defaultRemoteConfig } from '../lib/remoteConfig';
import { Button, Chain, Choice } from '../components/ui';
import { buildFormulation, profileFromAnswers } from '../engine/formulation';
import {
  AGE_RANGES, BEHAVIORS, BOUNDARY_DIFF, CHECKING, DISTANCING, GOALS, ROUTINE_IMPACT, SITUATIONS, THOUGHT_LOAD,
  type Choice as C,
} from '../data/content';
import type { OnboardingAnswers } from '../types';

type Q =
  | { key: keyof OnboardingAnswers; kind: 'single'; title: string; options: C<string>[] }
  | { key: 'relief_score'; kind: 'scale'; title: string }
  | { key: 'main_behaviors'; kind: 'multi'; title: string; options: C<string>[]; max: number };

const QUESTIONS: Q[] = [
  { key: 'primary_goal', kind: 'single', title: 'O que você mais gostaria de recuperar agora?', options: GOALS },
  { key: 'age_range', kind: 'single', title: 'Qual é a sua idade?', options: AGE_RANGES.map((a) => ({ value: a, label: a })) },
  { key: 'relationship_status', kind: 'single', title: 'Qual dessas situações parece mais com a sua?', options: SITUATIONS },
  { key: 'distancing_history', kind: 'single', title: 'Você já tentou se afastar?', options: DISTANCING },
  { key: 'thought_load', kind: 'single', title: 'Quanto essa pessoa ocupa seus pensamentos?', options: THOUGHT_LOAD },
  { key: 'check_frequency', kind: 'single', title: 'Quando você está esperando uma resposta, quantas vezes acaba verificando WhatsApp ou redes?', options: CHECKING },
  { key: 'relief_score', kind: 'scale', title: 'Quando essa pessoa aparece depois de sumir, quanto alívio você sente?' },
  { key: 'boundary_difficulty', kind: 'single', title: 'Por medo de perder essa pessoa, você acaba aceitando coisas que normalmente não aceitaria?', options: BOUNDARY_DIFF },
  { key: 'routine_impact', kind: 'single', title: 'Quanto essa situação está afetando sua rotina?', options: ROUTINE_IMPACT },
  { key: 'main_behaviors', kind: 'multi', max: 2, title: 'Quando sente que pode perder essa pessoa, o que você costuma fazer?', options: BEHAVIORS },
];

type Stage = 'intro' | 'q' | 'result' | 'account';

export function Onboarding() {
  const st = useAppState();
  const [stage, setStage] = useState<Stage>('intro');
  const [i, setI] = useState(0);
  const [cfg, setCfg] = useState(defaultRemoteConfig);
  const a = st.onboarding;

  useEffect(() => {
    track('onboarding_started');
    fetchRemoteConfig().then(setCfg);
  }, []);

  const answer = (key: string, value: unknown, autoNext = true) => {
    saveOnboarding({ [key]: value } as Partial<OnboardingAnswers>);
    if (!autoNext) return;
    track('onboarding_question_completed', { question: key, index: i + 1 });
    setTimeout(() => (i + 1 < QUESTIONS.length ? setI(i + 1) : setStage('result')), 160);
  };

  if (stage === 'intro') {
    return (
      <div className="scroll no-nav" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100%' }}>
        <div className="blob a" /><div className="blob b" />
        <div className="layer" style={{ paddingTop: 56 }}>
          <span className="tiny">Recomeço</span>
          <h1 style={{ fontSize: 38, marginTop: 14 }}>Vamos entender o que está te prendendo nessa relação.</h1>
          <p className="muted" style={{ marginTop: 16, fontSize: 18 }}>Em poucos minutos, o Recomeço monta seu acompanhamento inicial.</p>
        </div>
        <div className="layer stack">
          <Button onClick={() => setStage('q')}>Começar</Button>
          <p className="small muted" style={{ textAlign: 'center' }}>O Recomeço não é terapia nem diagnóstico e não substitui acompanhamento psicológico.</p>
        </div>
      </div>
    );
  }

  if (stage === 'q') {
    const q = QUESTIONS[i];
    const back = () => (i === 0 ? setStage('intro') : setI(i - 1));
    const current = a[q.key as keyof OnboardingAnswers];
    return (
      <div className="scroll no-nav" key={i}>
        <div className="ob-top">
          <button className="back" onClick={back} aria-label="Voltar">←</button>
          <div className="ob-bar" aria-label={`Pergunta ${i + 1} de ${QUESTIONS.length}`}><i style={{ width: `${((i + 1) / QUESTIONS.length) * 100}%` }} /></div>
        </div>
        <div className="stack-lg fade">
          <h1 style={{ fontSize: 26 }}>{q.title}</h1>
          {q.kind === 'single' && (
            <div className="stack">
              {q.options.map((o) => <Choice key={o.value} label={o.label} on={current === o.value} onClick={() => answer(q.key, o.value)} />)}
            </div>
          )}
          {q.kind === 'scale' && <Scale value={a.relief_score} onDone={(v) => answer('relief_score', v)} />}
          {q.kind === 'multi' && (
            <>
              <p className="small muted">Escolha até {q.max}.</p>
              <div className="stack">
                {q.options.map((o) => {
                  const sel = a.main_behaviors ?? [];
                  const on = sel.includes(o.value);
                  return (
                    <Choice key={o.value} label={o.label} on={on} onClick={() => {
                      const next = on ? sel.filter((x) => x !== o.value) : sel.length >= q.max ? [...sel.slice(1), o.value] : [...sel, o.value];
                      answer('main_behaviors', next, false);
                    }} />
                  );
                })}
              </div>
              <Button disabled={!(a.main_behaviors?.length)} onClick={() => { track('onboarding_question_completed', { question: 'main_behaviors', index: i + 1 }); setStage('result'); }}>Continuar</Button>
            </>
          )}
        </div>
      </div>
    );
  }

  const profile = profileFromAnswers('preview', a);
  const f = buildFormulation(profile);

  if (stage === 'result') {
    return (
      <div className="scroll no-nav fade">
        <div className="blob a" />
        <div className="layer stack-lg">
          <div className="topbar"><button className="back" onClick={() => { setI(QUESTIONS.length - 1); setStage('q'); }} aria-label="Voltar">←</button><span /><span style={{ width: 44 }} /></div>
          <h1>{f.headline}</h1>
          <div className="stack">{f.lines.map((l, k) => <p key={k} className={k === 0 ? '' : 'muted'} style={{ fontSize: k === 0 ? 20 : 17, fontWeight: k === 0 ? 700 : 400 }}>{l}</p>)}</div>
          <Chain nodes={f.chain} loop />
          {f.goalNote && <div className="card lilac"><p style={{ fontWeight: 600 }}>{f.goalNote}</p></div>}
          <p style={{ fontWeight: 650 }}>{f.closing}</p>
          <Button onClick={() => setStage('account')}>Montar meu acompanhamento</Button>
        </div>
      </div>
    );
  }

  return <Account cfg={cfg} onBack={() => setStage('result')} />;
}

function Scale({ value, onDone }: { value?: number; onDone: (v: number) => void }) {
  const [v, setV] = useState(value ?? 5);
  return (
    <div className="stack-lg">
      <div className="slider-wrap">
        <div className="slider-val">{v}</div>
        <input type="range" min={0} max={10} value={v} onChange={(e) => setV(Number(e.target.value))} aria-label="Alívio de zero a dez" />
        <div className="slider-scale"><span>0 — quase nenhum</span><span>10 — enorme</span></div>
      </div>
      <Button onClick={() => onDone(v)}>Continuar</Button>
    </div>
  );
}

function Account({ cfg, onBack }: { cfg: typeof defaultRemoteConfig; onBack: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [ok, setOk] = useState(false);
  const valid = name.trim().length > 0 && /.+@.+\..+/.test(email) && ok;
  return (
    <div className="scroll no-nav fade">
      <div className="layer stack-lg">
        <div className="topbar"><button className="back" onClick={onBack} aria-label="Voltar">←</button><span /><span style={{ width: 44 }} /></div>
        <div className="stack">
          <h1>Como devemos te chamar?</h1>
          <p className="muted">Só o necessário. Seus registros ficam protegidos e você pode exportar ou apagar tudo quando quiser.</p>
        </div>
        <div className="stack">
          <input className="field" placeholder="Seu primeiro nome" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          <input className="field" placeholder="Seu e-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <label className="check">
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
            <span>Concordo com o tratamento dos meus dados sensíveis para o acompanhamento (LGPD) e entendo que o Recomeço não é terapia, diagnóstico ou substituto de ajuda profissional.</span>
          </label>
        </div>
        <Button disabled={!valid} onClick={() => createAccount(name, email, cfg)}>Criar meu acompanhamento</Button>
      </div>
    </div>
  );
}
