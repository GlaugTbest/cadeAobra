# Entrega e verificação — 27/10/2026

## Correção da sincronização — 28/10/2026

A execução agendada `40712419293` falhou em `npm run sync` por `UND_ERR_CONNECT_TIMEOUT` ao conectar ao IBGE a partir do runner do GitHub. O importador agora pode usar o par territorial oficial versionado, com verificação de fonte, IDs, nomes e checksum, mantendo a data territorial original separada da nova consulta das obras. Sem cópia válida, a publicação continua bloqueada. O cache de checkpoints agora é salvo também após falhas; a checagem de credenciais foi antecipada para evitar baixar uma base que não poderá ser publicada.

Validação isolada do script completo, simulando indisponibilidade do IBGE e consultando o Obrasgov real: 255 requisições, 6.445 obras, 224 municípios e fonte atualizada em 28/10/2026. Nenhuma escrita em produção foi feita nessa validação. Passaram 29 testes, TypeScript e build de produção. O environment `production` foi conferido e ainda não possui secrets; a publicação diária depende do cadastro de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

## Versão preparada para divulgação — revisão de 27/10/2026

Interface refinada em petróleo, turquesa, esmeralda e âmbar; panorama por situação no recorte inteiro, categorias equivalentes reunidas, ordenação por andamento/investimento/nome, resumo financeiro na ficha e legenda móvel recolhível. Caracteres de controle são corrigidos somente na apresentação; registros brutos, IDs e valores não são reescritos. Ícone e imagem Open Graph incluídos; a imagem usa geografia e contagens reais da base versionada.

Detalhes oficiais agora são consultados ao abrir uma obra em `/api/details`, com leitura progressiva, limites de tempo/paginação/concorrência, preservação do resultado anterior e nova tentativa. A data de consulta é armazenada junto ao resultado em cache. Verificação real da obra 33112.22-36 retornou 3,29% de execução e dois registros de empenho. Campos ausentes permanecem ausentes; valor previsto não vira pagamento. A cobertura básica segue a data da carga, separada das datas dos detalhes consultados.

Validações desta revisão: 22 testes internos, build e TypeScript passaram; 14 testes de navegação passaram em desktop e celular emulado, incluindo erros da fonte, nova tentativa, contagens, ordenação, metadados e permissões públicas. Lighthouse móvel local: 100 em acessibilidade, boas práticas e SEO; sem falhas retornadas na execução. A medição não representa desempenho em aparelhos físicos. Revisão independente corrigiu datas do cache, limites totais de consulta e nova tentativa após falha parcial.

Migrations `public_explorer_insights` e `descriptive_work_order` aplicadas ao projeto Supabase existente. CI e sincronização fixados no Ubuntu 24.04 para compatibilidade com o navegador dos testes. A carga integral diária continua dependendo dos secrets do environment `production` no GitHub; a nova consulta dos detalhes funciona sem chave de serviço e não é apresentada como sincronização integral diária.

## Sistema implementado

Mapa municipal do Piauí, busca por teclado de municípios/obras/agentes, filtros, listas paginadas, fichas com categorias financeiras separadas, perfis documentados, links permanentes e histórico de navegação. Painel móvel compacto e expansível, mapa reenquadrado na área disponível e lista alternativa. Administração com Auth, perfis, evidências privadas, publicação em etapas e auditoria. Importação oficial retomável e ativação atômica de versões, preservando curadoria e progresso de enriquecimento.

Supabase gratuito provisionado separadamente em São Paulo. Base ativa: 6.442 obras, 224 municípios, 19.722 vínculos institucionais. São 7.098 perfis oficiais, incluindo registros mantidos separados por falta de identificador. Nenhum responsável técnico ou político foi inventado. 602 obras sem coordenadas validadas e 12 sem município associado permanecem acessíveis.

## Validações executadas

