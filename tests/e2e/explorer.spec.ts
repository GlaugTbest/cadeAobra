import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
test("fontes reais, filtros e permissões públicas", async ({ request }) => {
  const r = await request.get("/api/public");
  expect(r.ok()).toBeTruthy();
  const d = await r.json();
  expect(d.metadata.coverage.municipalities).toBe(224);
  expect(d.totals.count).toBe(d.metadata.coverage.works);
  const towns = await (await request.get("/data/municipalities.json")).json();
  const geo = await (await request.get("/data/piaui.geojson")).json();
  expect(towns).toHaveLength(224);
  expect(
    new Set(geo.features.map((f: any) => String(f.properties.codarea))),
  ).toEqual(new Set(towns.map((m: any) => m.id)));
  const f = await (
    await request.get(
      "/api/public?municipio=2211001&situacao=Em%20execu%C3%A7%C3%A3o",
    )
  ).json();
  expect(f.totals.count).toBe(f.counts["2211001"]);
  expect(f.items.every((w: any) => w.status === "Em execução")).toBe(true);
  expect((await request.get("/api/admin")).status()).toBe(401);
  expect(
    (
      await request.post("/api/admin", {
        data: { action: "agent", name: "Não autorizado" },
      })
    ).status(),
  ).toBe(403);
});
test("voltar à lista preserva a página e a rolagem", async ({ page }, info) => {
  await page.goto("/?municipio=2211001&pagina=2");
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: /ver lista/ }).click();
  await expect(page.locator(".pagination")).toContainText("2 de");
  await page.locator(".work-row").nth(5).scrollIntoViewIfNeeded();
  const savedScroll = await page
    .locator(".panel-scroll")
    .evaluate((el) => el.scrollTop);
  expect(savedScroll).toBeGreaterThan(0);
  await page.locator(".work-row").nth(5).click();
  await expect(page.locator(".detail-intro h1")).toBeVisible();
  await expect(page).toHaveURL(/pagina=2/);
  await page.getByRole("button", { name: "Voltar às obras" }).click();
  await expect(page).toHaveURL(/pagina=2/);
  await expect(page.locator(".pagination")).toContainText("2 de");
  await expect
    .poll(async () =>
      Math.abs(
        (await page.locator(".panel-scroll").evaluate((el) => el.scrollTop)) -
          savedScroll,
      ),
    )
    .toBeLessThan(5);
});
test("busca por teclado, obra, perfil, histórico e URL direta", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: /ver lista/ }).click();
  await expect(page.locator(".summary strong").first()).toHaveText("6.442");
  await mkdir(".impeccable/review", { recursive: true });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.locator(".map-surface")).toHaveAttribute(
    "data-rendered",
    "true",
  );
  const metrics = await page.evaluate(() => ({
    paint: performance
      .getEntriesByType("paint")
      .map((p) => ({ name: p.name, ms: p.startTime })),
    readyMs: performance.now(),
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
  }));
  await writeFile(
    `.impeccable/review/${info.project.name}-metrics.json`,
    JSON.stringify(metrics, null, 2),
  );
  await page.screenshot({
    path: `.impeccable/review/${info.project.name}.png`,
  });
  const search = page.getByRole("combobox", {
    name: "Buscar município, obra ou agente",
  });
  await search.fill("Teresina");
  await expect(page.getByRole("option", { name: /Teresina/ })).toBeVisible();
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/municipio=2211001/);
  await expect(page.locator(".work-row").first()).toBeVisible();
  await page
    .getByRole("combobox", { name: "Situação oficial", exact: true })
    .selectOption("Em execução");
  await expect(page.locator(".work-row .status").first()).toHaveText(
    "Em execução",
  );
  const first = page.locator(".work-row").first();
  const title = await first.locator("h2").innerText();
  await first.click();
  await expect(page.locator(".detail-intro h1")).toHaveText(title);
  await expect(page).toHaveURL(/obra=/);
  const detailUrl = page.url();
  await page.locator(".agent-link>button").first().click();
  await expect(page.locator(".profile-intro h1")).toBeVisible();
  await expect(page).toHaveURL(/agente=/);
  await expect(page.locator(".work-row").first()).toBeVisible();
  await page.goBack();
  await expect(page.locator(".detail-intro h1")).toHaveText(title);
  await page.reload();
  await expect(page.locator(".detail-intro h1")).toHaveText(title);
  await expect(page).toHaveURL(/situacao=Em/);
  await page.goto(detailUrl);
  await expect(page.locator(".detail-intro h1")).toHaveText(title);
  await page.goto("/");
  await expect(page.locator(".summary strong").first()).toHaveText("6.442");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  if (info.project.name === "mobile") {
    await expect(page.locator(".side-panel")).toHaveClass(/collapsed/);
    await page.getByRole("button", { name: /ver lista/ }).click();
    await expect(page.locator(".side-panel")).not.toHaveClass(/collapsed/);
    await page.getByRole("button", { name: "Recolher painel" }).click();
    await expect(page.locator(".side-panel")).toHaveClass(/collapsed/);
    await expect(page.locator(".map-surface")).toHaveAttribute(
      "data-rendered",
      "true",
    );
    await page.screenshot({ path: ".impeccable/review/mobile-compact.png" });
    await page.getByRole("button", { name: /ver lista/ }).click();
  }
  await page.getByRole("tab", { name: /Municípios/ }).click();
  await expect(page.locator(".city-list>button")).toHaveCount(224);
  await page.screenshot({
    path: `.impeccable/review/${info.project.name}-cities.png`,
  });
  expect(errors).toEqual([]);
});
