# Cadê a Obra? Implementation Plan

**Goal:** implementar a especificação aprovada em `docs/SPEC.md` até os limites de acesso externo.
**Architecture:** Next.js serve consultas paginadas de uma cópia oficial normalizada e imutável. Supabase mantém versões, curadoria, autenticação e arquivos privados; uma troca atômica ativa importações completas. O snapshot versionado permite consulta local e recuperação sem credenciais.
**Tech Stack:** Next.js, React, TypeScript, Tailwind, MapLibre, Supabase, Vitest, Playwright, PGlite.
**Spec:** docs/SPEC.md.
**Execution:** execução nesta sessão; decisões reversíveis delegadas pelo documento aprovado. Não reabrir entrevistas sobre fatos já especificados.

## Global Constraints
Piauí apenas; dados reais; identificadores como texto; nenhuma duplicação por município ou ponto. Nenhum serviço pago. Sem escrita pública. Evidências privadas por padrão. Nunca inferir responsabilidade técnica ou política.

## Review Focus
Paginação incompleta; coordenadas fora do município; projetos com outra UF principal; publicação de rascunhos pela API; mudança de filtros durante carregamento.

- [x] 1. Dados e importação (`src/lib/domain.ts`, `scripts/sync.ts`, `tests/domain.test.ts`, `tests/sync.test.ts`): testar deduplicação, desconhecidos, validação espacial, retomada, falha parcial, associação PI fora da UF principal; implementar adaptadores oficiais, cache de páginas, limites e publicação atômica. Importar todo o recorte.
- [x] 2. Persistência e curadoria (`supabase/migrations`, `src/lib/supabase.ts`, `src/app/api/admin`, `tests/database.test.ts`): testar RLS com papéis públicos e administrador, evidências e histórico; implementar migrations, autenticação, perfis, vínculos e uploads privados.
- [x] 3. Consulta pública (`src/lib/repository.ts`, `src/app/api/public`, `src/components`): implementar busca agrupada, mapa municipal, agregados consistentes, listas paginadas, fichas e perfis; URLs e histórico preservam filtros e câmera.
- [x] 4. Verificação (`tests/e2e`, `.impeccable/review`): build, tipos, importação, permissões, fluxos reais, desktop e celular. Corrigir falhas observadas.
- [ ] 5. Operação (`README.md`, `.env.example`, `.github/workflows`): bootstrap, sincronização protegida, limites, recuperação, deploy reproduzível; publicar apenas com acesso autorizado e verificar URL.

## Ledger
- Pasta inicial vazia, sem Git. Nenhum trabalho existente a preservar.
- API consultada: 6.431 projetos com UF principal PI e natureza Obra; 13.877 associações de geometria, antes da deduplicação e filtros.
- Docker instalado, mas serviço indisponível. Testes SQL usarão PostgreSQL embarcado PGlite, com papéis e contexto auth de teste.

- Revisão independente de código corrigida; revisão Impeccable com três correções classificadas como resolvidas.
- Projeto Supabase gratuito criado com autorização; convite administrativo enviado.
- Build, 15 testes e 6 fluxos E2E (4 principais + 2 de contexto) passaram.
- Publicação Vercel autorizada com token temporário fornecido pelo usuário; repositório remoto vazio confirmado.
