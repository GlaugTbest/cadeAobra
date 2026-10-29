import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import {
  loadTerritory,
  GEOMETRY_SOURCE,
  MUNICIPALITIES_SOURCE,
  type CachedTerritory,
} from "../src/lib/territory";

async function cachedTerritory(): Promise<CachedTerritory> {
  const [municipalities, geo, provenance] = await Promise.all(
    ["municipalities.json", "piaui.geojson", "provenance.json"].map(
      async (file) => JSON.parse(await readFile(`public/data/${file}`, "utf8")),
    ),
  );
  return { municipalities, geo, provenance };
}
const now = "2026-10-28T16:00:00.000Z";
const timeout = async <T>(): Promise<T> => {
  throw new TypeError("fetch failed: UND_ERR_CONNECT_TIMEOUT");
};

it("mantém os 224 municípios oficiais quando o runner não alcança o IBGE", async () => {
  const cached = await cachedTerritory();
  const warn = vi.fn();
  const result = await loadTerritory(timeout, async () => cached, now, warn);
  expect(result.mode).toBe("versioned");
  expect(result.municipalities).toHaveLength(224);
  expect(result.geo.features).toHaveLength(224);
  expect(result.consultedAt).toBe(cached.provenance.consultedAt);
  expect(result.consultedAt).not.toBe(now);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("UND_ERR_CONNECT_TIMEOUT"));
});

it("prefere o par atualizado do IBGE quando as duas consultas funcionam", async () => {
  const cached = await cachedTerritory();
  const readCached = vi.fn();
  const remote = async <T>(url: string): Promise<T> => {
    if (url === MUNICIPALITIES_SOURCE)
      return cached.municipalities.map((t) => ({ id: t.id, nome: t.name })) as T;
    expect(url).toBe(GEOMETRY_SOURCE);
    return cached.geo as T;
  };
  const result = await loadTerritory(remote, readCached, now);
  expect(result.mode).toBe("remote");
  expect(result.consultedAt).toBe(now);
  expect(readCached).not.toHaveBeenCalled();
});

it("não mistura uma lista nova com uma malha antiga após falha parcial", async () => {
  const cached = await cachedTerritory();
  const remote = async <T>(url: string): Promise<T> => {
    if (url === MUNICIPALITIES_SOURCE)
      return [{ id: "2211001", nome: "Nome remoto diferente" }] as T;
    return timeout<T>();
  };
  const result = await loadTerritory(remote, async () => cached, now, vi.fn());
  expect(result.municipalities).toEqual(cached.municipalities);
  expect(result.geo).toEqual(cached.geo);
});

it("rejeita geometria local alterada em vez de publicar dados sem integridade", async () => {
  const cached = await cachedTerritory();
  cached.geo.features[0].properties.name = "Nome alterado";
  await expect(loadTerritory(timeout, async () => cached, now)).rejects.toThrow(
    "sem procedência válida",
  );
});

it("rejeita IDs municipais duplicados, mesmo com a contagem total preservada", async () => {
  const cached = await cachedTerritory();
  cached.geo.features[1].properties.codarea = cached.geo.features[0].properties.codarea;
  await expect(loadTerritory(timeout, async () => cached, now)).rejects.toThrow(
    "Malha e cadastro municipal divergem",
  );
});

it("preserva a data territorial original em atualizações consecutivas de obras", async () => {
  const cached = await cachedTerritory();
  cached.provenance.territoryConsultedAt = "2026-10-20T12:00:00.000Z";
  const result = await loadTerritory(timeout, async () => cached, now, vi.fn());
  expect(result.consultedAt).toBe("2026-10-20T12:00:00.000Z");
});

it("rejeita cópia sem fonte oficial ou data de consulta válida", async () => {
  const cached = await cachedTerritory();
  cached.provenance.municipalitiesSource = "https://example.com/municipios";
  await expect(loadTerritory(timeout, async () => cached, now)).rejects.toThrow(
    "sem procedência válida",
  );
});
