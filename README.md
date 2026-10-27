# Cadê a Obra?

Aplicação pública para consultar obras que atendem o Piauí, investimentos previstos e agentes relacionados com fontes verificáveis. A entrada é diretamente no mapa, sem cadastro público.

## Executar

Requer Node.js 24 e npm. Na pasta do projeto:

```sh
npm ci
npm run dev
```

Abra `http://localhost:3000`. O snapshot oficial versionado permite consultar a aplicação sem credenciais. Para usar o Supabase, copie `.env.example` para `.env.local` e preencha URL e chave **publicável**. Nunca coloque a chave de serviço em variável `NEXT_PUBLIC_*`.

```sh
npm test
npm run build
npm run typecheck
npx playwright install chromium
# Inicie npm start em outro terminal antes do teste:
npm run test:e2e
```

`PLAYWRIGHT_BASE_URL` permite testar outra URL; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permite usar uma instalação local do Chromium. Os testes de interface utilizam dados reais de leitura. Dados de teste e permissões são exercitados em um PostgreSQL PGlite isolado, sem inserir pessoas ou obras fictícias em produção.

## Cobertura da carga inicial

Consulta de 27/10/2026: **224 municípios e 6.442 obras únicas**. Foram consultados 6.431 projetos com UF principal PI e natureza Obra e 13.877 associações de geometria. O cruzamento acrescentou 11 obras com outra UF principal. Dos 148 IDs adicionais consultados, 137 eram outras naturezas de intervenção e foram excluídos.

Há 12 obras de UF principal PI sem associação municipal válida e 602 sem coordenadas que passem na validação espacial. Elas permanecem na listagem e no total estadual. Esses números descrevem esta carga e não são metas fixas nem prova de cobertura exaustiva.

O critério de inclusão é natureza oficial **Obra** e (UF principal PI **ou** associação de geometria com município oficial do PI). IDs completos são textos. Municípios e pontos são relações múltiplas, sem multiplicar a obra no total estadual. Coordenadas só aparecem quando contidas em um dos municípios associados da malha simplificada do IBGE; essa validação conservadora pode omitir pontos próximos às bordas. Não se usa centro municipal como localização substituta.

