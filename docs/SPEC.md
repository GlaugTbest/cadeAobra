# Prompt para implementar o Cadê a Obra?

Implemente uma aplicação web pública chamada **Cadê a Obra?**, com dados reais e preparação para deploy. O produto ajuda qualquer pessoa a encontrar obras públicas em seu município, compreender investimentos e andamento e consultar os agentes relacionados a cada empreendimento, com fontes verificáveis.

## 1. Decisões do produto

- Lançamento em todo o **Piauí**, abrangendo os municípios oficiais do estado. Cobertura geográfica completa significa permitir consultar todos os municípios; a cobertura de obras é limitada aos registros das fontes integradas.
- Arquitetura preparada para ativar outras UFs progressivamente. Não importar nem carregar todo o Brasil no lançamento.
- Consulta pública sem cadastro. Administração restrita para curadoria, perfis e comprovação de vínculos.
- Dados automáticos oficiais, complementados por cadastro administrativo com documentos de comprovação.
- Prioridade a planos gratuitos, com limites e custos documentados. Não contratar serviços pagos nem ampliar planos sem autorização.
- Idioma pt-BR, moeda BRL e datas brasileiras. Interface eficiente em computador e celular.

Inspecione primeiro o repositório, suas instruções e ferramentas disponíveis. Preserve trabalho existente. Faça um plano curto e execute a implementação até obter um sistema funcional; este pedido inclui código, dados, testes e preparação para deploy, não apenas um protótipo visual. Resolva escolhas reversíveis com bom senso. Peça apenas informações externas realmente necessárias, como acesso a serviços. Não instale habilidades ou serviços desnecessários.

## 2. Referência e experiência do mapa

Analise https://seuimposto.com/ como referência de navegação geográfica. Na análise inicial, o endereço exibia uma aplicação de apuração: mapa vetorial com municípios, zoom, busca com sugestões, seleção por teclado, painel contextual, hierarquia Brasil/estado/município e URL que preserva a seleção. A referência pode mudar; siga estes comportamentos descritos mesmo se ela estiver indisponível.

Use uma identidade própria para o Cadê a Obra?, aproveitando a fluidez da referência. A página inicial deve abrir diretamente no mapa do Piauí e permitir duas entradas igualmente claras: clicar no município ou digitar seu nome. O mapa é a superfície principal, com busca visível, legenda compacta, resumo contextual e detalhes ao lado. Não anteponha uma landing page à tarefa.

Fluxo principal: **Piauí → município → obra → perfil de agente relacionado → outras obras desse agente**. Preserve o município, filtros e posição do mapa ao voltar. Links de município, obra e perfil devem funcionar ao abrir diretamente, recarregar, compartilhar e usar voltar/avançar do navegador.

- Estado: polígonos municipais clicáveis e contorno do Piauí. Uma escala sequencial pode representar a quantidade de obras únicas do recorte, com legenda que explique a métrica. Municípios sem registros permanecem pesquisáveis e selecionáveis.
- Município: enquadrar seu limite, mostrar resumo, lista de obras e localizações disponíveis. Uma obra com vários pontos continua sendo uma única obra. Coordenadas coincidentes precisam permitir selecionar cada empreendimento.
- Obra: destacar seus pontos e abrir uma ficha sem perder o contexto geográfico. Disponibilizar acesso permanente por URL.
- Busca: sugestões de municípios inicialmente; também pesquisar obras e agentes publicados, agrupando os tipos. Tolerar acentos e diferenças de caixa, mostrar município/UF, aceitar teclado e oferecer resultados vazios claros. Índice municipal leve, disponível sem consultar o governo a cada tecla.
- Filtros essenciais: situação oficial, categoria e município. Mapa, lista e totais devem representar o mesmo recorte. Oferecer limpar filtros e voltar ao Piauí.
- Desktop: mapa amplo e painel lateral com rolagem própria. Celular: busca acessível e painel inferior recolhível que preserve área útil do mapa; lista alternativa acessível.
- Direção visual proposta: tema escuro inspirado na referência, tipografia legível, controles discretos, foco visível e cores por situação acompanhadas de texto. Evitar estética eleitoral e cores por partido.

Carregue o mapa progressivamente. Use malhas locais simplificadas e camadas gráficas, não milhares de elementos HTML. Agrupe marcadores conforme o zoom e consulte detalhes sob demanda. A visão municipal não precisa de tiles de ruas; eventual mapa-base detalhado deve usar provedor configurável com atribuição e termos compatíveis com o deploy.

