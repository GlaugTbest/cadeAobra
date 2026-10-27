"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { type GeoJSONSource, type Map as GLMap } from "maplibre-gl";
import type { FeatureCollection, Geometry } from "geojson";
import { Layers, LocateFixed, Plus, Minus, X } from "lucide-react";
import type { Boundary } from "@/lib/domain";
import "maplibre-gl/dist/maplibre-gl.css";
type Point = {
  lng: number;
  lat: number;
  id: string;
  name: string;
  status: string;
};
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
    [hover, setHover] = useState("");
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
          id: "selected",
          type: "line",
          source: "municipalities",
          filter: ["==", ["get", "codarea"], ""],
          paint: { "line-color": "#edd79a", "line-width": 2.5 },
        });
        m.addSource("points", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 35,
        });
        m.addLayer({
          id: "clusters",
          type: "circle",
          source: "points",
          filter: ["has", "point_count"],
          paint: {
            "circle-radius": [
              "step",
              ["get", "point_count"],
              11,
              20,
              16,
              100,
              21,
            ],
            "circle-color": "#edd79a",
            "circle-stroke-color": "#17231f",
            "circle-stroke-width": 3,
          },
        });
        m.addLayer({
          id: "pins",
          type: "circle",
          source: "points",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 6,
            "circle-color": "#edd79a",
            "circle-stroke-color": "#192b24",
            "circle-stroke-width": 2,
          },
        });
        m.addLayer({
          id: "highlight",
          type: "circle",
          source: "points",
          filter: ["==", ["get", "id"], ""],
          paint: {
            "circle-radius": 10,
            "circle-color": "#fff2c7",
            "circle-stroke-color": "#bb9350",
            "circle-stroke-width": 3,
          },
        });
        m.on("click", "municipalities", (e) => {
          if (
            m.queryRenderedFeatures(e.point, { layers: ["pins", "clusters"] })
              .length
          )
            return;
          const id = String(e.features?.[0]?.properties?.codarea ?? "");
          if (id) current.current.onCity(id);
        });
        m.on("mousemove", "municipalities", (e) => {
          m.getCanvas().style.cursor = "pointer";
          setHover(String(e.features?.[0]?.properties?.name ?? ""));
        });
        m.on("mouseleave", "municipalities", () => {
          m.getCanvas().style.cursor = "";
          setHover("");
        });
        m.on("click", "pins", (e) => {
          const features = m.queryRenderedFeatures(e.point, {
            layers: ["pins"],
          });
          const candidates = [
            ...new globalThis.Map(
              features.map((f) => [
                String(f.properties.id),
                {
                  ...f.properties,
                  lng: (f.geometry as { coordinates: number[] }).coordinates[0],
                  lat: (f.geometry as { coordinates: number[] }).coordinates[1],
                } as Point,
              ]),
            ).values(),
          ];
          if (candidates.length > 1) setChoices(candidates);
          else if (candidates[0]) current.current.onWork(candidates[0].id);
        });
        m.on("click", "clusters", async (e) => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          const source = m.getSource("points") as GeoJSONSource;
          const leaves = await source.getClusterLeaves(
            Number(p.cluster_id),
            10000,
            0,
          );
          setChoices([
            ...new Map(
              leaves.map((f) => [
                String(f.properties!.id),
                {
                  ...f.properties,
                  lng: (f.geometry as { coordinates: number[] }).coordinates[0],
                  lat: (f.geometry as { coordinates: number[] }).coordinates[1],
                } as Point,
              ]),
            ).values(),
          ]);
        });
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
    if (
      !ready ||
      !m ||
      !geo ||
      !m.getSource("municipalities") ||
      !m.getSource("points")
    )
      return;
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
    m.setPaintProperty("municipalities", "fill-color", [
      "interpolate",
      ["linear"],
      ["get", "count"],
      0,
      "#263630",
      1,
      "#295343",
      20,
      "#357457",
      100,
      "#64a87a",
      500,
      "#b6d5a2",
    ]);
    m.setFilter("selected", ["==", ["get", "codarea"], props.city]);
    (m.getSource("points") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: props.points.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { id: p.id, name: p.name, status: p.status },
      })),
    });
    m.setFilter("highlight", ["==", ["get", "id"], props.work]);
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
    <div className="map-surface" data-rendered={rendered || fallback}>
      <div
        className="map-canvas"
        ref={container}
        aria-label="Mapa interativo dos municípios do Piauí"
      />
      {fallback && geo && (
        <svg
          className="fallback-map"
          viewBox="0 0 700 800"
          aria-label="Mapa municipal do Piauí"
        >
          {geo.features.map((f) => (
            <path
              key={f.properties.codarea}
              d={svgPath(f.geometry)}
              fill={
                props.city === String(f.properties.codarea)
                  ? "#83ab7e"
                  : "#315d47"
              }
              stroke={
                props.city === String(f.properties.codarea)
                  ? "#edd79a"
                  : "#10231a"
              }
              strokeWidth={
                props.city === String(f.properties.codarea) ? 2 : 0.7
              }
              role="button"
              tabIndex={0}
              aria-label={f.properties.name}
              onClick={() => props.onCity(String(f.properties.codarea))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  props.onCity(String(f.properties.codarea));
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
      {hover && <div className="map-hover">{hover}</div>}
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
      <div className="map-caption">
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
        <span>Obras únicas no recorte</span>
        <div className="legend-colors">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="legend-labels">
          <span>0</span>
          <span>1</span>
          <span>20</span>
          <span>100</span>
          <span>500+</span>
        </div>
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
              {p.name}
              <small>{p.id}</small>
            </button>
          ))}
        </div>
      )}
      {!geo && <span className="map-loading">Carregando malha do IBGE…</span>}
    </div>
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
