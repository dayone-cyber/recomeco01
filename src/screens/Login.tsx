import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { restoreFromCloud } from '../lib/sync';
import { createAccount } from '../lib/actions';
import { getState } from '../lib/store';
import { defaultRemoteConfig, fetchRemoteConfig } from '../lib/remoteConfig';
import { Button } from '../components/ui';

/** Depois de autenticar: restaura da nuvem; se for conta nova (sem linhas), cria a partir do onboarding local. */
export async function finishSignIn(): Promise<string | null> {
  const { data } = await supabase!.auth.getSession();
  const u = data.session?.user;
  if (!u) return 'Sessão não encontrada.';
  if (await restoreFromCloud()) return null;
  if (Object.keys(getState().onboarding).length === 0) return 'Não encontramos um acompanhamento nesta conta. Faça o cadastro pelo início.';
  const cfg = await fetchRemoteConfig().catch(() => defaultRemoteConfig);
  createAccount((u.user_metadata?.name as string) || 'Você', u.email ?? '', cfg, u.id);
  return null;
}

export function Login({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enter = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMsg(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
    else { const e = await finishSignIn(); if (e) setMsg(e); }
    setBusy(false);
  };
  const reset = async () => {
    if (!email.trim()) return setMsg('Digite seu e-mail acima primeiro.');
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setMsg(error ? error.message : 'Enviamos um link para redefinir a senha.');
  };

  return (
    <div className="scroll no-nav fade">
      <div className="layer stack-lg">
        <div className="topbar"><button className="back" onClick={onBack} aria-label="Voltar">←</button><span /><span style={{ width: 44 }} /></div>
        <div className="stack"><h1>Entrar</h1><p className="muted">Use a conta que você criou. Seu histórico volta em qualquer aparelho.</p></div>
        <div className="stack">
          <input className="field" type="email" placeholder="Seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input className="field" type="password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {msg && <p role="alert" className="small" style={{ color: 'var(--danger)', fontWeight: 600 }}>{msg}</p>}
        <Button disabled={busy || !email || !password} onClick={enter}>{busy ? 'Entrando…' : 'Entrar'}</Button>
        <button className="link" onClick={reset}>Esqueci minha senha</button>
      </div>
    </div>
  );
}
