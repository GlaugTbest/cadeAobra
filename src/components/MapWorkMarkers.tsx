"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Marker, type Map as GLMap } from "maplibre-gl";
import { Layers } from "lucide-react";
import {
  groupMapPoints,
  type MapPoint,
  type MarkerGroup,
} from "@/lib/map-markers";
import { WorkIcon } from "./WorkVisual";

export default function MapWorkMarkers({
  map,
  points,
  work,
  onWork,
  onGroup,
}: {
  map: GLMap;
  points: MapPoint[];
  work: string;
  onWork: (id: string) => void;
  onGroup: (points: MapPoint[]) => void;
}) {
  const [groups, setGroups] = useState<MarkerGroup[]>([]);
  useEffect(() => {
    const update = () => {
      const { width, height } = map.getContainer().getBoundingClientRect();
      const projected = points
        .map((p) => ({ ...p, ...map.project([p.lng, p.lat]) }))
        .filter(
          (p) =>
            p.x >= -60 && p.x <= width + 60 && p.y >= -60 && p.y <= height + 60,
        );
      setGroups(groupMapPoints(projected, work));
    };
    update();
    map.on("moveend", update);
    map.on("resize", update);
    return () => {
      map.off("moveend", update);
      map.off("resize", update);
    };
  }, [map, points, work]);
  return (
    <>
      {groups.map((group) => (
        <WorkMarker
          key={group.key}
          map={map}
          group={group}
          onWork={onWork}
          onGroup={onGroup}
        />
      ))}
    </>
  );
}

function WorkMarker({
  map,
  group,
  onWork,
  onGroup,
}: {
  map: GLMap;
  group: MarkerGroup;
  onWork: (id: string) => void;
  onGroup: (points: MapPoint[]) => void;
}) {
  const element = useMemo(() => document.createElement("div"), []),
    marker = useRef<Marker | null>(null);
  useEffect(() => {
    const m = new Marker({ element, anchor: "bottom" })
      .setLngLat([group.anchor.lng, group.anchor.lat])
      .addTo(map);
    marker.current = m;
    return () => {
      m.remove();
      marker.current = null;
    };
  }, [map, element]);
  useEffect(() => {
    marker.current?.setLngLat([group.anchor.lng, group.anchor.lat]);
  }, [group.anchor.lng, group.anchor.lat]);
  const multiple = group.points.length > 1;
  const title = multiple
    ? `${group.points.length} obras nesta área${group.selected ? " · inclui a obra aberta" : ""}`
    : `${group.anchor.name} · ${group.anchor.status}`;
  return createPortal(
    <button
      type="button"
      className={`work-marker ${multiple ? "work-marker-group" : "work-marker-pin"}`}
      data-selected={group.selected}
      aria-label={title}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        multiple ? onGroup(group.points) : onWork(group.anchor.id);
      }}
    >
      {multiple ? (
        <>
          <Layers size={16} aria-hidden="true" />
          <strong>{group.points.length}</strong>
        </>
      ) : (
        <WorkIcon name={group.anchor.name} size={19} />
      )}
      {group.selected && <span className="sr-only">Obra aberta</span>}
    </button>,
    element,
  );
}
