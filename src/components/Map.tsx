"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { type GeoJSONSource, type Map as GLMap } from "maplibre-gl";
import type { Geometry } from "geojson";
import { Layers, LocateFixed, Plus, Minus, X } from "lucide-react";
import type { Boundary } from "@/lib/domain";
import "maplibre-gl/dist/maplibre-gl.css";
import MapWorkMarkers from "./MapWorkMarkers";
import { type MapPoint as Point } from "@/lib/map-markers";
import { WorkIcon } from "./WorkVisual";
type Props = {
  city: string;
  counts: Record<string, number>;
  points: Point[];
  work: string;
  camera: string;
  onCity: (id: string) => void;
  onWork: (id: string) => void;
};
const stateBounds: [number, number, number, number] = [
  -46.05, -10.95, -40.3, -2.65,
];
const mapScale = [
  [0, "#263632"],
  [1, "#225c53"],
  [5, "#338775"],
  [20, "#68ac83"],
  [100, "#a8cf95"],
  [500, "#dee9b6"],
] as const;
export default function MapView(props: Props) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<GLMap | null>(null),
    current = useRef(props),
    lastFocus = useRef("");
  current.current = props;
  const [geo, setGeo] = useState<{
      type: "FeatureCollection";
      features: Boundary[];
    } | null>(null),
    [ready, setReady] = useState(false),
    [rendered, setRendered] = useState(false),
    [fallback, setFallback] = useState(false),
    [choices, setChoices] = useState<Point[]>([]),
    [hover, setHover] = useState({ id: "", name: "" });
  useEffect(() => setChoices([]), [props.city, props.points]);
  useEffect(() => {
    const c = new AbortController();
    fetch("/data/piaui.geojson", { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(setGeo)
      .catch((e) => {
        if (e.name !== "AbortError") setFallback(true);
      });
    return () => c.abort();
  }, []);
  useEffect(() => {
    if (!container.current || !geo) return;
    let m: GLMap;
    let observer: ResizeObserver | undefined;
    try {
      maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      m = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#101918" },
            },
          ],
        },
        bounds: stateBounds,
        fitBoundsOptions: { padding: 55 },
        attributionControl: false,
        renderWorldCopies: false,
        maxZoom: 16,
        minZoom: 4,
        canvasContextAttributes: { antialias: true },
      });
      map.current = m;
      observer = new ResizeObserver(() => {
        m.resize();
        if (m.getSource("municipalities")) {
          const feature = geo.features.find(
            (f) => String(f.properties.codarea) === current.current.city,
          );
          m.fitBounds(
            feature ? geometryBounds(feature.geometry) : stateBounds,
            { padding: fitPadding(), duration: 0, maxZoom: 12 },
          );
        }
      });
      observer.observe(container.current);
      m.addControl(
        new maplibregl.AttributionControl({
          customAttribution: "Limites municipais © IBGE · Dados Obrasgov",
          compact: false,
        }),
        "bottom-right",
      );
      m.on("load", () => {
        m.addSource("municipalities", {
          type: "geojson",
          data: geo,
          promoteId: "codarea",
        });
        m.addLayer({
          id: "municipalities",
          type: "fill",
          source: "municipalities",
          paint: { "fill-color": "#234a3f", "fill-opacity": 0.95 },
        });
        m.addLayer({
          id: "borders",
          type: "line",
          source: "municipalities",
          paint: { "line-color": "#111e1a", "line-width": 0.9 },
        });
        m.addLayer({
          id: "selection-casing",
          type: "line",
          source: "municipalities",
          filter: ["==", ["get", "codarea"], ""],
          paint: { "line-color": "#101918", "line-width": 7 },
        });
        m.addLayer({
          id: "selected",
          type: "line",
          source: "municipalities",
          filter: ["==", ["get", "codarea"], ""],
          paint: { "line-color": "#edd79a", "line-width": 4 },
        });
        for (const [id, color, width] of [
          ["hover-casing", "#101918", 5],
          ["hover-border", "#ffffff", 2],
        ] as const) {
          m.addLayer({
            id,
            type: "line",
            source: "municipalities",
            filter: ["==", ["get", "codarea"], ""],
            paint: { "line-color": color, "line-width": width },
          });
        }
        m.on("click", "municipalities", (e) => {
          const id = String(e.features?.[0]?.properties?.codarea ?? "");
          if (id) current.current.onCity(id);
        });
        let hoveredId = "";
        const clearHover = () => {
          hoveredId = "";
          m.setFilter("hover-casing", ["==", ["get", "codarea"], ""]);
          m.setFilter("hover-border", ["==", ["get", "codarea"], ""]);
          m.getCanvas().style.cursor = "";
          setHover({ id: "", name: "" });
        };
        m.on("mousemove", "municipalities", (e) => {
          m.getCanvas().style.cursor = "pointer";
          const properties = e.features?.[0]?.properties;
          const id = String(properties?.codarea ?? "");
          if (id === hoveredId) return;
          hoveredId = id;
          for (const layer of ["hover-casing", "hover-border"])
            m.setFilter(layer, ["==", ["get", "codarea"], id]);
          setHover({ id, name: String(properties?.name ?? "") });
        });
        m.on("mouseleave", "municipalities", clearHover);
        m.on("movestart", clearHover);
        m.on("moveend", () => {
          const p = new URLSearchParams(window.location.search),
            c = m.getCenter();
          p.set(
            "mapa",
            `${c.lng.toFixed(5)},${c.lat.toFixed(5)},${m.getZoom().toFixed(2)}`,
          );
          window.history.replaceState(null, "", "/?" + p.toString());
        });
        setReady(true);
      });
      m.on("idle", () => {
        if (m.getSource("municipalities") && m.isSourceLoaded("municipalities"))
          setRendered(true);
      });
      m.on("error", (e) => {
        console.warn("Mapa", e.error.message);
        if (e.error.message.includes("Worker failed")) setFallback(true);
      });
    } catch {
      setFallback(true);
      return;
    }
    return () => {
      observer?.disconnect();
      setReady(false);
      m.remove();
      map.current = null;
    };
  }, [geo]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !geo || !m.getSource("municipalities")) return;
    const features = geo.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        count: props.counts[String(f.properties.codarea)] ?? 0,
      },
    }));
    (m.getSource("municipalities") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
    m.setPaintProperty(
      "municipalities",
      "fill-color",
      props.city
        ? ["case", ["==", ["get", "codarea"], props.city], "#367c6b", "#273a34"]
        : ["interpolate", ["linear"], ["get", "count"], ...mapScale.flat()],
    );
    for (const layer of ["selection-casing", "selected"])
      m.setFilter(layer, ["==", ["get", "codarea"], props.city]);
    const focus = props.city + "|" + props.camera;
    if (lastFocus.current !== focus) {
      lastFocus.current = focus;
      const coords = props.camera.split(",").map(Number);
      if (
        props.camera &&
        coords.length === 3 &&
        coords.every(Number.isFinite) &&
        coords[0] >= -180 &&
        coords[0] <= 180 &&
        coords[1] >= -85 &&
        coords[1] <= 85 &&
        coords[2] >= 4 &&
        coords[2] <= 16
      )
        m.jumpTo({ center: [coords[0], coords[1]], zoom: coords[2] });
      else {
        const feature = geo.features.find(
          (f) => String(f.properties.codarea) === props.city,
        );
        const bounds = feature ? geometryBounds(feature.geometry) : stateBounds;
        m.fitBounds(bounds, {
          padding: fitPadding(),
          duration: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? 0
            : 650,
          maxZoom: 12,
        });
      }
    }
  }, [
    ready,
    geo,
    props.city,
    props.counts,
    props.points,
    props.work,
    props.camera,
  ]);
  return (
    <div
      className={`map-surface${props.city ? " has-city" : ""}`}
      data-rendered={rendered || fallback}
    >
      <div
        className="map-canvas"
        ref={container}
        aria-label="Mapa interativo dos municípios do Piauí"
      />
      {ready && map.current && !fallback && (
        <MapWorkMarkers
          map={map.current}
          points={props.points}
          work={props.work}
          onWork={props.onWork}
          onGroup={setChoices}
        />
      )}
      {fallback && geo && (
        <svg
          className="fallback-map"
          viewBox="0 0 700 800"
          aria-label="Mapa municipal do Piauí"
        >
          {[...geo.features]
            .sort(
              (a, b) =>
                Number(String(a.properties.codarea) === hover.id) -
                Number(String(b.properties.codarea) === hover.id),
            )
            .map((f) => (
              <path
                key={f.properties.codarea}
                d={svgPath(f.geometry)}
                fill={
                  props.city
                    ? props.city === String(f.properties.codarea)
                      ? "#367c6b"
                      : "#273a34"
                    : mapColor(props.counts[String(f.properties.codarea)] ?? 0)
                }
                stroke={
                  hover.id === String(f.properties.codarea)
                    ? "#ffffff"
                    : props.city === String(f.properties.codarea)
                      ? "#edd79a"
                      : "#10231a"
                }
                strokeWidth={
                  hover.id === String(f.properties.codarea) ||
                  props.city === String(f.properties.codarea)
                    ? 2
                    : 0.7
                }
                role="button"
                tabIndex={0}
                aria-label={f.properties.name}
                aria-pressed={props.city === String(f.properties.codarea)}
                onMouseEnter={() =>
                  setHover({
                    id: String(f.properties.codarea),
                    name: f.properties.name ?? "",
                  })
                }
                onMouseLeave={() => setHover({ id: "", name: "" })}
                onFocus={() =>
                  setHover({
                    id: String(f.properties.codarea),
                    name: f.properties.name ?? "",
                  })
                }
                onBlur={() => setHover({ id: "", name: "" })}
                onClick={() => props.onCity(String(f.properties.codarea))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    props.onCity(String(f.properties.codarea));
                  }
                }}
              />
            ))}
        </svg>
      )}
      <div className="map-context">
        <Layers size={15} />
        <span>Limites municipais</span>
        <span className="map-context-dot" />
        PI
      </div>
      {hover.name && <div className="map-hover">{hover.name}</div>}
      <div className="map-controls">
        <button
          aria-label="Aproximar mapa"
          onClick={() => map.current?.zoomIn()}
        >
          <Plus size={20} />
        </button>
        <button
          aria-label="Afastar mapa"
          onClick={() => map.current?.zoomOut()}
        >
          <Minus size={20} />
        </button>
        <button
          aria-label="Enquadrar Piauí"
          onClick={() =>
            map.current?.fitBounds(stateBounds, { padding: fitPadding() })
          }
        >
          <LocateFixed size={19} />
        </button>
      </div>
      <div className={`map-caption${props.city ? " has-selection" : ""}`}>
        <span className="map-state">
          {geo?.features.find(
            (f) => String(f.properties.codarea) === props.city,
          )?.properties.name || "Piauí"}
        </span>
        <p>
          {props.city
            ? "Obras no município selecionado."
            : "Cada obra tem um lugar."}
          <br />
          Cada investimento, uma origem.
        </p>
      </div>
      <div className="map-legend">
        {props.city ? (
          <div className="selection-legend">
            <span>
              <i className="legend-selected" />
              Município selecionado
            </span>
            <span>
              <WorkIcon size={13} />
              Obras com localização
            </span>
            {props.work && props.points.some((p) => p.id === props.work) && (
              <span>
                <span className="legend-active-marker">
                  <WorkIcon size={13} />
                </span>
                Obra aberta
              </span>
            )}
            <span>
              <i className="legend-context" />
              Demais municípios
            </span>
          </div>
        ) : (
          <>
            <span>Obras únicas no recorte</span>
            <div className="legend-colors" aria-hidden="true">
              {mapScale.map(([count, color]) => (
                <i key={count} style={{ background: color }} />
              ))}
            </div>
            <div className="legend-labels">
              {mapScale.map(([count]) => (
                <span key={count}>{count === 500 ? "500+" : count}</span>
              ))}
            </div>
          </>
        )}
      </div>
      {choices.length > 0 && (
        <div className="point-choices">
          <div>
            <strong>{choices.length} obras nesta área</strong>
            <button
              aria-label="Fechar seleção de obras"
              onClick={() => setChoices([])}
            >
              <X size={18} />
            </button>
          </div>
          {choices.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                props.onWork(p.id);
                setChoices([]);
              }}
            >
              <span className="choice-icon">
                <WorkIcon name={p.name} size={22} />
              </span>
              <span className="choice-content">
                {p.name}
                <small>
                  {p.status} � {p.id}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
      {!geo && <span className="map-loading">Carregando malha do IBGE…</span>}
    </div>
  );
}
function mapColor(count: number) {
  const next = mapScale.findIndex(([stop]) => stop > count);
  if (next < 0) return mapScale.at(-1)![1];
  if (next === 0) return mapScale[0][1];
  const [low, from] = mapScale[next - 1],
    [high, to] = mapScale[next];
  const ratio = (count - low) / (high - low);
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(from.slice(i, i + 2), 16) * (1 - ratio) +
            parseInt(to.slice(i, i + 2), 16) * ratio,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function geometryBounds(g: Geometry): [number, number, number, number] {
  const coordinates = (g as { coordinates: unknown }).coordinates;
  const points: number[][] = [];
  function walk(a: any) {
    if (typeof a[0] === "number") points.push(a);
    else a.forEach(walk);
  }
  walk(coordinates);
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
}
function svgPath(g: Geometry) {
  const coords = (g as { coordinates: any }).coordinates;
  const rings: number[][][] = [];
  function walk(a: any) {
    if (typeof a[0]?.[0] === "number") rings.push(a);
    else a.forEach(walk);
  }
  walk(coords);
  return rings
    .map(
      (r) =>
        r
          .map(
            (p, i) =>
              `${i ? "L" : "M"}${(((p[0] + 46.1) / 5.9) * 600 + 50).toFixed(1)},${(((-2.6 - p[1]) / 8.5) * 720 + 30).toFixed(1)}`,
          )
          .join(" ") + "Z",
    )
    .join(" ");
}

function fitPadding() {
  return window.innerWidth < 700
    ? { top: 85, bottom: 35, left: 20, right: 55 }
    : 70;
}
