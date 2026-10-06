import { useEffect } from 'react';
import { useAppState } from '../lib/store';
import { useNav } from '../lib/nav';
import { track } from '../lib/analytics';
import { currentPhase, JOURNEY_LEARNING_DAYS, temporaryDetour } from '../engine/recommend';
import { journeyDay } from '../lib/time';
import { JourneyStage } from '../components/cards';
import type { PhaseId } from '../types';

export function JourneyMap() {
  const st = useAppState();
  const nav = useNav();
  const now = new Date();
  const cur = currentPhase(st, now);
  const detour = temporaryDetour(st, now);
  const day = journeyDay(st.user!.created_at, now);
  useEffect(() => track('journey_viewed'), []);

  return (
    <div className="scroll">
      <div className="layer stack-lg">
        <div className="stack">
          <h1>Sua jornada</h1>
          <p className="muted">
            {day <= JOURNEY_LEARNING_DAYS
              ? `Dia ${day} de 21: a fase de aprendizado, em que o app conhece o seu padrão.`
              : 'Os 21 dias já passaram. A jornada não zera — ela se adapta.'}{' '}
            Não é uma sequência rígida: você pode voltar a uma etapa quando um padrão antigo reaparece.
          </p>
        </div>
        <div className="route">
          {([1, 2, 3, 4, 5, 6] as PhaseId[]).map((ph) => {
            const j = st.journey.find((x) => x.phase === ph)!;
            const here = ph === cur;
            const state = here ? 'here' : j.status === 'explored' ? 'done' : 'todo';
            return <JourneyStage key={ph} phase={ph} state={state} here={here} detour={detour === ph} count={j.exercises_completed} onOpen={() => nav.push('practice', { phase: ph })} />;
          })}
        </div>
        {detour && (
          <div className="card coral stack">
            <span className="tiny">Rota flexível</span>
            <p style={{ fontWeight: 650 }}>Limites → gatilho intenso → Pausar ↺ → voltar a Limites. Seu progresso nas outras etapas continua guardado.</p>
          </div>
        )}
        {(st.profile!.primary_goal === 'reconnect' || st.profile!.relationship_status === 'reconciled') && (
          <button className="card lilac stack" style={{ textAlign: 'left' }} onClick={() => nav.push('reciprocity')}>
            <span className="tiny">Sinais de reciprocidade</span>
            <p style={{ fontWeight: 650 }}>Registre o que está acontecendo de fato, separado do que você espera.</p>
          </button>
        )}
      </div>
    </div>
  );
}
