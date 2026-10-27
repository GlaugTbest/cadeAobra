import { it, expect } from "vitest";
import { groupMapPoints, type ProjectedPoint } from "../src/lib/map-markers";
const point = (id: string, x: number, y = 0): ProjectedPoint => ({
  id,
  name: id,
  status: "Cadastrada",
  lng: x / 100,
  lat: y / 100,
  x,
  y,
});

it("conta obras únicas quando uma obra tem vários locais próximos", () => {
  const groups = groupMapPoints(
    [point("a", 0), point("a", 3), point("b", 12)],
    "",
  );
  expect(groups).toHaveLength(1);
  expect(groups[0].points.map((p) => p.id)).toEqual(["a", "b"]);
});
it("afastar reúne locais sem criar uma localização média fictícia", () => {
  const close = groupMapPoints([point("a", 0), point("b", 20)], "");
  const far = groupMapPoints([point("a", 0), point("b", 200)], "");
  expect(close).toHaveLength(1);
  expect(far).toHaveLength(2);
  expect(close[0].anchor.lng).toBe(0);
});
it("ancora o grupo na obra aberta e preserva outras obras no mesmo local", () => {
  const groups = groupMapPoints([point("a", 0), point("b", 10)], "b");
  expect(groups[0].anchor.id).toBe("b");
  expect(groups[0].selected).toBe(true);
  expect(new Set(groups[0].points.map((p) => p.id))).toEqual(
    new Set(["a", "b"]),
  );
});
