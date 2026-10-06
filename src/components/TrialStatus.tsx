import { useAppState } from '../lib/store';
import { useNav } from '../lib/nav';
import { effectiveSubscription } from '../lib/actions';
import { DAY } from '../lib/time';

export function TrialStatus({ compact }: { compact?: boolean }) {
  const st = useAppState();
  const nav = useNav();
  const now = new Date();
  const status = effectiveSubscription(st, now);
  const u = st.user!;
  if (status === 'active') return compact ? null : <p className="small muted">Assinatura ativa.</p>;
  if (status === 'trialing' && u.trial_ends_at) {
    const left = Math.max(0, Math.ceil((new Date(u.trial_ends_at).getTime() - now.getTime()) / DAY));
    if (compact && left > 2) return null;
    return (
      <button className="card yellow row between" onClick={() => nav.push('paywall')} style={{ textAlign: 'left' }}>
        <span style={{ fontWeight: 650 }}>Teste gratuito: {left} {left === 1 ? 'dia restante' : 'dias restantes'}</span>
        <span className="small">Ver plano →</span>
      </button>
    );
  }
  if (compact) return null;
  return <p className="small muted">Sem assinatura ativa.</p>;
}
