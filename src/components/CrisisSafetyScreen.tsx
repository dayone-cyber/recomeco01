import { useEffect } from 'react';
import { CRISIS_RESOURCES_BR } from '../data/content';
import { track } from '../lib/analytics';
import { Button, Screen } from './ui';
import { useNav } from '../lib/nav';

/** Fluxo separado: interrompe o fluxo normal. Não tenta resolver crise grave dentro do app. */
export function CrisisSafetyScreen() {
  const nav = useNav();
  useEffect(() => track('crisis_screen_shown'), []);
  return (
    <Screen noBack>
      <div className="stack-lg safety" style={{ padding: 4 }}>
        <div className="stack">
          <h1>Sua segurança vem primeiro.</h1>
          <p className="muted" style={{ fontSize: 18 }}>
            Se você está em perigo, pensando em se machucar, ou sente medo de alguém, isso é mais importante do que qualquer exercício deste app.
            Procure ajuda agora. Você não precisa passar por isso sozinho(a).
          </p>
        </div>
        <div className="stack">
          {CRISIS_RESOURCES_BR.map((r) => (
            <a key={r.phone} href={`tel:${r.phone}`} className="card row between" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div><b>{r.name}</b><p className="small muted">{r.desc}</p></div>
              <span className="btn small coral" style={{ width: 'auto', minWidth: 84, textAlign: 'center' }}>{r.phone}</span>
            </a>
          ))}
        </div>
        <p className="small muted">Recursos do Brasil. Se estiver em outro país, procure o serviço de emergência local. Se puder, fale também com alguém de confiança perto de você.</p>
        <Button variant="secondary" onClick={nav.home}>Estou em segurança — voltar</Button>
      </div>
    </Screen>
  );
}