## 3. Dados reais e cobertura

Fonte principal: https://api-publica.obrasgov.gestao.gov.br/obras/docs
Esquema: https://api-publica.obrasgov.gestao.gov.br/obras/openapi.json

Valide o esquema e amostras atuais antes de programar integrações. Recursos observados, relativos a `/obras`:

- `/projeto-investimento`: projeto, situação, datas, órgãos, investimentos previstos, categorias e pontos.
- `/geometria`: associação com município e código IBGE.
- `/execucao-fisica`: percentual e datas de execução/atualização.
- `/contrato`: contratos, fornecedores e valores disponíveis.
- `/empenho`: informações orçamentárias e, quando preenchido, `codigo_autor_emenda`.
- `/historico-situacao-cancelada-paralisada`: histórico e justificativas disponíveis.
- `/data-atualizacao`: atualização da base, distinta da atualização de cada registro.

Uma consulta inicial `projeto-investimento?uf_principal=PI&natureza_intervencao=Obra&pagina=1&tamanho_da_pagina=20` retornou 6.431 registros em 27/10/2026. É uma observação datada, não um número fixo nem prova de cobertura exaustiva. Respeite a paginação documentada; a API observada permitia até 200 registros por página.

Use a API de Localidades e as malhas do IBGE para a geografia:

- https://servicodados.ibge.gov.br/api/v1/localidades/estados/22/municipios
- https://servicodados.ibge.gov.br/api/docs/malhas?versao=3
- https://servicodados.ibge.gov.br/api/v3/malhas/estados/22?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio

Na verificação inicial, a malha retornou 224 municípios em um GeoJSON de aproximadamente 126 KB. Valide novamente e relacione `codarea` ao código IBGE municipal. Salve a geometria como ativo estático versionado com origem e data. Não baixe malhas novamente a cada visita.

Preserve o identificador completo da obra como texto. Modele obras com múltiplos municípios e localizações. Consulte também associações de `/geometria` com `sg_uf=PI`, verificando se existem obras que atendem o Piauí mas têm outra UF principal. Não descarte esses casos apenas pelo filtro de UF principal. Documente o critério final de inclusão e exclusão.

O campo `executores` pode identificar órgão executor, e não necessariamente construtora ou engenheiro. Mantenha a semântica original. Valide coordenadas e inconsistências: obras sem localização confiável continuam na lista e nos totais, com indicação de localização indisponível. Não invente um ponto preciso usando o centro do município.

## 4. Ficha da obra e investimentos

Exiba nome, descrição, municípios atendidos, categoria, situação informada, cronograma disponível, avanço físico e sua data, responsáveis documentados, origem dos dados e última consulta bem-sucedida. Mostre fotos somente quando realmente disponíveis e com origem adequada.

Separe claramente investimento previsto, valor contratado, empenhado, liquidado e pago, quando disponíveis. Mostre fontes de recursos e contrapartidas quando a base permitir. Nunca trate investimento previsto como dinheiro pago. Não some contratos, empenhos e investimentos como se fossem parcelas independentes do mesmo total.

Valide a semântica de valores por contrato/projeto e de restos a pagar antes de agregar. Valores ausentes devem aparecer como não informados, não como zero. Uma obra atendendo vários municípios não deve ter seu valor integral somado repetidamente no total estadual nem ser apresentado como gasto exclusivo de cada cidade.

Não classifique automaticamente como atrasada ou irregular uma obra apenas por prazo antigo, cadastro desatualizado ou falta de conclusão. Mostre prazo previsto, situação da fonte e datas. Qualquer indicador derivado deve explicar a regra e suas limitações.

## 5. Perfis e vínculos de responsáveis

Entregue perfis públicos clicáveis de pessoas e organizações, com nome, tipo, papel exercido, informações profissionais/institucionais disponíveis, fontes e outras obras relacionadas. Fotos são opcionais; use iniciais quando não houver imagem com origem adequada.

Modele cada vínculo obra–agente separadamente, com papel, período, fonte, data de consulta e estado de publicação. Papéis possíveis:

- Responsável técnico pelo projeto, execução ou fiscalização, conforme ART/RRT ou documento oficial.
- Empresa contratada e fornecedor, com identificação por CNPJ quando disponível.
- Órgão gestor, executor, contratante, tomador ou repassador, preservando a distinção.
- Autor de emenda parlamentar, com vínculo demonstrado entre emenda e empreendimento.
- Gestor ou signatário, apenas quando o documento estabelecer sua participação e período.

