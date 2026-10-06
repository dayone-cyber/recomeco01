import { useEffect } from 'react';
import { useAppState } from '../lib/store';
import { useNav } from '../lib/nav';
import { track } from '../lib/analytics';
import { cancelSubscription, effectiveSubscription, startTrial, subscribe, setFlag } from '../lib/actions';
import { Button, Screen } from '../components/ui';

/**
 * Paywall com A/B: A = pagamento imediato · B = teste gratuito (trial_duration_days remoto).
 * Cobrança real não está integrada (Stripe/RevenueCat/Apple/Google): subscribe() é um stub.
 * Sem cobrança escondida; cancelamento em 1 toque no Perfil. O SOS nunca fica bloqueado.
 */
export function Paywall({ gate }: { gate?: boolean }) {
  const st = useAppState();
  const nav = useNav();
  const now = new Date();
  const status = effectiveSubscription(st, now);
  const u = st.user!;
  const days = st.settings.trial_duration_days;
  const canTrial = u.experiment_group === 'B' && !u.trial_started_at;
  useEffect(() => track('paywall_viewed', { status, group: u.experiment_group }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { setFlag('paywall_seen', true); if (!gate) nav.pop(); };
  const content = (
    <div className="stack-lg">
      <div className="stack">
        <span className="tiny">Recomeço</span>
        <h1>{status === 'expired' || status === 'cancelled' ? 'Continue com o acompanhamento que já conhece você.' : 'Seu acompanhamento está pronto.'}</h1>
        <p className="muted" style={{ fontSize: 18 }}>Histórico pessoal, SOS com a sua memória, insights semanais e etapas que se adaptam. Tudo o que você registrou continua sendo seu.</p>
      </div>
      <div className="card stack">
        {['Próxima ação diária sob medida', 'SOS que usa o que funcionou com você', 'Padrões, insights e resumo semanal', 'Jornada de 6 etapas que se adapta'].map((t) => <p key={t} style={{ fontWeight: 600 }}>✓ {t}</p>)}
      </div>
      {canTrial ? (
        <div className="stack">
          <Button onClick={() => { startTrial(); setFlag('paywall_seen', true); if (!gate) nav.pop(); }}>Começar {days} dias grátis</Button>
          <p className="small muted" style={{ textAlign: 'center' }}>Sem cobrança durante o teste. Avisamos antes de terminar. Cancele em um toque pelo Perfil.</p>
        </div>
      ) : (
        <div className="stack">
          <Button onClick={() => { subscribe(); setFlag('paywall_seen', true); if (!gate) nav.pop(); }}>Assinar o Recomeço</Button>
          <p className="small muted" style={{ textAlign: 'center' }}>Preço e cobrança definidos na loja/provedor de pagamento. Cancele quando quiser, em um toque.</p>
        </div>
      )}
      {status !== 'none' && !gate && <Button variant="ghost" onClick={close}>Agora não</Button>}
      {gate && <Button variant="secondary" onClick={() => nav.setTab('sos')}>Preciso do SOS agora</Button>}
      {gate && <button className="link" onClick={() => nav.push('privacy')}>Exportar ou excluir meus dados</button>}
    </div>
  );
  return gate ? <div className="scroll no-nav fade"><div className="blob a" /><div className="layer" style={{ paddingTop: 24 }}>{content}</div></div> : <Screen title="Plano">{content}</Screen>;
}

export function ManageSubscription() {
  const st = useAppState();
  const nav = useNav();
  const status = effectiveSubscription(st, new Date());
  return (
    <Screen title="Assinatura">
      <div className="stack-lg">
        <h1>Assinatura</h1>
        <div className="card stack"><div className="kv"><span className="muted">Status</span><b>{{ none: 'Sem plano', trialing: 'Em teste gratuito', active: 'Ativa', cancelled: 'Cancelada', expired: 'Teste encerrado' }[status]}</b></div>
          {st.user!.trial_ends_at && status === 'trialing' && <div className="kv"><span className="muted">Teste termina em</span><b>{new Date(st.user!.trial_ends_at).toLocaleDateString('pt-BR')}</b></div>}</div>
        {(status === 'active' || status === 'trialing') && <Button variant="secondary" onClick={() => { cancelSubscription(); nav.say('Cancelada. Seus dados continuam com você.'); }}>Cancelar assinatura</Button>}
        {(status === 'cancelled' || status === 'expired' || status === 'none') && <Button onClick={() => nav.push('paywall')}>Ver planos</Button>}
      </div>
    </Screen>
  );
}