Fontes: [Obrasgov](https://api-publica.obrasgov.gestao.gov.br/obras/docs), [municípios IBGE](https://servicodados.ibge.gov.br/api/v1/localidades/estados/22/municipios), [malhas IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3). Origem, data e checksum da geometria ficam em `public/data/provenance.json`. A malha estática local é carregada uma vez por visita; digitar não consulta o governo.

## Arquitetura

- Next.js 16, React 19, TypeScript, Tailwind 4, MapLibre GL JS 6, fontes locais DM Sans e Manrope, ícones Lucide.
- APIs públicas paginadas; filtros, contagens e soma de projetos distintos executados no PostgreSQL. Listas retornam 30 obras. Fichas e perfis são consultados sob demanda. Cache público no CDN de 60 s, com revalidação de 300 s.
- Supabase PostgreSQL, Auth e Storage. RLS protege dados mesmo no acesso direto à API. Perfis e vínculos manuais são separados das versões de dados oficiais.
- Snapshot de recuperação em `data/snapshot.json`, incluído no pacote do servidor. Não é servido como arquivo público integral. Em indisponibilidade do banco, a consulta oficial usa essa cópia e conserva sua data original. Complementações manuais não são inventadas durante a falha.
- MapLibre usa polígonos e camadas gráficas, sem tiles de rua ou credenciais de provedor. O worker e sua licença são copiados no `postinstall`. Pontos sobrepostos têm seleção individual, inclusive depois de desfazer os agrupamentos. Alternativa em lista e mapa SVG quando WebGL não está disponível.

## Banco e primeiro administrador

As migrations estão em `supabase/migrations`, na ordem dos nomes gerados pela CLI. Em um projeto novo, aplique-as pelo SQL Editor ou pelo fluxo da CLI `supabase db push` após vincular o projeto. Não reaplique sobre uma base existente sem conferir o histórico. O projeto provisionado nesta entrega já recebeu as migrations.

Para a carga normal e futuras atualizações, configure `SUPABASE_SERVICE_ROLE_KEY` apenas no ambiente privado do operador ou do workflow:

```sh
npm run sync
npm run seed
```

O bootstrap depende de `ADMIN_EMAIL`, chave de serviço e `NEXT_PUBLIC_SITE_URL`:

```sh
npm run bootstrap:admin
```

O script envia convite pelo Supabase Auth e imprime a instrução SQL para conceder o papel em `private.administrators`. Execute essa instrução como proprietário no SQL Editor. Esse papel não é editável pelo usuário nem vem de `user_metadata`. Não há autocadastro de administradores. Configure **Authentication → URL Configuration** com a URL pública do site e os redirecionamentos `/admin`; durante desenvolvimento, permita `http://localhost:3000/admin`.

O primeiro administrador desta entrega já foi convidado e autorizado pelo e-mail informado na conversa. A função temporária de provisionamento foi encerrada; seu endpoint retorna 410 e exige JWT. Não há credencial de provisionamento no repositório.

Em `/admin`, crie um perfil e escolha se deseja publicá-lo. Crie vínculo com ID completo da obra, papel, período e evidência. Documentos de trabalho ficam privados. Para publicar, marque explicitamente a divulgação da referência/trecho, salve o rascunho, envie para revisão e publique. A publicação da cópia PDF é outra opção explícita. Um vínculo publicado precisa voltar a rascunho antes de mudar seu conteúdo. Alterações mantêm administrador e histórico.

PDFs são limitados a 5 MB, MIME e assinatura PDF. Arquivos não são executados no servidor. Oculte dados pessoais na cópia que será publicada; a plataforma não faz anonimização automática. URLs precisam ser HTTPS de domínio oficial brasileiro. A aplicação não busca conteúdo de URLs fornecidas pelo público. CPF e endereços residenciais não têm campos de publicação.

## Dinheiro, responsáveis e lacunas

Investimento previsto é soma das parcelas previstas informadas por fonte, para cada projeto distinto. Se uma parcela é desconhecida, o total da obra permanece desconhecido. Contratos mostram valor global e valor utilizado no projeto **separadamente**, sem somar o global como custo exclusivo da obra. Empenhos apresentam empenhado, liquidado, pago no exercício e restos a pagar separadamente; não são somados a investimentos ou contratos. Obras com vários municípios/UFs têm valor do empreendimento inteiro, sem rateio inventado.

O cadastro básico fornece órgãos responsáveis, executores, tomadores e repassadores; os papéis são preservados. Não há preenchimento universal de engenheiros ou políticos. CNPJ público identificado une organizações; registros sem identificador ficam separados para evitar unir homônimos. A versão inicial possui muitos perfis institucionais de mesmo nome sem identificador, por essa razão. Um código de autor de emenda não é convertido em nome nem em responsabilidade técnica.

Detalhes de execução, contratos, empenhos e históricos têm estados distintos: ainda não consultado, consultado sem informação, erro ou conteúdo obtido. O orçamento inicial de enriquecimento é 24 consultas por execução, com prioridade a obras em execução e detalhes mais antigos/não consultados. Amplie esse orçamento conscientemente após observar limites e demanda. A tela mostra as datas e ausências, sem inventar fatos ou classificar irregularidade automaticamente.

## Sincronização e operação

O importador pagina até 200 itens conforme o esquema observado, valida os totais e rejeita paginação parcial ou base alterada durante a consulta. Há timeout, até quatro tentativas com espera progressiva, concorrência máxima de três nos IDs adicionais, limite de requisições e limite de tempo. `data/checkpoints/<ciclo>` permite retomar; `SYNC_CYCLE` seleciona o ciclo. Se a fonte mudou os totais, use um ciclo novo para não misturar páginas.

Uma execução completa grava o snapshot local por renomeação atômica. O seed grava uma versão em staging, carrega relações e somente ativa a versão quando a contagem confere. Falhas preservam a versão ativa; não há dedução de exclusão por ausência numa consulta que falhou. Reexecutar o mesmo snapshot é idempotente. O enriquecimento anterior é lido da versão ativa no Supabase em execuções com chave de serviço, preservando o progresso entre runners novos. A curadoria não é sobrescrita.

O workflow `.github/workflows/sync.yml` oferece execução manual e tentativa diária às **05:17 de Brasília**. Cron do GitHub pode atrasar ou ser omitido em momentos de carga e pode ser desativado por inatividade; a navegação nunca depende do horário. Configure o environment protegido `production`, limite seus operadores e cadastre secrets `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Ative notificações de falha do Actions na conta; falhas geram execução com logs e resumo. O agendamento só funciona depois desses passos externos.

`SYNC_REQUEST_BUDGET=400`, `SYNC_MAX_MINUTES=30`, `ENRICH_REQUEST_BUDGET=24`, `SNAPSHOT_RETENTION=2`. O banco retém a versão ativa e a anterior. Logs do Actions ficam 14 dias; artefatos de falha do CI, 7. Checkpoints locais e registros de auditoria exigem revisão periódica de espaço pelo operador; não elimine evidências ou histórico sem política de retenção definida. `private.sync_runs` registra publicação/falha da carga; falhas anteriores à etapa de seed ficam no log e artefato do workflow.

## Publicação e limites

Importe este repositório na Vercel como projeto Next.js, com Node.js 24, `npm ci` e `npm run build`. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SITE_URL` no projeto e publique. A chave de serviço não é necessária para a navegação ou curadoria em produção. O trabalho longo de importação ocorre no Actions, não em requisição serverless. `vercel.json` seleciona São Paulo.

Valores e termos verificados em 27/10/2026: [Supabase Free](https://supabase.com/pricing) oferece banco de 500 MB, arquivos de 1 GB, 5 GB de egress e 5 GB de egress em cache, dois projetos ativos e pausa após uma semana sem atividade. [Vercel Hobby](https://vercel.com/docs/plans/hobby) se destina a uso pessoal não comercial; publicidade ou monetização futura exige reavaliar a compatibilidade e o plano. Nenhum plano pago foi autorizado. A proteção de senha vazada do Supabase estava desativada no projeto novo; não houve upgrade para ativar recurso pago.

Para recuperação, exporte banco e Storage pelo dashboard/CLI em ambiente privado e teste restauração em projeto separado. Migrations e snapshot oficial versionado recompõem a consulta; **não** recompõem curadoria, usuários ou documentos privados, que precisam de backup próprio. Copie esses backups para armazenamento sob controle do operador, sem publicá-los no Git. Para migrar, restaure PostgreSQL/Storage, reaplique as políticas, recrie a configuração Auth, troque as variáveis e valide permissões e links antes de apontar o domínio.

O estado efetivo da publicação e as verificações executadas estão em `docs/DELIVERY.md`. Nenhum endereço esperado equivale a deploy confirmado.
