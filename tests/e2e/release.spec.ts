import { expect, test } from "@playwright/test";

test("panorama, categorias e ordenação usam o recorte completo", async ({
  request,
}) => {
  const data = await (
    await request.get("/api/public?municipio=2211001")
  ).json();
  expect(
    Object.values(data.statusCounts).reduce<number>(
      (sum, n) => sum + Number(n),
      0,
    ),
  ).toBe(data.totals.count);
  expect(data.locatedCount).toBeLessThanOrEqual(data.totals.count);
  expect(
    new Set(data.categories.map((c: string) => c.toLocaleLowerCase("pt-BR")))
      .size,
  ).toBe(data.categories.length);
  const ordered = await (
    await request.get("/api/public?municipio=2211001&ordem=investimento")
  ).json();
  expect(
    ordered.items.every(
      (w: any, i: number, rows: any[]) =>
        i === 0 || (rows[i - 1].planned ?? -1) >= (w.planned ?? -1),
    ),
  ).toBeTruthy();
});

test("links sociais têm imagem real e ícone, e detalhes validam o identificador", async ({
  request,
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /opengraph-image/,
  );
  const image = await request.get("/opengraph-image");
  expect(image.ok()).toBeTruthy();
  expect(image.headers()["content-type"]).toContain("image/png");
  expect((await request.get("/icon.svg")).ok()).toBeTruthy();
  expect((await request.get("/api/details?obra=invalid%2Fid")).status()).toBe(
    400,
  );
  expect(
    (
      await request.get("/api/details?obra=nonexistent-release-record")
    ).status(),
  ).toBe(404);
});

test("falha da fonte preserva a ficha e permite tentar novamente", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/details?obra=*", (route) => {
    requests++;
    const empty = { state: "error", fetchedAt: null, rows: [] };
    return route.fulfill({
      json: {
        enrichment: {
          execution: empty,
          contracts: empty,
          commitments: empty,
          history: empty,
        },
      },
    });
  });
  await page.goto("/?obra=33112.22-36");
  await expect(page.locator(".detail-intro h1")).toBeVisible();
  const retry = page.getByRole("button", {
    name: "Tentar novamente",
    exact: true,
  });
  await expect(retry).toBeVisible();
  await expect(page.locator(".detail-summary")).toContainText("R$");
  await retry.click();
  await expect.poll(() => requests).toBeGreaterThan(1);
});
