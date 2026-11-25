import type { PolygonGeometry, Position } from "./types";

// Intersect horizontal lines with every ring. Alternating intersection pairs
// are inside the polygon, including when the polygon contains holes.
export function polygonLabelPoint(geometry: PolygonGeometry): Position {
  const rings = geometry.coordinates;
  const outer = rings[0];
  if (!outer?.length) return [0, 0];
  const xs = outer.map(point => point[0]);
  const ys = outer.map(point => point[1]);
  const middleX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const levels = [...new Set(rings.flatMap(ring => ring.map(point => point[1])))].sort((a, b) => a - b);
  let best: { x: number; y: number; width: number; centerDistance: number } | undefined;
  for (let i = 0; i < levels.length - 1; i++) {
    const y = (levels[i] + levels[i + 1]) / 2;
    const intersections: number[] = [];
    for (const ring of rings) {
      for (let j = 0; j < ring.length; j++) {
        const [x1, y1] = ring[j];
        const [x2, y2] = ring[(j + 1) % ring.length];
        if ((y1 > y) !== (y2 > y)) intersections.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let j = 0; j + 1 < intersections.length; j += 2) {
      const left = intersections[j], right = intersections[j + 1];
      const width = right - left;
      const x = (left + right) / 2;
      const centerDistance = Math.abs(x - middleX);
      if (width > 0 && (!best || width > best.width || (width === best.width && centerDistance < best.centerDistance))) best = { x, y, width, centerDistance };
    }
  }
  return best ? [best.x, best.y] : outer[0];
}

