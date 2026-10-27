export type Page<T> = {
  data: T[];
  total_pages: number;
  total_items: number;
  page_number: number;
  page_size: number;
};
export async function collectPages<T>(
  fetcher: (page: number) => Promise<Page<T>>,
  cache: Map<number, unknown>,
  budget: number,
  onPage?: (page: number, result: Page<T>) => Promise<void>,
): Promise<T[]> {
  let rows: T[] = [],
    total = 1,
    expected = 0;
  for (let p = 1; p <= total; p++) {
    let page = cache.get(p) as Page<T> | undefined;
    if (!page) {
      if (budget-- <= 0)
        throw Error("Orçamento de requisições atingido; retome a execução.");
      page = await fetcher(p);
      cache.set(p, page);
      await onPage?.(p, page);
    }
    if (
      !Array.isArray(page.data) ||
      page.page_number !== p ||
      page.total_pages < 0 ||
      page.total_items < 0 ||
      (page.page_size < 1 && page.total_items !== 0)
    )
      throw Error("Página inválida");
    if (p === 1) {
      total = Math.max(1, page.total_pages);
      expected = page.total_items;
    } else if (
      page.total_items !== expected ||
      Math.max(1, page.total_pages) !== total
    )
      throw Error("A base mudou durante a paginação; inicie um novo ciclo.");
    if (page.data.length === 0 && expected > 0)
      throw Error("Página parcial ou vazia inesperada");
    rows.push(...page.data);
  }
  if (rows.length !== expected)
    throw Error(`Paginação incompleta: ${rows.length}/${expected}`);
  return rows;
}
export async function retryJson<T>(url: string, attempts = 4): Promise<T> {
  for (let n = 0; ; n++)
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(45000),
        headers: { Accept: "application/json", "User-Agent": "CadeAObra/1.0" },
      });
      if (!r.ok) {
        if (r.status >= 400 && r.status < 500 && r.status !== 429)
          throw Object.assign(Error(`HTTP ${r.status}`), { terminal: true });
        throw Error(`HTTP ${r.status}`);
      }
      return (await r.json()) as T;
    } catch (e) {
      if (n >= attempts - 1 || (e as { terminal?: boolean }).terminal) throw e;
      await new Promise((r) =>
        setTimeout(r, Math.min(15000, 700 * 2 ** n + Math.random() * 300)),
      );
    }
}
