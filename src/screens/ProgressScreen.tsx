import { useEffect, useState } from 'react';
import { useAppState } from '../lib/store';
import { useNav } from '../lib/nav';
import { track } from '../lib/analytics';
import { markInsightViewed } from '../lib/actions';
import { progress } from '../engine/progress';
import { hasWeeklySummary } from '../engine/recommend';
import { BehaviorProgress, PersonalInsight } from '../components/cards';
import { Learning, Button } from '../components/ui';
import { fmtDateTime } from '../lib/time';
import { MOOD_LABEL } from '../data/content';
import { thoughtText, triggerName } from '../engine/stats';

export function ProgressScreen() {
  const st = useAppState();
  const nav = useNav();
  const now = new Date();
  const data = progress(st, now);
  const [showTimeline, setShowTimeline] = useState(false);
  useEffect(() => track('progress_viewed'), []);
  useEffect(() => {
    st.insights.filter((i) => !i.viewed_at && i.confidence !== 'low').forEach((i) => markInsightViewed(i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const insights = [...st.insights].sort((a, b) => (a.generated_at < b.generated_at ? 1 : -1));
  const recent = [...st.checkIns].reverse().slice(0, 30);

  return (
    <div className="scroll">
      <div className="layer stack-lg">
        <div className="stack">
          <h1>Sua mudança</h1>
          <p className="muted">Comportamento, não contagem de dias. Um episódio difícil não apaga nada do que você construiu.</p>
        </div>

        {hasWeeklySummary(st, now) && (
          <button className="card coral stack" style={{ textAlign: 'left' }} onClick={() => nav.push('weekly')}>
            <span className="tiny">Resumo semanal</span><p style={{ fontWeight: 700 }}>Seu resumo semanal está pronto.</p><span className="small">Ver minha semana →</span>
          </button>
        )}

        {data.hasEnoughData ? <BehaviorProgress data={data} /> : <Learning text="Ainda estamos aprendendo. Com alguns registros, aqui você vai ver sua evolução real." action="Fazer um check-in" onAction={() => nav.setTab('today')} />}

        <div className="stack">
          <h2>O que percebemos</h2>
          {insights.length === 0 && <Learning text="Ainda estamos aprendendo esse padrão. Padrões só aparecem depois de 3 episódios parecidos." />}
          {insights.map((i) => <PersonalInsight key={i.id} insight={i} />)}
        </div>

        <div className="stack">
          <div className="row between"><h2>Diário invisível</h2><Button small variant="ghost" onClick={() => setShowTimeline(!showTimeline)}>{showTimeline ? 'Ocultar' : 'Ver linha do tempo'}</Button></div>
          <p className="small muted">Construído automaticamente a partir dos seus check-ins. Você não precisa escrever nada.</p>
          {showTimeline && (recent.length === 0 ? <Learning text="Ainda não há registros." /> : (
            <div className="card">
              {recent.map((c) => (
                <div key={c.id} className="timeline-item">
                  <span className="t">{fmtDateTime(c.timestamp)}</span>
                  <div>
                    <b>{MOOD_LABEL[c.emotional_state]}</b>{c.trigger_id && <> · {triggerName(st, c.trigger_id)}</>}
                    {c.automatic_thought_id && <p className="small muted">“{thoughtText(st, c.automatic_thought_id)}”</p>}
                    <p className="small muted">{c.urge_before != null && `Urgência ${c.urge_before}`}{c.urge_after != null && ` → ${c.urge_after}`}{c.action_taken === 'waited' && ' · não agiu no pico'}{c.action_taken === 'acted' && ' · agiu no impulso'}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
