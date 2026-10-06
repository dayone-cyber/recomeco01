# Recomeço

PWA mobile-first de acompanhamento emocional (inspirado em princípios de TCC — **não** é terapia, diagnóstico ou substituto de ajuda profissional).
Ciclo central: **registrar → entender → intervir → medir → aprender → personalizar**.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # motor de regras (cenários A, C, D, E, G + segurança)
npm run build
```

QA: `?group=A|B&trial_days=N` força o grupo do experimento. Em **Perfil → Carregar dados de exemplo** há 3 semanas de dados fictícios (insights, progresso, Dia 22, SOS com memória). Em **Perfil → Preferências**, a pausa pode ser acelerada para testar.

## Onde está cada parte

| Área | Arquivos |
|---|---|
| Motor determinístico (sem LLM) | `src/engine/` — `recommend.ts` (próxima melhor ação, prioridade das 6 etapas, decisão pós check-in, SOS), `insights.ts` (regras + confiança low/medium/high), `pattern.ts`, `progress.ts`, `weekly.ts`, `safety.ts`, `formulation.ts` |
| Dados e mutações | `src/types.ts`, `src/lib/store.ts` (local-first), `src/lib/actions.ts` (toda escrita recalcula insights e fase) |
| Analytics / flags | `src/lib/analytics.ts` (todos os eventos da spec + sinks plugáveis), `src/lib/remoteConfig.ts` (`experiment_group`, `trial_duration_days`) |
| Telas | `src/screens/`, `src/components/` |
| Schema alvo (Supabase + RLS) | `supabase/schema.sql` |

## Decisões de produto implementadas

- Home mostra **uma** ação (`nextBestAction`), explicável (`reasons`). Prioridade: recaída recente → urgência alta sem intervenção → Dia 22 → resumo semanal → teste aguardando resultado → fechamento do dia → prática da etapa prioritária.
- Seis etapas **não lineares**: pontuação por etapa (semana dos 21 dias, objetivo, situação, dados). Recaída recente → desvio temporário para Pausar ↺. Nada é resetado; sem streak.
- Memória real: SOS e check-in recuperam contagem do gatilho, pensamento comum, urgência média e o antes→depois da última pausa.
- Insights só com ≥3 episódios; linguagem cautelosa quando a confiança é baixa; “Ainda estamos aprendendo” quando faltam dados.
- Limites participam da intervenção (gatilho → categoria de limite → “Quer mantê-lo hoje?”).
- Reconciliação e término definitivo preservam histórico e reponderam as etapas. Módulo “Sinais de reciprocidade” para `reconnect`/reconciliado.
- Segurança: texto livre passa por `detectRisk`; “Me senti ameaçado(a) ou em risco” e o link no SOS levam à `CrisisSafetyScreen` (CVV 188, SAMU 192, PM 190, Ligue 180, Disque 100). **O SOS nunca fica atrás do paywall.**
- Notificações com texto discreto (`src/lib/notifications.ts`).

## O que **não** está pronto (honestidade)

- **Sem backend ainda.** Os dados ficam no `localStorage` do aparelho; `supabase/schema.sql` é o alvo, mas o adapter de sincronização e o **Supabase Auth** (senha/magic link) não foram ligados. A conta atual é só nome + e-mail locais. “Criptografia em trânsito / armazenamento seguro” dependem dessa etapa.
- **Pagamento é stub**: `subscribe()` apenas muda o status. Falta Stripe/RevenueCat/lojas e o lembrete de fim de teste.
- **Push real** (servidor/Web Push) e notificações contextuais por horário não estão agendadas; há preferências e texto de exemplo.
- Analytics grava local e expõe `registerSink` (PostHog/Mixpanel não conectados). Eventos `trial_day_N_active` só disparam quando a Home é aberta nesses dias.
- Recursos de crise cobrem só o Brasil; textos de termos/privacidade são de demonstração e precisam de revisão jurídica (LGPD).
- Revisar clínica/psicologicamente os textos e limiares antes de lançar. Testes cobrem o motor; a UI foi verificada manualmente em navegador (fluxos de onboarding, check-in, pausa, SOS, dados de exemplo), sem suíte E2E automatizada.
