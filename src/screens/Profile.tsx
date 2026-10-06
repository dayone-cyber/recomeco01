import { useState } from 'react';
import { useAppState, mutate } from '../lib/store';
import { useNav } from '../lib/nav';
import { Button, Chip, Choice, Screen } from '../components/ui';
import {
  GOALS, GOAL_SHORT, SITUATIONS, STATUS_LABEL, CRISIS_RESOURCES_BR,
} from '../data/content';
import {
  addReciprocity, changeGoal, declareEnded, declareReconciliation, deleteAllData, effectiveSubscription, exportData, setRelationshipStatus,
} from '../lib/actions';
import { seedDemo } from '../lib/demo';
import { detectRisk } from '../engine/safety';
import type { ReconcileFocus, ReciprocitySignal } from '../types';
import { notificationCopy } from '../lib/notifications';
import { cloudEnabled, supabase } from '../lib/supabase';
import { pushNow, resetFlush, syncError, useSyncStatus } from '../lib/sync';
import { resetAll } from '../lib/store';

export function Profile() {
  const st = useAppState();
  const nav = useNav();
  const p = st.profile!;
  const status = effectiveSubscription(st, new Date());
  const rows: [string, string, string][] = [
    ['Meu objetivo', GOAL_SHORT[p.primary_goal], 'goal'],
    ['Situação atual', STATUS_LABEL[p.relationship_status], 'status'],
    ['Meus limites', `${st.boundaries.filter((b) => b.active).length} ativos`, 'boundaries'],
    ['Preferências', '', 'prefs'],
    ['Notificações', st.settings.notifications_enabled ? 'Ativadas' : 'Desativadas', 'notifications'],
    ['Privacidade', '', 'privacy'],
    ['Assinatura', { none: 'Sem plano', trialing: 'Em teste', active: 'Ativa', cancelled: 'Cancelada', expired: 'Encerrada' }[status], 'subscription'],
    ['Ajuda', '', 'help'],
    ['Termos', '', 'terms'],
  ];
  return (
    <Screen title="Perfil">
      <div className="stack-lg">
        <div className="row"><div className="avatar" style={{ width: 64, height: 64, fontSize: 24 }}>{st.user!.name.slice(0, 1).toUpperCase()}</div><div><h2>{st.user!.name}</h2><p className="small muted">{st.user!.email}</p></div></div>
        <div className="list card" style={{ padding: '4px 16px' }}>
          {rows.map(([l, v, to]) => (
            <button key={to} onClick={() => nav.push(to)}><span>{l}</span><span className="muted small">{v} ›</span></button>
          ))}
        </div>
        {(p.primary_goal === 'reconnect' || p.relationship_status === 'reconciled') && <Button variant="soft" onClick={() => nav.push('reciprocity')}>Sinais de reciprocidade</Button>}
        {cloudEnabled && <CloudCard />}
        <div className="card stack">
          <span className="tiny">Modo demonstração</span>
          <p className="small muted">Preenche 3 semanas de dados fictícios para você explorar insights, progresso e o Dia 22. Substitui seus dados atuais.</p>
          <Button variant="secondary" onClick={() => { if (confirm('Substituir seus dados por uma demonstração?')) { seedDemo(st.user!.name); nav.home(); } }}>Carregar dados de exemplo</Button>
        </div>
      </div>
    </Screen>
  );
}

function CloudCard() {
  const sync = useSyncStatus();
  const label = { off: 'Desligada', idle: 'Aguardando', syncing: 'Sincronizando…', ok: 'Sincronizado', error: 'Erro ao sincronizar' }[sync];
  return (
    <div className="card stack">
      <span className="tiny">Conta e sincronização</span>
      <div className="kv"><span className="muted">Status</span><b>{label}</b></div>
      {sync === 'error' && <p className="small" style={{ color: 'var(--danger)' }}>{syncError()}</p>}
      <Button variant="secondary" onClick={() => void pushNow()}>Sincronizar agora</Button>
      <Button variant="ghost" onClick={async () => { await pushNow(); await supabase!.auth.signOut(); resetFlush(); resetAll(); }}>Sair deste aparelho</Button>
    </div>
  );
}