Ser prefeito, governador ou parlamentar na época não comprova responsabilidade por uma obra. Não criar vínculos por nome parecido, proximidade geográfica, notícia sem confirmação ou coincidência de mandato. Um código de autor de emenda precisa ser resolvido por fonte oficial e ter sua relação com a obra validada; não é um nome pronto nem atribuição de responsabilidade técnica.

A consulta básica do Obrasgov não forneceu nomes de engenheiros nem uma lista completa de políticos. Portanto, implemente desde a primeira versão a complementação administrativa com evidências. Não prometa preenchimento automático universal. Integrações adicionais com fontes oficiais devem ser incorporadas somente quando acesso, qualidade e identificadores forem comprovados.

Para pessoas homônimas, use identificadores profissionais ou institucionais públicos e revisão documental; mantenha identidades separadas se houver dúvida. Não publique CPF, endereço residencial ou dados pessoais desnecessários.

Cada perfil deve listar suas obras por papel e situação, com filtros e mapa quando aplicável. Agregados devem usar obras distintas e explicitar que representam valores de empreendimentos relacionados, não recursos pessoais ou administrados integralmente pelo agente. Perfil sem vínculos publicados deve ter um estado vazio honesto.

## 6. Administração e comprovação

Área administrativa autenticada, inicialmente com um administrador, extensível a outros. Sem autocadastro público de administradores. Permita criar/editar perfis, associar papéis a obras, informar período e adicionar evidência por URL oficial ou upload de documento.

Evidências precisam registrar título, órgão emissor, URL ou arquivo, data e referência de página/trecho pertinente. Fluxo simples de rascunho → revisão → publicação, com histórico de alterações e identificação do administrador. Exigir evidência para publicar vínculos manuais. Emendas e registros automáticos também mantêm proveniência.

Documentos de trabalho ficam privados; a publicação de evidência deve ser explícita e usar versão adequada para divulgação. Se o arquivo contiver dados pessoais, permita publicar referência/trecho ou cópia com ocultação desses dados. Configure limites e validação de tipo/tamanho de upload, sem executar arquivos enviados.

Curadoria manual não pode ser perdida numa sincronização. Preserve campos oficiais e complementações como camadas separadas; sinalize conflitos para revisão.

## 7. Arquitetura, sincronização e desempenho

Stack sugerida para este projeto: **Next.js + TypeScript + Tailwind CSS + MapLibre GL JS; Supabase para PostgreSQL, Auth e Storage; Vercel para a aplicação; GitHub Actions para importação periódica**. Essa é uma recomendação técnica, não uma stack previamente exigida pelo usuário. Adapte se o repositório já tiver uma solução adequada e registre a decisão. Consulte documentação atual e fixe dependências com lockfile.

Use limites administrativos do IBGE e renderização vetorial. Dados da aplicação vêm de uma cópia normalizada própria, com consultas paginadas, índices, cache e resumos por município. Não repasse todas as consultas de visitantes ao Obrasgov.

Modele, no mínimo, localidades, obras, localizações, agentes, vínculos, fontes/evidências e execuções de sincronização. Preserve relações muitos-para-muitos. Prepare filtros e índices por UF, município, situação, categoria e identificador de agente; mantenha a camada de acesso à fonte separada da apresentação.

O importador deve ser idempotente, paginado, retomável e ter retries com espera progressiva, concorrência limitada, timeouts, logs e limite de trabalho por execução. Importações parciais não apagam a base anterior nem publicam totais incompletos como se fossem completos. Registre cobertura, início/fim, erros e última atualização válida; não deduza exclusão apenas porque uma consulta falhou.

Evite atualizar todos os detalhes de milhares de obras por requisições individuais em todo ciclo. Importe os cadastros básicos e associações municipais em lotes; complemente execução, contratos e empenhos com fila de enriquecimento e orçamento configurável de requisições. Priorize obras ativas e consultas relevantes. Caso use atualização sob demanda, faça-a no servidor, com cache, deduplicação e limites, preservando uma resposta rápida com os dados existentes. Diferencie detalhe ainda não consultado de campo realmente ausente na fonte.

Atualização diária é uma meta operacional inicial, não uma promessa de tempo real. Disponibilize execução manual autenticada ou por workflow protegido e alertas de falha. Histórico próprio começa quando o sistema passa a coletar dados; não invente alterações passadas.

Carregue apenas resumos e malhas necessários na primeira tela; consulte listas e fichas progressivamente. Mantenha UI funcional com API externa indisponível e com a última base válida. Mostre claramente quando dados estiverem desatualizados. Meça desempenho real em desktop e celular e documente o ambiente e os resultados, sem inventar benchmarks.

