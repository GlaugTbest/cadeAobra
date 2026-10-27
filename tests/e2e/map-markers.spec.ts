import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("marcadores mantêm tamanho ao afastar e abrem obras agrupadas", async ({
  page,
}, info) => {
  await page.goto(
    "/?municipio=2208809&mapa=-42.50527,-6.32105,10.25&obra=94896.22-06",
  );
  const markers = page.locator(".work-marker");
  await expect(markers.first()).toBeVisible({ timeout: 10000 });
  const heights = await markers.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().height),
  );
  expect(Math.max(...heights)).toBeLessThanOrEqual(44);
  await mkdir(".impeccable/review", { recursive: true });
  await page.screenshot({
    path: `.impeccable/review/works-${info.project.name}-near.png`,
  });
  for (let i = 0; i < 4; i++) {
    const zoom = Number(
      new URL(page.url()).searchParams.get("mapa")!.split(",")[2],
    );
    await page.getByRole("button", { name: "Afastar mapa" }).click();
    await expect
      .poll(() =>
        Number(new URL(page.url()).searchParams.get("mapa")!.split(",")[2]),
      )
      .toBeLessThan(zoom - 0.8);
  }
  await expect(page.locator(".work-marker-group").first()).toBeVisible();
  expect(
    Math.max(
      ...(await markers.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().height),
      )),
    ),
  ).toBeLessThanOrEqual(44);
  expect(
    Math.max(
      ...(await markers.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().width),
      )),
    ),
  ).toBeLessThanOrEqual(96);
  await page.screenshot({
    path: `.impeccable/review/works-${info.project.name}-far.png`,
  });
  await page.locator(".work-marker-group").first().click();
  await expect(
    page.getByRole("button", { name: "Fechar seleção de obras" }),
  ).toBeVisible();
  await page.screenshot({
    path: `.impeccable/review/works-${info.project.name}-choices.png`,
  });
  const choices = page.locator(".point-choices > button");
  expect(await choices.count()).toBeGreaterThan(1);
  await choices.first().click();
  await expect(page.locator(".detail-intro h1")).toBeVisible();
  await expect(
    page.locator(".work-marker[data-selected=true]").first(),
  ).toBeVisible();
});