export function GoalScreen() {
  const st = useAppState();
  const nav = useNav();
  return (
    <Screen title="Meu objetivo">
      <div className="stack-lg">
        <h1>O que você mais gostaria de recuperar agora?</h1>
        <p className="muted">Mudar o objetivo muda linguagem, exemplos e prioridades. Seu histórico continua.</p>
        <div className="stack">{GOALS.map((g) => <Choice key={g.value} label={g.label} on={st.profile!.primary_goal === g.value} onClick={() => { changeGoal(g.value); nav.say('Objetivo atualizado.'); nav.pop(); }} />)}</div>
      </div>
    </Screen>
  );
}

export function StatusScreen() {
  const st = useAppState();
  const nav = useNav();
  const [reconcile, setReconcile] = useState(false);
  const FOCUS: [ReconcileFocus, string][] = [
    ['rebuild', 'Quero reconstruir a relação com mais segurança'],
    ['observe', 'Quero observar se realmente mudou'],
    ['insecure', 'Ainda estou inseguro(a)'],
    ['autonomy', 'Quero continuar recuperando minha autonomia'],
  ];
  if (reconcile) {
    return (
      <Screen title="Voltamos" onBack={() => setReconcile(false)}>
        <div className="stack-lg">
          <h1>Como você quer seguir agora?</h1>
          <p className="muted">O app continua útil: limites, comunicação, reciprocidade, ansiedade e prevenção de voltar ao padrão anterior. Nada do seu histórico se perde.</p>
          <div className="stack">{FOCUS.map(([f, l]) => <Choice key={f} label={l} onClick={() => { declareReconciliation(f); nav.say('Acompanhamento adaptado.'); nav.home(); }} />)}</div>
        </div>
      </Screen>
    );
  }
  return (
    <Screen title="Situação atual">
      <div className="stack-lg">
        <h1>Qual dessas situações parece mais com a sua agora?</h1>
        <div className="stack">
          {SITUATIONS.map((s) => <Choice key={s.value} label={s.label} on={st.profile!.relationship_status === s.value} onClick={() => { setRelationshipStatus(s.value); nav.pop(); }} />)}
          <Choice label="Voltamos" on={st.profile!.relationship_status === 'reconciled'} onClick={() => setReconcile(true)} />
          <Choice label="Foi um término definitivo" sub="Prioriza tolerar a ausência, reduzir monitoramento e reconstruir rotina." on={st.profile!.relationship_status === 'ended'} onClick={() => { declareEnded(); nav.say('Acompanhamento adaptado. Seu histórico continua.'); nav.home(); }} />
        </div>
      </div>
    </Screen>
  );
}

