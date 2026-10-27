import { describe, it, expect } from "vitest";
import {
  normalizeWork,
  uniqueTotal,
  fold,
  safeOfficialUrl,
  validUpload,
} from "../src/lib/domain";
const base = {
  id_projeto_investimento: "0001.22-01",
  desc_nome: "Escola",
  natureza_intervencao: "Obra",
  investimentos_previstos: [
    { vl_investimento_previsto: 100, desc_nome_fonte_recurso: "Federal" },
  ],
  pins: [{ longitude: "0", latitude: "0" }],
};
describe("dados oficiais", () => {
  it("preserva identificador textual, valor desconhecido e não inventa localização", () => {
    const w = normalizeWork(
      { ...base, investimentos_previstos: [] },
      ["2200019"],
      [],
      new Date().toISOString(),
    );
    expect(w.id).toBe("0001.22-01");
    expect(w.planned).toBeNull();
    expect(w.locations).toEqual([]);
    expect(w.enrichment.execution.state).toBe("not_fetched");
  });
  it("deduplica obra e municípios nos agregados", () => {
    const w = normalizeWork(
      base,
      ["2200019", "2200019"],
      [],
      new Date().toISOString(),
    );
    expect(w.municipalityIds).toEqual(["2200019"]);
    expect(uniqueTotal([w, w])).toEqual({ count: 1, planned: 100, known: 1 });
  });
  it("mantém ausência se uma parcela prevista não foi informada", () => {
    expect(
      normalizeWork(
        {
          ...base,
          investimentos_previstos: [
            { vl_investimento_previsto: 100 },
            { vl_investimento_previsto: null },
          ],
        },
        [],
        [],
        new Date().toISOString(),
      ).planned,
    ).toBeNull();
  });
  it("normaliza busca sem acentos", () =>
    expect(fold("São JOÃO")).toBe("sao joao"));
  it("permite evidência oficial https e recusa urls internas e domínios disfarçados", () => {
    expect(safeOfficialUrl("https://www.gov.br/abc")).toBe(true);
    for (const u of [
      "http://gov.br",
      "https://gov.br.evil.org",
      "https://localhost",
      "javascript:alert(1)",
      "https://foo.gov.br:123/a",
    ])
      expect(safeOfficialUrl(u)).toBe(false);
  });
  it("valida assinatura e tamanho de upload", () => {
    expect(
      validUpload(new Uint8Array([37, 80, 68, 70, 45]), "application/pdf"),
    ).toBe(true);
    expect(validUpload(new Uint8Array([77, 90]), "application/pdf")).toBe(
      false,
    );
    expect(
      validUpload(new Uint8Array(6 * 1024 * 1024), "application/pdf"),
    ).toBe(false);
  });
});
