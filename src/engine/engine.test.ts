import { beforeEach, describe, expect, it } from 'vitest';
import { getState, resetAll } from '../lib/store';
import {
  addBoundary, completeIntervention, createAccount, declareReconciliation, logDay, markAction,
  recordCheckIn, saveOnboarding, startIntervention,
} from '../lib/actions';
import { decideAfterCheckIn, memoryLines, nextBestAction, sosPlan, temporaryDetour } from './recommend';
import { candidateInsights } from './insights';
import { discoverPattern } from './pattern';
import { progress } from './progress';
import { detectRisk } from './safety';
import { DAY } from '../lib/time';

function setup(goal: 'independence' | 'reconnect' = 'independence') {
  resetAll();
  saveOnboarding({ primary_goal: goal, relationship_status: 'broken_contact', check_frequency: '17', boundary_difficulty: '2', main_behaviors: ['check'] });
  createAccount('Ana', 'ana@example.com');
}

/** Um episódio completo: check-in + pausa medida. */
function episode(daysBack: number, hour: number, urge: number, after: number, opts: { trigger?: string; thought?: string; acted?: boolean } = {}) {
  const ts = new Date(Date.now() - daysBack * DAY);
  ts.setHours(hour, 0, 0, 0);
  const id = recordCheckIn({ mood: 'anxious', triggerId: opts.trigger ?? 'vanished', thought: opts.thought ?? 'Está me esquecendo', urge, timestamp: ts.toISOString() });
  const iid = startIntervention('pause', opts.trigger ?? 'vanished', urge, 12);
  completeIntervention(iid, id, after, opts.acted ? 'acted' : 'waited', new Date(ts.getTime() + 12 * 60000).toISOString());
}

beforeEach(() => setup());

describe('cenário A — uso normal', () => {
  it('sem dados, a próxima ação é gerar o primeiro registro', () => {
    expect(nextBestAction(getState(), new Date()).kind).toBe('first_checkin');
  });
});

describe('cenário C — aprendizado', () => {
  it('3+ episódios semelhantes geram insight, padrão e memória, e mudam a recomendação', () => {
    expect(candidateInsights(getState(), new Date())).toHaveLength(0);
    episode(3, 21, 8, 5);
    episode(2, 22, 8, 5);
    expect(discoverPattern(getState())).toBeNull(); // ainda insuficiente
    episode(1, 21, 9, 5);
    const st = getState();
    const trig = st.insights.find((i) => i.type === 'trigger');
    expect(trig).toBeTruthy();
    expect(trig!.confidence).toBe('low'); // pouca amostra → linguagem cautelosa
    expect(trig!.description).toMatch(/começando a perceber/);
    expect(discoverPattern(st)).not.toBeNull();
    const mem = memoryLines(st, 'vanished');
    expect(mem.join(' ')).toMatch(/já apareceu 3 vezes/);
    expect(mem.join(' ')).toMatch(/caiu de 9 para 5/);
    expect(nextBestAction(st, new Date()).kind).not.toBe('first_checkin');
  });

  it('com mais dados a linguagem passa a ser afirmativa', () => {
    for (let i = 0; i < 7; i++) episode(7 - i, 21, 8, 5);
    const t = getState().insights.find((i) => i.type === 'trigger')!;
    expect(t.confidence).toBe('high');
    expect(t.description).not.toMatch(/começando/);
    expect(getState().insights.some((i) => i.type === 'time' && i.description.includes('20h e 23h'))).toBe(true);
  });

  it('SOS recupera histórico do gatilho', () => {
    episode(3, 21, 8, 5, { trigger: 'sent_message' });
    episode(2, 21, 8, 4, { trigger: 'sent_message' });
    const plan = sosPlan(getState(), 'sent_message');
    expect(plan.hasHistory).toBe(true);
    expect(plan.body).toMatch(/2 das últimas 2 vezes.*diminuiu quando você esperou/);
  });
});

describe('cenário D — progresso sem streak', () => {
  it('compara checagens de base × atuais', () => {
    logDay({ whatsapp_checks: 6 });
    // segunda métrica em outro dia
    const st = getState();
    st.metrics.push({ ...st.metrics[0], date: '2000-01-01' });
    const p = progress({ ...st, metrics: [{ ...st.metrics[0] }, { ...st.metrics[0], date: new Date(Date.now() - DAY).toISOString().slice(0, 10) }] }, new Date());
    expect(p.checks.before).toBe(17);
    expect(p.checks.now).toBe(6);
    expect(p.checks.pct).toBe(-65);
  });
});

describe('cenário E — recaída', () => {
  it('não reseta a jornada e retoma a Pausa temporariamente', () => {
    episode(3, 21, 8, 5);
    episode(2, 21, 8, 5);
    const before = getState().journey.map((j) => j.exercises_completed).join();
    const rid = recordCheckIn({ mood: 'impulse', triggerId: 'vanished', thought: 'Está me esquecendo', urge: 9 });
    markAction(rid, 'acted');
    const st = getState();
    expect(st.journey.map((j) => j.exercises_completed).join()).not.toBe('');
    expect(st.journey.reduce((a, j) => a + j.exercises_completed, 0)).toBeGreaterThanOrEqual(before.split(',').reduce((a, b) => a + Number(b), 0));
    const act = nextBestAction(st, new Date());
    expect(act.kind).toBe('relapse_followup');
    expect(act.title).toMatch(/informação/);
    expect(JSON.stringify(act)).not.toMatch(/zero|zerou/i);
    expect(temporaryDetour(st, new Date())).toBeDefined();
  });
});

describe('limites participam da intervenção', () => {
  it('SOS por mensagem recebida traz o limite de planos', () => {
    addBoundary('Não cancelar planos quando a pessoa chamar de última hora.', 'plans');
    episode(1, 21, 6, 4, { trigger: 'sent_message' });
    expect(sosPlan(getState(), 'sent_message').boundary?.category).toBe('plans');
  });
});

describe('decisão pós check-in', () => {
  it('urgência baixa só registra; alta intervém', () => {
    expect(decideAfterCheckIn(getState(), 'vanished', 2).decision).toBe('record');
    expect(decideAfterCheckIn(getState(), 'vanished', 6).decision).toBe('practice');
    expect(decideAfterCheckIn(getState(), 'vanished', 8).decision).toBe('intervene');
  });
});

describe('cenário G — reconciliação', () => {
  it('preserva histórico e prioriza limites', () => {
    episode(2, 21, 8, 5);
    const n = getState().checkIns.length;
    declareReconciliation('rebuild');
    const st = getState();
    expect(st.checkIns).toHaveLength(n);
    expect(st.profile!.relationship_status).toBe('reconciled');
    expect(st.profile!.current_phase).toBe(5);
  });
});

describe('segurança', () => {
  it('detecta sinais graves e não dispara em texto comum', () => {
    expect(detectRisk('às vezes penso em me matar')).toBe(true);
    expect(detectRisk('ele me ameaçou ontem')).toBe(true);
    expect(detectRisk('só quero responder a mensagem')).toBe(false);
  });
});

describe('markAction', () => {
  it('registra ação sem apagar progresso', () => {
    const id = recordCheckIn({ mood: 'impulse', triggerId: 'vanished', urge: 7 });
    markAction(id, 'acted');
    expect(getState().checkIns.find((c) => c.id === id)!.action_taken).toBe('acted');
  });
});
