---
name: Cadê a Obra?
description: Atlas público de obras do Piauí, com consulta direta e fontes verificáveis.
colors:
  background: "#101918"
  panel: "#192320"
  divider: "#34423a"
  text: "#f0f1e9"
  muted: "#b0bdb0"
  selection: "#edd79a"
  map-zero: "#263630"
  map-one: "#295343"
  map-twenty: "#357457"
  map-hundred: "#64a87a"
  map-five-hundred: "#b6d5a2"
typography:
  title:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "32px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-1px"
  metric:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "27px"
    fontWeight: 600
    letterSpacing: "-0.7px"
  body:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  work-title:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: "14px"
    fontWeight: 550
    lineHeight: 1.65
  supporting:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: "12px"
rounded:
  field: "7px"
  filter: "5px"
  sheet: "16px 16px 0 0"
spacing:
  panel-inset: "24px"
  panel-inset-mobile: "20px"
  search-inset-mobile: "14px"
components:
  search:
    backgroundColor: "#243027"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    height: "48px"
    padding: "0 13px"
  filter:
    backgroundColor: "#1d2921"
    textColor: "#e2e8da"
    rounded: "{rounded.filter}"
    padding: "10px 22px 10px 9px"
  map-control:
    backgroundColor: "#1b2621"
    textColor: "{colors.text}"
    size: "38px"
  map-control-mobile:
    backgroundColor: "#1b2621"
    textColor: "{colors.text}"
    size: "44px"
  mobile-handle:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.muted}"
    height: "44px"
    typography: "{typography.supporting}"
---

# Design System: Cadê a Obra?

## Overview

**Creative North Star: "Atlas público"**

Consulta imediata em um mapa escuro. A cartografia real dos municípios do IBGE ocupa a superfície principal; busca, lista e fichas organizam a leitura sem transformar a interface em uma coleção de cartões. A identidade é sóbria, pública e sem estética eleitoral.

**Key Characteristics:**
- Mapa como ponto de entrada, com lista equivalente.
- Verde sequencial para quantidade; amarelo cálido para seleção e destaque.
- Painéis opacos, divisórias finas e informação literal.

## Colors

### Primary

- **Verdes cartográficos:** rampa sequencial aplicada à quantidade de obras únicas no recorte, com marcos em 0, 1, 20, 100 e 500+. A legenda acompanha o mapa.
- **Amarelo cálido:** contorno do município selecionado, pontos de obras, valores destacados, aba ativa e foco.

### Neutral

- **Carvão esverdeado:** fundo contínuo do mapa e da aplicação.
- **Verde de painel:** superfície opaca dos resultados e detalhes.
- **Divisória vegetal:** separa regiões, linhas da lista e blocos de informação.
- **Marfim e sálvia:** texto principal e texto de apoio, respectivamente.

**The Cartographic Meaning Rule.** Cor geográfica representa quantidade ou seleção; situação oficial sempre aparece também em texto.

## Typography

Manrope Variable em títulos e números de destaque; DM Sans Variable na leitura, navegação e controles. As duas famílias são auto-hospedadas pelo projeto. Valores e contagens usam algarismos tabulares.

O título do recorte reduz para (27px) no celular; os indicadores reduzem para (25px). Títulos de obras mantêm a leitura em (14px), com largura de até (35ch). Rótulos dos indicadores, filtros, situação, metadados da lista e a ressalva financeira usam o papel supporting. Legenda, atribuição, rodapé e metadados secundários têm tamanhos próprios menores; não usar essas exceções para o conteúdo principal.

## Layout

Aplicação em altura de viewport dinâmica, com cabeçalho, área de trabalho e rodapé. No desktop, painel esquerdo de (408px), busca acima dos resultados e mapa à direita. O painel passa a (360px) até (1050px), e a (440px) a partir de (1600px). Lista, ficha e perfil compartilham o mesmo painel rolável.

Até (700px), cabeçalho de (62px), busca no topo e painel inferior. A entrada inicial recolhe o painel para (44px); expandido, ele ocupa (49%) da área de trabalho. O mapa usa somente o espaço livre acima do painel. Ao recolher ou expandir, o mapa redimensiona e reenquadra o estado ou município selecionado nessa área efetiva. A navegação para um resultado expande o painel.

## Elevation & Depth

A profundidade vem principalmente de superfícies opacas e bordas discretas. Sombras ficam em elementos sobrepostos: sugestões de busca, seleção de pontos, painel móvel, aviso e informações sobre os dados. O painel desktop e as linhas da lista permanecem planos.

## Shapes

Campos e controles têm cantos discretamente arredondados. O painel móvel recebe cantos superiores amplos, mantendo a borda inferior alinhada à tela. Listas usam linhas divisórias em vez de cartões individuais. Ícones Lucide acompanham ações; a marca usa um pin de traço fino.

## Components

- **Busca:** campo persistente para cidade, obra ou agente; sugestões em superfície opaca. Borda amarela ao receber foco, atalho / e seleção por teclado.
- **Filtros e abas:** seletores nativos com rótulos visíveis; aba ativa marcada por texto e sublinhado amarelo. A contagem acompanha a aba.
- **Linha de obra:** situação e categoria, título legível, valor previsto e precisão de localização. Toda a linha abre a ficha; o hover muda discretamente o fundo.
- **Mapa municipal:** polígonos reais do IBGE, contorno amarelo na seleção e enquadramento suave. Pontos só aparecem com coordenadas disponíveis; agrupamentos abrem uma lista de escolhas.
- **Controles do mapa:** coluna de aproximar, afastar e enquadrar Piauí, com nomes acessíveis. Área de toque de (44 × 44px) no celular; dimensões desktop definidas em map-control.
- **Painel móvel:** alça de largura total, texto “ver lista” ou “Recolher painel” e estado expandido exposto à tecnologia assistiva. Sem animação de altura, para reenquadramento imediato do mapa.
- **Ficha e fontes:** seções com divisórias, dados tabulares e links de origem. Ausências, cobertura e datas são explícitas.

O foco visível usa contorno amarelo de (2px), com afastamento de (4px). A câmera anima por (650ms) ao selecionar um recorte; a preferência por movimento reduzido elimina essa transição e as animações da interface.

## Do's and Don'ts

### Do:
- **Do** manter mapa, busca e lista como caminhos equivalentes de consulta.
- **Do** preservar a rampa sequencial e a legenda ao representar quantidades.
- **Do** reenquadrar a cartografia no espaço realmente livre do painel móvel.
- **Do** manter texto legível para situação, previsão financeira e ausência de dados.

### Don't:
- **Don't** substituir a cartografia real por ilustração demonstrativa.
- **Don't** usar estética eleitoral, cores partidárias ou fotografias inventadas.
- **Don't** transformar cada linha de resultado em cartão decorativo.
- **Don't** representar uma obra sem coordenadas por um ponto inventado no centro do município.
