import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { mapColor } from "@/lib/presentation";
export const alt =
  "Cadê a Obra? Explore obras públicas do Piauí com dados oficiais.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image() {
  const snapshot = JSON.parse(
    await readFile(path.join(process.cwd(), "data/snapshot.json"), "utf8"),
  );
  const geo = JSON.parse(
    await readFile(
      path.join(process.cwd(), "public/data/piaui.geojson"),
      "utf8",
    ),
  );
  const paths: string[] = [];
  const counts: Record<string, number> = {};
  for (const work of snapshot.works)
    for (const id of work.municipalityIds) counts[id] = (counts[id] || 0) + 1;
  for (const feature of geo.features) {
    const rings: number[][][] = [];
    function walk(a: any) {
      if (typeof a[0]?.[0] === "number") rings.push(a);
      else a.forEach(walk);
    }
    walk(feature.geometry.coordinates);
    paths.push(
      rings
        .map(
          (r) =>
            r
              .map(
                (p, i) =>
                  `${i ? "L" : "M"}${(((p[0] + 46.1) / 5.9) * 340).toFixed(1)},${(((-2.6 - p[1]) / 8.5) * 470).toFixed(1)}`,
              )
              .join(" ") + "Z",
        )
        .join(" "),
    );
  }
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#0b171b",
          color: "#f0f7f8",
          padding: "60px",
          fontFamily: "sans-serif",
          alignItems: "center",
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", width: "690px" }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 36,
              color: "#ffc45c",
              marginBottom: 38,
            }}
          >
            cadê a obra?
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 66,
              fontWeight: 700,
              lineHeight: 1.08,
            }}
          >
            <span>Obras públicas.</span>
            <span>Informação ao</span>
            <span>seu alcance.</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#b1c7cb",
              marginTop: 30,
            }}
          >
            Explore o Piauí com dados oficiais e fontes verificáveis.
          </div>
          <div
            style={{
              display: "flex",
              gap: 36,
              marginTop: 44,
              fontSize: 30,
              color: "#77dfc1",
            }}
          >
            <span>{snapshot.coverage.works.toLocaleString("pt-BR")} obras</span>
            <span>{snapshot.coverage.municipalities} municípios</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 17,
              color: "#b1c7cb",
              marginTop: 15,
            }}
          >{`Base consultada em ${new Date(snapshot.consultedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · Obrasgov e IBGE`}</div>
        </div>
        <svg width="340" height="470" viewBox="0 0 340 470">
          {paths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill={mapColor(
                counts[String(geo.features[i].properties.codarea)] || 0,
              )}
              stroke="#0b242b"
              strokeWidth="0.8"
            />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}
