# Entrega e verificação — 27/10/2026

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

O estado confirmado de publicação será registrado abaixo após o deploy e os testes públicos.
