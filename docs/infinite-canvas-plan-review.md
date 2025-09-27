# Infinite Canvas Front-End Plan Review

## Context

Este documento analisa o plano de integração do Infinite Canvas com o Unite Gen descrito em "Guia definitivo do front Infinite Canvas". O objetivo é identificar pontos de decisão em aberto que impactam escalabilidade, limpeza arquitetural e dinamismo da solução.

## Principais pontos fortes do plano

- **Separação clara de responsabilidades**: o Canvas é tratado como cliente externo consumindo as APIs do Unite Gen, o que facilita deploy independente e isolamento de falhas.
- **Catálogo de modelos totalmente dinâmico**: `GET /api/models` define tanto os campos de formulário quanto as regras de endpoint, evitando duplicação lógica no front.
- **Fluxo de upload sólido**: uso de URL assinada no R2 com validação de tamanho/tipo e opção de pós-processamento.
- **Integração realtime opcional**: `GET /api/trigger/realtime-token` habilita acompanhamento via Trigger.dev sem precisar reinventar WebSockets.
- **Persistência de projetos versionada**: `POST /api/canvas/projects` faz upsert com controle de revisão, permitindo colaboração futura.

## Pontas soltas e decisões necessárias

1. **Camada de dados e cache**
   - Falta definir estratégia para cache local das respostas de `GET /api/models`, `GET /api/history` e snapshots do Canvas. Sem cache, cada reload pode gerar cascata de requisições e piorar a experiência offline.
   - Decisão recomendada: usar React Query/TanStack Query (ou equivalente) com persister em IndexedDB para operações críticas, garantindo revalidação inteligente.

2. **Gestão de estado do Canvas**
   - O plano não detalha como o estado interno (elementos, layers, histórico de undo/redo) será organizado. Uma arquitetura mal definida pode comprometer escalabilidade do código.
   - Decisão recomendada: adotar store central (p.ex. Zustand, Jotai, Redux Toolkit) separando "document state" de "UI state" e estabelecendo contratos para plugins de ferramentas.

3. **Sistema de ferramentas e extensibilidade**
   - Embora o plano cite que novas ferramentas devem usar modelos expostos, não existe protocolo para registrar painéis, atalhos ou interações.
   - Decisão recomendada: definir interface de Tool (ex.: `{ id, label, icon, panel: ReactNode, run(parameters) }`) e pipeline para carregar ferramentas dinamicamente com lazy-loading.

4. **Tratamento de erros e observabilidade**
   - O checklist final fala em instrumentar erros, mas não especifica padrões de logging/monitoramento.
   - Decisão recomendada: padronizar camada HTTP com interceptors que convertam códigos de erro em objetos typed, enviar eventos críticos ao Sentry e capturar métricas de latência (p.ex. com OpenTelemetry browser SDK).

5. **Sincronização realtime vs. polling**
   - O plano sugere combinar Trigger.dev e `GET /api/history`, mas falta política de reconciliação em casos de perda de conexão ou múltiplas abas.
   - Decisão recomendada: implementar reconciliador que priorize eventos realtime, faça snapshot periódico via history e resolva conflitos por `runId` + timestamps.

6. **Segurança de sessão e CSRF**
   - Como todo fetch exige `credentials: 'include'`, é necessário garantir proteção contra CSRF e gerenciamento de refresh de sessão.
   - Decisão recomendada: confirmar se o backend já valida `Origin/Referer` e, no front, encapsular fetches numa função que sempre envia cabeçalho `X-Requested-With` ou token anti-CSRF quando fornecido.

7. **Internacionalização e acessibilidade**
   - O plano não cobre requisitos de i18n/A11y, o que pode comprometer dinamismo para múltiplos mercados.
   - Decisão recomendada: decidir cedo se a UI será traduzível (p.ex. Next.js i18n routing) e padronizar componentes acessíveis (Radix UI/Headless UI).

8. **Build pipeline e monitoramento de performance**
   - Não há menção a métricas de Web Vitals, split por bundle, ou limites de tamanho.
   - Decisão recomendada: configurar análise de bundle (Next.js `@next/bundle-analyzer`), definir budgets e integrar com monitoramento (p.ex. Vercel Analytics, SpeedCurve).

9. **Planejamento para colaboração em tempo real**
   - O controle de revisão permite evoluir para colaboração multiusuário, mas não há caminho descrito para locking, presence ou merge simultâneo.
   - Decisão recomendada: decidir se haverá roadmap para CRDTs/OT (ex.: Yjs) e reservar camada de sincronização no schema do Canvas.

10. **Testabilidade e QA automatizado**
    - O plano não aborda testes (unitários, integração, e2e) nem ambientes de staging.
    - Decisão recomendada: definir matriz de testes (Vitest/Jest + Playwright), incluir mocks das APIs do Unite Gen e configurar preview environments.

## Próximos passos sugeridos

- Validar com backend requisitos de segurança e limites de rate limit para calibrar caching.
- Documentar arquitetura de estado e contrato de ferramentas antes de iniciar implementação de UI.
- Prototipar camada HTTP + hooks de dados para garantir reutilização e consistência.
- Montar backlog técnico com as decisões acima para evitar débitos durante o desenvolvimento do Canvas.

Com essas decisões tomadas, o Infinite Canvas terá base sólida para crescer de forma escalável, limpa e dinâmica.
