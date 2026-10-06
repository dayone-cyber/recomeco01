import { useEffect } from 'react';
import { useAppState } from '../lib/store';
import { useNav } from '../lib/nav';
import { track } from '../lib/analytics';
import { recordCheckIn } from '../lib/actions';
import { nextBestAction, type NextAction } from '../engine/recommend';
import { discoverPattern } from '../engine/pattern';
import { greeting, journeyDay } from '../lib/time';
import { MoodSelector } from '../components/checkin';
import { TodayFocusCard } from '../components/cards';
import { TrialStatus } from '../components/TrialStatus';
import type { Mood } from '../types';

export function contextualMessage(goal: string, calmDay: boolean): string {
  if (goal === 'reconnect') return 'Se existe possibilidade real de reconexão, ela aparece com mais clareza fora do pico da ansiedade.';
  if (goal === 'clarity') return 'Clareza vem com espaço. Você não precisa decidir nada hoje.';
  if (goal === 'independence') return 'Hoje é sobre algo que seja seu, independente de qualquer resposta.';
  return calmDay ? 'Um dia calmo também é um dado valioso.' : 'Você não precisa resolver essa relação hoje. Só criar espaço antes de agir.';
}

/** Executa a ação principal que o motor escolheu. */
export function runAction(a: NextAction, nav: ReturnType<typeof useNav>) {
  switch (a.kind) {
    case 'first_checkin':
      return nav.push('checkin', { mood: 'anxious' });
    case 'relapse_followup':
      return nav.push('pause', { triggerId: null, source: 'practice', headline: 'O que aconteceu é informação.', intro: 'Vamos recuperar o espaço antes do próximo passo. Seu progresso continua.' });
    case 'pause':
      return nav.push('pause', { triggerId: null, source: 'home' });
    case 'weekly':
      return nav.push('weekly');
    case 'day22':
      return nav.push('day22');
    case 'resolve_test':
      return nav.push('practice', { phase: 3, resolve: true });
    case 'close_day':
      return nav.push('closeday');
    case 'practice':
      return nav.push('practice', { phase: a.phase });
  }
}

export function Today() {
  const st = useAppState();
  const nav = useNav();
  const now = new Date();
  const action = nextBestAction(st, now);
  const pattern = discoverPattern(st);
  const unseenPattern = pattern && !st.flags.patterns_seen.includes(pattern.id);
  const unseenInsights = st.insights.filter((i) => !i.viewed_at && i.confidence !== 'low').length;

  useEffect(() => {
    track('home_viewed');
    const u = st.user!;
    const day = journeyDay(u.created_at, now);
    if (u.trial_started_at) {
      const d = journeyDay(u.trial_started_at, now);
      if ([2, 3, 7].includes(d)) {
        const key = `trial_day_${d}_active` as 'trial_day_2_active';
        if (!st.events.some((e) => e.name === key)) track(key, { journey_day: day });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (m: Mood) => {
    track('mood_selected', { mood: m });
    if (m === 'calm') {
      recordCheckIn({ mood: 'calm' });
      track('checkin_completed', { mood: 'calm' });
      nav.say('Registrado. Um momento de calma também ensina o app.');
      return;
    }
    track('checkin_started', { mood: m });
    nav.push('checkin', { mood: m });
  };

  return (
    <div className="scroll">
      <div className="blob a" />
      <div className="layer stack-lg">
        <div className="topbar" style={{ marginBottom: 0 }}>
          <div>
            <h1 style={{ fontSize: 28 }}>{greeting(now)}, {st.user!.name}.</h1>
          </div>
          <button className="avatar" onClick={() => nav.push('profile')} aria-label="Perfil">{st.user!.name.slice(0, 1).toUpperCase()}</button>
        </div>
        <p className="muted" style={{ fontSize: 18, marginTop: -8 }}>{contextualMessage(st.profile!.primary_goal, st.checkIns.length > 0 && st.checkIns.every((c) => c.emotional_state === 'calm'))}</p>

        <TrialStatus compact />
        <TodayFocusCard action={action} onGo={() => runAction(action, nav)} />

        <div className="stack">
          <h2 style={{ fontSize: 20 }}>Como você está agora?</h2>
          <MoodSelector onSelect={pick} />
        </div>

        {unseenPattern && pattern && (
          <button className="card coral stack" style={{ textAlign: 'left' }} onClick={() => nav.push('pattern')}>
            <span className="tiny">Descobrimos um padrão</span>
            <p style={{ fontWeight: 700, fontSize: 18 }}>{pattern.title}</p>
            <span className="small">Toque para ver</span>
          </button>
        )}
        {!unseenPattern && unseenInsights > 0 && (
          <button className="card stack" style={{ textAlign: 'left' }} onClick={() => nav.setTab('progress')}>
            <span className="tiny">Nova observação</span>
            <p style={{ fontWeight: 650 }}>Temos {unseenInsights === 1 ? 'uma observação nova' : `${unseenInsights} observações novas`} sobre o seu padrão.</p>
          </button>
        )}
      </div>
    </div>
  );
}