export function Reciprocity() {
  const st = useAppState();
  const nav = useNav();
  const [f, setF] = useState<Omit<ReciprocitySignal, 'id' | 'user_id' | 'timestamp'>>({ initiated_by: 'me', kept_agreement: 'na', respected_limits: 'na', available: 'yes', effort: 'balanced', expected: '', happened: '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const last = st.reciprocity.slice(-10);
  const mine = last.filter((r) => r.initiated_by === 'me').length;
  const yn: [string, string][] = [['yes', 'Sim'], ['no', 'Não'], ['na', 'Não se aplica']];
  return (
    <Screen title="Reciprocidade">
      <div className="stack-lg">
        <div className="stack"><h1>Sinais de reciprocidade</h1><p className="muted">Comportamentos observáveis, separados do que você espera. Isso ajuda a ver se existe esforço dos dois lados — sem tentar influenciar a outra pessoa.</p></div>
        {last.length >= 3 ? (
          <div className="card lilac"><p style={{ fontWeight: 650 }}>Nas últimas {last.length} observações, você iniciou o contato em {mine}. O esforço foi {last.filter((r) => r.effort === 'me').length > last.length / 2 ? 'mais seu' : last.filter((r) => r.effort === 'them').length > last.length / 2 ? 'mais da outra pessoa' : 'equilibrado'} na maior parte das vezes.</p></div>
        ) : <div className="card yellow"><p style={{ fontWeight: 650 }}>Ainda estamos aprendendo. Com 3 observações o app começa a comparar.</p></div>}
        <div className="stack"><span className="tiny">Quem iniciou o contato?</span><div className="chips">{([['me', 'Eu'], ['them', 'A pessoa'], ['both', 'Os dois']] as const).map(([v, l]) => <Chip key={v} label={l} on={f.initiated_by === v} onClick={() => set('initiated_by', v)} />)}</div></div>
        {([['kept_agreement', 'Cumpriu o que combinamos?'], ['respected_limits', 'Respeitou meus limites?'], ['available', 'Esteve disponível?']] as const).map(([k, l]) => (
          <div key={k} className="stack"><span className="tiny">{l}</span><div className="chips">{yn.map(([v, t]) => <Chip key={v} label={t} on={f[k] === v} onClick={() => set(k, v as 'yes')} />)}</div></div>
        ))}
        <div className="stack"><span className="tiny">Esforço</span><div className="chips">{([['me', 'Mais meu'], ['balanced', 'Equilibrado'], ['them', 'Mais da pessoa']] as const).map(([v, l]) => <Chip key={v} label={l} on={f.effort === v} onClick={() => set('effort', v)} />)}</div></div>
        <div className="stack"><span className="tiny">O que eu esperava</span><textarea className="field" value={f.expected} onChange={(e) => set('expected', e.target.value)} maxLength={200} /></div>
        <div className="stack"><span className="tiny">O que está acontecendo de fato</span><textarea className="field" value={f.happened} onChange={(e) => set('happened', e.target.value)} maxLength={200} /></div>
        <Button onClick={() => { if (detectRisk(f.expected + ' ' + f.happened)) return nav.replace('crisis'); addReciprocity(f); nav.say('Observação registrada.'); nav.pop(); }}>Salvar observação</Button>
      </div>
    </Screen>
  );
}

export function Notifications() {
  const st = useAppState();
  const nav = useNav();
  const s = st.settings;
  const set = (patch: Partial<typeof s>) => mutate((d) => void Object.assign(d.settings, patch));
  const enable = async () => {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    set({ notifications_enabled: true });
  };
  const sample = notificationCopy('checkin');
  const test = () => {
    if ('Notification' in window && Notification.permission === 'granted') new Notification('Recomeço', { body: sample, icon: '/icon.svg' });
    else nav.say(sample);
  };
  const Toggle = ({ label, sub, k }: { label: string; sub: string; k: 'notify_checkin' | 'notify_contextual' | 'notify_weekly' | 'quiet_hours' }) => (
    <label className="check card" style={{ alignItems: 'center' }}><input type="checkbox" checked={s[k]} onChange={(e) => set({ [k]: e.target.checked })} /><span><b style={{ color: 'var(--ink)' }}>{label}</b><br />{sub}</span></label>
  );
  return (
    <Screen title="Notificações">
      <div className="stack-lg">
        <div className="stack"><h1>Notificações discretas</h1><p className="muted">Nunca mencionam a pessoa nem o motivo — nada sensível aparece na tela bloqueada. Ex.: “{sample}”</p></div>
        {!s.notifications_enabled ? <Button onClick={enable}>Ativar notificações</Button> : (
          <>
            <Toggle k="notify_checkin" label="Lembrete de check-in" sub="“Seu check-in está disponível.”" />
            <Toggle k="notify_weekly" label="Resumo semanal" sub="“Seu resumo semanal está pronto.”" />
            <Toggle k="notify_contextual" label="Contextuais (baseadas nos meus padrões)" sub="“Quer fazer um check-in rápido?” nos horários de maior vulnerabilidade." />
            <Toggle k="quiet_hours" label="Silêncio durante o sono" sub="Sem avisos entre 23h e 7h, exceto os que eu escolher." />
            <Button variant="secondary" onClick={test}>Ver uma notificação de exemplo</Button>
            <Button variant="ghost" onClick={() => set({ notifications_enabled: false })}>Desativar tudo</Button>
          </>
        )}
      </div>
    </Screen>
  );
}

export function Preferences() {
  const st = useAppState();
  const s = st.settings;
  return (
    <Screen title="Preferências">
      <div className="stack-lg">
        <h1>Preferências</h1>
        <div className="card stack">
          <span className="tiny">Velocidade da pausa (demonstração)</span>
          <p className="small muted">Acelera o cronômetro da pausa para testar o fluxo. Em uso real deixe em 1×.</p>
          <div className="chips">{[1, 10, 60].map((n) => <Chip key={n} label={`${n}×`} on={s.demo_speed === n} onClick={() => mutate((d) => void (d.settings.demo_speed = n))} />)}</div>
        </div>
      </div>
    </Screen>
  );
}

export function Privacy() {
  const st = useAppState();
  const [confirm, setConfirm] = useState(false);
  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'recomeco-meus-dados.json';
    a.click();
  };
  return (
    <Screen title="Privacidade">
      <div className="stack-lg">
        <h1>Seus dados são seus.</h1>
        <div className="card stack">
          <p>Os registros do Recomeço são dados sensíveis. Neste app eles ficam <b>guardados apenas neste aparelho</b>, e coletamos o mínimo necessário (nome e e-mail). Em produção, a comunicação com o servidor é criptografada em trânsito e o armazenamento é protegido por regras de acesso por usuário.</p>
          <p className="small muted">Consentimento registrado em {new Date(st.user!.consent_at).toLocaleDateString('pt-BR')}. Direitos da LGPD: acesso, portabilidade, correção e eliminação.</p>
        </div>
        <Button variant="secondary" onClick={download}>Exportar meus dados</Button>
        {!confirm ? <Button variant="ghost" onClick={() => setConfirm(true)}>Excluir meus dados</Button> : (
          <div className="card coral stack"><p style={{ fontWeight: 650 }}>Isso apaga conta, histórico e insights deste aparelho. Não dá para desfazer.</p>
            <Button variant="coral" onClick={deleteAllData}>Sim, excluir tudo</Button><Button variant="ghost" onClick={() => setConfirm(false)}>Cancelar</Button></div>
        )}
      </div>
    </Screen>
  );
}

export function Help() {
  return (
    <Screen title="Ajuda">
      <div className="stack-lg">
        <h1>Ajuda</h1>
        <div className="card stack"><p><b>O que o Recomeço é:</b> um acompanhamento comportamental inspirado em princípios da TCC. Ele <b>não</b> é terapia, não faz diagnóstico e não substitui psicólogo(a) ou psiquiatra.</p>
          <p><b>Como ele aprende:</b> regras simples sobre os seus registros (gatilhos, pensamentos, urgência antes e depois). Quando há poucos dados, ele diz “ainda estamos aprendendo”.</p></div>
        <div className="card stack"><b>Em caso de risco, procure ajuda agora</b>{CRISIS_RESOURCES_BR.map((r) => <p key={r.phone} className="small"><a href={`tel:${r.phone}`}>{r.phone}</a> — {r.name}</p>)}</div>
      </div>
    </Screen>
  );
}

export function Terms() {
  return (
    <Screen title="Termos">
      <div className="stack-lg"><h1>Termos e política</h1>
        <div className="card stack"><p>Versão de demonstração. Os termos definitivos e a política de privacidade devem ser revisados por assessoria jurídica antes do lançamento (LGPD, dados sensíveis de saúde emocional, consumidor e lojas de aplicativos).</p></div></div>
    </Screen>
  );
}
