import { it, expect } from "vitest";
import { collectPages } from "../src/lib/ingestion";
it("aceita ausência oficial: total zero com page_size zero", async () => {
  expect(
    await collectPages(
      async () => ({
        data: [],
        total_pages: 0,
        total_items: 0,
        page_number: 1,
        page_size: 0,
      }),
      new Map(),
      1,
    ),
  ).toEqual([]);
});
it("retoma paginação sem duplicar e rejeita página parcial", async () => {
  const pages = new Map<number, unknown>();
  let calls = 0;
  const fetcher = async (p: number) => {
    calls++;
    if (p === 2 && calls === 2) throw Error("falha");
    return {
      data: [{ id: p }],
      total_pages: 2,
      total_items: 2,
      page_number: p,
      page_size: 1,
    };
  };
  await expect(collectPages(fetcher, pages, 10)).rejects.toThrow("falha");
  const result = await collectPages(fetcher, pages, 10);
  expect(result).toHaveLength(2);
  expect(calls).toBe(3);
  await expect(
    collectPages(
      async (p) => ({
        data: [],
        total_pages: 2,
        total_items: 2,
        page_number: p,
        page_size: 1,
      }),
      new Map(),
      10,
    ),
  ).rejects.toThrow();
});