## 8. Segurança e publicação

Consulta pública de dados publicados; escrita restrita a administradores autorizados. A autorização deve existir no servidor e no banco, não só na interface. No Supabase, use RLS nas tabelas expostas, políticas de Storage, sessões verificadas e papéis administrativos não editáveis pelo próprio usuário. Proteja views e funções de agregação para não expor rascunhos ou arquivos privados. Nunca envie chaves privilegiadas ao navegador nem as inclua no repositório.

Valide entrada, parâmetros de busca, URLs de evidência e conteúdo exibido. Impeça importadores públicos arbitrários, upload anônimo e consultas externas arbitrárias a partir de URLs fornecidas por visitantes. Separe credenciais de produção e testes.

Prepare README, `.env.example` sem segredos, migrations, bootstrap do administrador, carga inicial, scripts e configuração de deploy. O deploy não pode depender de filesystem local persistente ou de processos longos dentro de uma requisição serverless.

Verifique limites e condições vigentes dos serviços. Vercel Hobby restringe uso a projetos pessoais não comerciais; não presumir compatibilidade com publicidade ou monetização futura. Supabase Free pode pausar após uma semana de inatividade e tem limites de banco, armazenamento e transferência. Registre essas limitações, exportação/recuperação dos dados e caminho de migração. Não contorne regras dos planos. Use retenção configurável de logs e snapshots para controlar espaço.

Documente também as limitações dos agendamentos do GitHub Actions e a operação manual. Não depender de horário exato de cron para a navegação funcionar.

Se houver contas e credenciais autorizadas disponíveis, faça o deploy e teste a URL pública. Se faltar acesso, conclua tudo que puder localmente e entregue os passos externos exatos, distinguindo claramente sistema testado, deploy preparado e deploy efetivamente realizado. Não afirmar que está publicado sem verificar.

## 9. Critérios de aceite

Verifique e demonstre:

1. Todos os municípios oficiais do Piauí podem ser encontrados pela busca e selecionados no mapa, inclusive sem obras registradas.
2. Busca e clique chegam ao mesmo município; zoom, painel e URL ficam sincronizados. A navegação também funciona com teclado e em celular.
3. Dados reais do Piauí aparecem; uma obra sem coordenadas segue disponível na lista. Múltiplos pontos/municípios não duplicam sua contagem estadual.
4. Ficha diferencia categorias de investimento, valores desconhecidos e datas de atualização.
5. Perfis mostram apenas vínculos publicados, papel, período e fonte; é possível navegar às demais obras do agente e voltar ao mapa.
6. Um administrador consegue publicar um vínculo comprovado. Usuário público não consegue escrever, ver rascunhos ou acessar evidências privadas, mesmo chamando a API diretamente.
7. Sincronizar novamente não duplica dados nem apaga curadoria. Falha parcial preserva dados válidos e registra cobertura incompleta.
8. Links diretos, recarregamento, compartilhar e voltar/avançar funcionam. Filtros preservam consistência entre lista, mapa e agregados.
9. Build, verificações de tipos e testes relevantes passam. Faça testes de integração de importação e permissões, e testes de ponta a ponta dos fluxos principais. Inspecione visualmente desktop e celular.
10. Configuração de produção e instruções de publicação são reproduzíveis. Smoke test público quando o deploy tiver ocorrido.

Dados sintéticos são permitidos apenas em testes ou numa demonstração explicitamente identificada, separada da produção. Nunca preencher falta de dados reais com engenheiros, políticos, fotos ou valores inventados.

## 10. Entrega e limites do escopo

Entregue código funcional, migrations, importador, curadoria administrativa, mapa municipal do Piauí, fichas, perfis, testes, documentação e preparação de deploy. Faça primeiro uma fatia vertical real — município → obra → perfil documentado — e amplie a ingestão para todo o estado. Não encerrar a entrega apenas nessa fatia.

Assuma como fora desta primeira versão: importação nacional completa, comentários públicos, chat, ranking de políticos, denúncias, aplicativo nativo, notificações por WhatsApp e uso de IA para preencher fatos. Preserve a estrutura para expansão por UF sem reescrever o produto.

Ao finalizar, informe o que funciona, cobertura e lacunas reais das fontes, validações executadas, estado do deploy e próximos passos externos necessários. Priorize rapidez para encontrar a cidade, clareza sobre dinheiro e rastreabilidade dos vínculos.
