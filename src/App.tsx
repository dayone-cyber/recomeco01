import { useEffect } from 'react';
import { useAppState } from './lib/store';
import { NavProvider, useNav, type Overlay } from './lib/nav';
import { AppShell } from './components/AppShell';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { JourneyMap } from './screens/Journey';
import { Sos, SosPlan } from './screens/Sos';
import { ProgressScreen } from './screens/ProgressScreen';
import { CheckinFlow } from './screens/CheckinFlow';
import { PauseIntervention } from './components/PauseIntervention';
import { CrisisSafetyScreen } from './components/CrisisSafetyScreen';
import { BoundaryPractice, CloseDay, Practice } from './screens/Practice';
import { Day22, PatternScreen, Weekly } from './screens/Moments';
import { ManageSubscription, Paywall } from './screens/Paywall';
import { GoalScreen, Help, Notifications, Preferences, Privacy, Profile, Reciprocity, StatusScreen, Terms } from './screens/Profile';
import { effectiveSubscription } from './lib/actions';
import { supabase } from './lib/supabase';
import { initSync, restoreFromCloud } from './lib/sync';
import { getState } from './lib/store';

initSync();

function renderOverlay(o: Overlay) {
  const p = o.params ?? {};
  switch (o.name) {
    case 'checkin': return <CheckinFlow mood={p.mood} />;
    case 'pause': return <PauseIntervention triggerId={p.triggerId ?? null} checkInId={p.checkInId} urge={p.urge} minutes={p.minutes} source={p.source ?? 'home'} headline={p.headline} intro={p.intro} />;
    case 'sosplan': return <SosPlan triggerId={p.triggerId} />;
    case 'crisis': return <CrisisSafetyScreen />;
    case 'practice': return <Practice phase={p.phase} resolve={p.resolve} />;
    case 'closeday': return <CloseDay />;
    case 'weekly': return <Weekly />;
    case 'pattern': return <PatternScreen />;
    case 'day22': return <Day22 />;
    case 'paywall': return <Paywall />;
    case 'subscription': return <ManageSubscription />;
    case 'profile': return <Profile />;
    case 'goal': return <GoalScreen />;
    case 'status': return <StatusScreen />;
    case 'boundaries': return <BoundaryPractice />;
    case 'reciprocity': return <Reciprocity />;
    case 'notifications': return <Notifications />;
    case 'prefs': return <Preferences />;
    case 'privacy': return <Privacy />;
    case 'help': return <Help />;
    case 'terms': return <Terms />;
    default: return null;
  }
}

function Main() {
  const st = useAppState();
  const nav = useNav();

  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  // sessão existente (outro aparelho/limpou cache): restaura da nuvem
  useEffect(() => {
    if (!supabase || getState().user) return;
    supabase.auth.getSession().then(({ data }) => { if (data.session) void restoreFromCloud(); });
  }, []);

  if (!st.user || !st.profile) {
    return <AppShell showNav={false}><Onboarding /></AppShell>;
  }

  const top = nav.stack.at(-1);
  if (top) return <AppShell showNav={false}>{renderOverlay(top)}</AppShell>;

  // Sem plano ativo/teste: bloqueia tudo, exceto SOS (segurança nunca fica atrás de paywall).
  const sub = effectiveSubscription(st, new Date());
  const blocked = sub === 'none' || sub === 'expired' || sub === 'cancelled';
  const screen =
    nav.tab === 'sos' ? <Sos /> :
    blocked ? <Paywall gate /> :
    nav.tab === 'today' ? <Today /> :
    nav.tab === 'journey' ? <JourneyMap /> :
    <ProgressScreen />;

  return <AppShell showNav>{screen}</AppShell>;
}

export default function App() {
  return (
    <NavProvider>
      <Main />
    </NavProvider>
  );
}
