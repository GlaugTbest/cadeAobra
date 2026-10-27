export type MapPoint = {
  id: string;
  name: string;
  status: string;
  lng: number;
  lat: number;
};
export type ProjectedPoint = MapPoint & { x: number; y: number };
export type MarkerGroup = {
  key: string;
  anchor: ProjectedPoint;
  points: MapPoint[];
  selected: boolean;
};

// Group by screen distance, anchored to a real source coordinate. Marker size
// never depends on the number of works or the zoom level.
export function groupMapPoints(
  points: ProjectedPoint[],
  selected: string,
): MarkerGroup[] {
  const spacing = 64;
  const groups: MarkerGroup[] = [],
    cells = new Map<string, MarkerGroup[]>();
  const ordered = [...points].sort(
    (a, b) =>
      Number(b.id === selected) - Number(a.id === selected) ||
      a.id.localeCompare(b.id) ||
      a.lng - b.lng ||
      a.lat - b.lat,
  );
  for (const p of ordered) {
    const cx = Math.floor(p.x / spacing),
      cy = Math.floor(p.y / spacing);
    let closest: MarkerGroup | undefined,
      distance = spacing;
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++)
        for (const group of cells.get(`${x},${y}`) || []) {
          const d = Math.hypot(group.anchor.x - p.x, group.anchor.y - p.y);
          if (d < distance) {
            closest = group;
            distance = d;
          }
        }
    if (closest) {
      if (!closest.points.some((v) => v.id === p.id)) closest.points.push(p);
      closest.selected ||= p.id === selected;
    } else {
      const group = {
        key: `${p.id}:${p.lng}:${p.lat}`,
        anchor: p,
        points: [p],
        selected: p.id === selected,
      };
      groups.push(group);
      const key = `${cx},${cy}`;
      cells.set(key, [...(cells.get(key) || []), group]);
    }
  }
  return groups;
}
