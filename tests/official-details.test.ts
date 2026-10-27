import { expect, it, vi } from "vitest";
import { fetchOfficialDetail } from "../src/lib/official-details";
import { displayText, displayCategory } from "../src/lib/presentation";

const row = {
  id_projeto_investimento: "001.22-01",
  percentual_execucao_fisica: 3.29,
};
const reply = (data: unknown[], page = 1, pages = 1, total = data.length) =>
  new Response(
    JSON.stringify({
      data,
      page_number: page,
      total_pages: pages,
      total_items: total,
    }),
  );
it("consulta o ID textual e pagina sem ocultar registros", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(reply([row], 1, 2, 2))
    .mockResolvedValueOnce(reply([row], 2, 2, 2));
  const result = await fetchOfficialDetail(
    "001.22-01",
    "execucao-fisica",
    fetcher,
  );
  expect(result.state).toBe("fetched");
  expect(result.rows).toHaveLength(2);
  expect(String(fetcher.mock.calls[1][0])).toContain("pagina=2");
  expect(String(fetcher.mock.calls[0][0])).toContain(
    "id_projeto_investimento=001.22-01",
  );
});
it("não transforma resposta parcial ou de outra obra em sucesso", async () => {
  for (const response of [
    reply([row], 1, 1, 2),
    reply([{ ...row, id_projeto_investimento: "other" }]),
    reply([row], 1, 6, 6),
  ]) {
    await expect(
      fetchOfficialDetail(
        "001.22-01",
        "contrato",
        vi.fn().mockResolvedValue(response),
      ),
    ).rejects.toThrow();
  }
});
it("distingue consulta vazia bem-sucedida de falha", async () => {
  expect(
    (
      await fetchOfficialDetail(
        "001.22-01",
        "empenho",
        vi.fn().mockResolvedValue(reply([], 1, 0, 0)),
      )
    ).rows,
  ).toEqual([]);
  await expect(
    fetchOfficialDetail(
      "001.22-01",
      "empenho",
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
    ),
  ).rejects.toThrow();
});
it("corrige caracteres de apresentação sem inventar conteúdo", () => {
  expect(displayText("Creche\u0096Tipo 2\t no Piauí")).toBe(
    "Creche–Tipo 2 no Piauí",
  );
  expect(displayCategory("Defesa civil")).toBe("Defesa Civil");
  expect(displayText("18 00043/2008")).toBe("18 00043/2008");
});