- 15 testes de normalização, paginação e PostgreSQL/RLS passaram. Cobrem ausência de valores, URLs, PDF, dados parciais, rascunhos, escrita indevida, promoção indevida, evidências, publicação após revisão, auditoria e perfil publicado sem vínculo.
- Quatro testes de ponta a ponta passaram no build de produção, em desktop e celular: geografia completa, filtros/contagens, escrita pública bloqueada, busca por teclado, obra → perfil, voltar/recarregar/links diretos e painel móvel. Mais dois testes verificam retorno à página 2 com rolagem preservada.
- Build de produção e verificação de TypeScript passaram. Auditoria npm das dependências de produção: nenhuma vulnerabilidade reportada na consulta.
- Revisão independente de código: corrigidos progresso do enriquecimento em runners novos, perfil publicado sem vínculo, seleção de pontos sobrepostos, consultas progressivas no banco e preservação de página/rolagem.
- Revisão independente Impeccable: ajustes de enquadramento/painel móvel, legibilidade e controles de 44px classificados como resolvidos. Disposição **Ship no escopo de UI revisado**.
- Advisors do Supabase: nenhum erro crítico de segurança retornado. Há aviso de proteção contra senhas vazadas desativada e informação de RLS sem política em `private.administrators` (bloqueio intencional ao cliente). Não houve contratação de recurso pago.

## Medição local

Windows, Node 24.16.0, build Next de produção em localhost, Chromium headless 145, sem limitação artificial de CPU/rede, Supabase em São Paulo. Uma medição por viewport, não benchmark de produção: desktop 1440×1000 DPR1, FCP 408 ms e dados/mapa prontos em aproximadamente 2.283 ms; celular 390×664 DPR3, FCP 368 ms e dados/mapa prontos em aproximadamente 1.947 ms. Valores incluem a espera dos testes pelos dados e pelo mapa, com condições locais e caches daquela execução. Não representam aparelhos físicos, redes móveis ou SLA.

## Operação externa

O convite do primeiro administrador foi enviado ao e-mail solicitado e o usuário foi autorizado. A senha é definida pelo destinatário; não foi solicitada nem manuseada nesta conversa.

O workflow diário está preparado, mas precisa de secrets `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no environment protegido `production` do GitHub. Essa chave de serviço não foi exposta nem adicionada ao repositório. Configure notificações de falha do Actions. Antes de usar links de recuperação/convite em produção, configure a URL pública e redirecionamentos no Supabase Auth.

## Publicação confirmada

Site público: https://cade-a-obra.vercel.app. Código enviado a https://github.com/GlaugTbest/cadeAobra. Projeto Vercel Hobby ligado ao GitHub. A primeira publicação retornou 200 na página inicial e em `/admin`, 6.442 obras na consulta pública e 401 na API administrativa sem login. Os seis fluxos E2E também passaram na URL pública.

## Refinamento do mapa

Hover com borda branca e base escura, rampa sequencial com seis marcos, município selecionado em jade/dourado e demais municípios discretos e clicáveis. Legenda contextual opaca distingue cidades e pontos. A revisão Impeccable encontrou e levou à correção do destaque de obra dentro de agrupamentos: a obra aberta agora usa fonte geográfica separada, sem cluster, com centro branco. Verificados visão estadual, hover, Floriano selecionado, vizinho sob o mouse e ficha de obra em desktop e celular. Build e 15 testes passaram; os seis fluxos E2E passaram no build com o refinamento. Revisão final Impeccable: Ship neste escopo, com afastamento entre legenda e texto do mapa aplicado.

## Visualização das obras

Substituição posterior dos círculos por pins com ícones e grupos retangulares de tamanho fixo. Agrupamento por distância na tela, contagem de obras únicas e âncora em coordenada real; a obra aberta tem prioridade na posição e recebe destaque dourado. Botões com rótulos acessíveis, tooltip e seleção de obras coincidentes. Lista e ficha com representação por tipo, sem fotografias genéricas. Nos 6.579 registros brutos consultados, apenas dois informam `ind_foto: SIM`, sem endereço de imagem; nenhuma foto verificável está disponível para exibição. Revisão Impeccable aprovada no escopo, com ajustes de chip móvel e ordem do título aplicados. Testes adicionais cobrem deduplicação, agrupamento, âncora selecionada e dimensões dos marcadores ao afastar o zoom em desktop e celular.
