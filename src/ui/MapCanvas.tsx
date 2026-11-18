import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { buildingColors, markerColors, roadStyles, terrainColors, zoneColors } from "../domain/theme";
import type { Building, MapMarker, MapProject, Road, Terrain, Zone } from "../domain/types";

export type SelectedFeature =
  | { kind: "terrain"; feature: Terrain }
  | { kind: "zone"; feature: Zone }
  | { kind: "road"; feature: Road }
  | { kind: "building"; feature: Building }
  | { kind: "marker"; feature: MapMarker };

export type Visibility = {
  terrain: Record<Terrain["type"], boolean>;
  zone: boolean;
  road: boolean;
  postalCode: boolean;
  building: Record<Building["type"], boolean>;
  marker: Record<MapMarker["type"], boolean>;
};
export type DrawKind = "marker" | "building" | "terrain" | "zone" | "road" | "entrance";
export type DrawnGeometry =
  | { type: "Point"; coordinates: readonly [number, number] }
  | { type: "LineString"; coordinates: readonly (readonly [number, number])[] }
  | { type: "Polygon"; coordinates: readonly (readonly (readonly [number, number])[])[] };

type EditableLayer = L.Layer & { pm: { enable(options?: { allowSelfIntersection?: boolean; removeLayerBelowMinVertexCount?: boolean; draggable?: boolean }): void; disable(): void } };

type Props = {
  project: MapProject;
  visible: Visibility;
  selection: SelectedFeature | null;
  focusTarget: SelectedFeature | null;
  onSelect: (selection: SelectedFeature | null) => void;
  drawKind: DrawKind | null;
  onDrawn: (kind: DrawKind, geometry: DrawnGeometry) => void;
  editorMode: boolean;
  onGeometryEdited: (kind: SelectedFeature["kind"], id: string, geometry: DrawnGeometry) => void;
  onEntranceMoved: (buildingId: string, unitId: string, entranceIndex: number, geometry: Extract<DrawnGeometry, { type: "Point" }>) => void;
  visibleEntranceUnit: { buildingId: string; unitId: string } | null;
};

const polygonPositions = (coordinates: readonly (readonly (readonly [number, number])[])[], width: number, height: number): L.LatLngExpression[][] =>
  coordinates.map((ring) => ring.map(([x, y]) => [y * height, x * width]));

const linePositions = (coordinates: readonly (readonly [number, number])[], width: number, height: number): L.LatLngExpression[] =>
  coordinates.map(([x, y]) => [y * height, x * width]);

export function MapCanvas({ project, visible, selection, focusTarget, onSelect, drawKind, onDrawn, editorMode, onGeometryEdited, onEntranceMoved, visibleEntranceUnit }: Props) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const activeEditLayerRef = useRef<EditableLayer | null>(null);
  const drawKindRef = useRef<DrawKind | null>(drawKind);
  const [zoom, setZoom] = useState(-8);
  // Postal labels are useful only after the map has enough room to avoid
  // overlapping every building. This is roughly four times past a full-map view.
  const postalCodeMinZoom = -1.5;

  useEffect(() => {
    drawKindRef.current = drawKind;
  }, [drawKind]);

  useEffect(() => {
    if (selection) return;
    activeEditLayerRef.current?.pm.disable();
    activeEditLayerRef.current = null;
  }, [selection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusTarget) return;
    const { width, height } = project.image;
    const geometry = focusTarget.feature.geometry;
    if (geometry.type === "Point") {
      const [x, y] = geometry.coordinates;
      map.setView([y * height, x * width], Math.max(map.getZoom(), -0.5));
      return;
    }
    const positions = geometry.type === "LineString"
      ? linePositions(geometry.coordinates, width, height)
      : polygonPositions(geometry.coordinates, width, height).flat();
    map.fitBounds(L.latLngBounds(positions), { padding: [70, 70], maxZoom: -0.5 });
  }, [focusTarget, project.image.height, project.image.width]);

  useEffect(() => {
    if (!node.current || mapRef.current) return;
    const { width, height } = project.image;
    const bounds: L.LatLngBoundsExpression = [[0, 0], [height, width]];
    const map = L.map(node.current, {
      crs: L.CRS.Simple,
      // The floor is replaced with a map-size-specific value after fitBounds.
      // Keeping it low here lets a tall source image fit into any viewport first.
      minZoom: -8,
      // 1.5× past native image scale for close inspection without excessive blur.
      maxZoom: Math.log2(1.5),
      zoomSnap: 0,
      zoomDelta: Math.log2(1.2),
      maxBounds: bounds,
      maxBoundsViscosity: 1,
      zoomControl: false,
      attributionControl: false,
      doubleClickZoom: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    let swapImageForZoom: (() => void) | undefined;
    if (project.image.tileUrlTemplate || project.image.tileProvider) {
      createTileLayer(project).addTo(map);
    } else {
      const overviewUrl = project.image.previewUrl ?? project.image.url;
      const overlay = L.imageOverlay(overviewUrl, bounds).addTo(map);
      swapImageForZoom = () => {
        // The 2K preview is sharp at overview scale. The 8K source is decoded
        // only for close inspection, avoiding a large texture during normal pan.
        overlay.setUrl(project.image.previewUrl && map.getZoom() < -1.7 ? project.image.previewUrl : project.image.url);
      };
      map.on("zoomend", swapImageForZoom);
    }
    map.fitBounds(bounds, { padding: [22, 22] });
    // Users can zoom one full step out from the whole-map view. This keeps the
    // full map available on tall images while still allowing visual breathing room.
    map.setMinZoom(map.getZoom() - 1);
    setZoom(map.getZoom());
    map.on("zoomend", () => setZoom(map.getZoom()));
    map.on("click", () => {
      // A map click is also the action that places a new entrance. It must not
      // be treated as a blank-space click until the active drawing is finished.
      if (!drawKindRef.current) onSelect(null);
    });
    mapRef.current = map;
    layersRef.current = L.layerGroup().addTo(map);

    return () => {
      if (swapImageForZoom) map.off("zoomend", swapImageForZoom);
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  // Recreate the Leaflet map only when the underlying map image changes.
  // Feature edits replace the project object, but must preserve the user's
  // current pan and zoom position.
  }, [onSelect, project.image.height, project.image.previewUrl, project.image.tileProvider, project.image.tileUrlTemplate, project.image.url, project.image.width]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !editorMode) return;
    map.pm.disableDraw();
    if (!drawKind) return;
    const shape = ({ marker: "Marker", entrance: "Marker", building: "Polygon", terrain: "Polygon", zone: "Polygon", road: "Line" } as const)[drawKind];
    const create = (event: { layer: L.Layer }) => {
      const geometry = normalizedGeometry(event.layer, project.image.width, project.image.height);
      event.layer.remove();
      if (geometry) onDrawn(drawKind, geometry);
    };
    map.once("pm:create", create);
    map.pm.enableDraw(shape, { finishOn: "dblclick", snappable: false, continueDrawing: false, allowSelfIntersection: false });
    return () => {
      map.off("pm:create", create);
      map.pm.disableDraw();
    };
  }, [drawKind, editorMode, onDrawn, project.image.height, project.image.width]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    layers.clearLayers();
    activeEditLayerRef.current?.pm.disable();
    activeEditLayerRef.current = null;
    const { width, height } = project.image;
    // Yellow is reserved for a result chosen from search. Normal selection is
    // used for editing and should retain each feature's own visual style.
    const isSelected = (kind: SelectedFeature["kind"], id: string) => focusTarget?.kind === kind && focusTarget.feature.id === id;
    const enableGeometryEdit = (layer: EditableLayer) => {
      if (!editorMode || drawKind) return;
      if (activeEditLayerRef.current && activeEditLayerRef.current !== layer) activeEditLayerRef.current.pm.disable();
      activeEditLayerRef.current = layer;
      layer.pm.enable({ allowSelfIntersection: false, removeLayerBelowMinVertexCount: false, draggable: true });
    };
    const persistGeometry = (kind: SelectedFeature["kind"], id: string, layer: L.Layer) => {
      const geometry = normalizedGeometry(layer, width, height);
      if (geometry) onGeometryEdited(kind, id, geometry);
    };
    const bindFeatureLayer = <T extends Terrain | Zone | Road | Building | MapMarker>(layer: EditableLayer, kind: SelectedFeature["kind"], feature: T) => {
      layer.on("click", (event) => {
        if (drawKind) return;
        L.DomEvent.stopPropagation(event);
        onSelect({ kind, feature } as SelectedFeature);
        enableGeometryEdit(layer);
      });
      layer.on("pm:edit", () => persistGeometry(kind, feature.id, layer));
      if (kind === "marker") layer.on("pm:dragend", () => persistGeometry(kind, feature.id, layer));
      return layer;
    };

    if (visible.zone) {
      project.zones.forEach((feature) => {
        const selected = isSelected("zone", feature.id);
        L.polygon(polygonPositions(feature.geometry.coordinates, width, height), {
          color: selected ? "#FACC15" : darken(zoneColors[feature.type]), weight: selected ? 3 : 1, fillColor: zoneColors[feature.type], fillOpacity: selected ? 0.32 : 0.2,
        }).addTo(layers);
        bindFeatureLayer(layers.getLayers().at(-1)! as EditableLayer, "zone", feature);
      });
    }
    if (visible.terrain) {
      project.terrain.forEach((feature) => {
        if (!visible.terrain[feature.type]) return;
        const selected = isSelected("terrain", feature.id);
        L.polygon(polygonPositions(feature.geometry.coordinates, width, height), {
          color: selected ? "#FACC15" : darken(terrainColors[feature.type]), weight: selected ? 3 : 1, fillColor: terrainColors[feature.type], fillOpacity: selected ? 0.4 : feature.type === "city" ? 0.25 : 0.3,
        }).addTo(layers);
        bindFeatureLayer(layers.getLayers().at(-1)! as EditableLayer, "terrain", feature);
      });
    }
    if (visible.road) {
      project.roads.forEach((feature) => {
        const style = roadStyles[feature.type];
        const selected = isSelected("road", feature.id);
        L.polyline(linePositions(feature.geometry.coordinates, width, height), {
          color: selected ? "#FACC15" : feature.color ?? style.color, weight: selected ? Math.max(6, feature.width / 4 + 3) : Math.max(4, feature.width / 4), opacity: 0.9,
        }).addTo(layers);
        bindFeatureLayer(layers.getLayers().at(-1)! as EditableLayer, "road", feature);
      });
    }
    if (visible.building) {
      project.buildings.forEach((feature) => {
        if (!visible.building[feature.type]) return;
        const color = feature.color ?? buildingColors[feature.type];
        const selected = isSelected("building", feature.id);
        const buildingLayer = L.polygon(polygonPositions(feature.geometry.coordinates, width, height), {
          color: selected ? "#FACC15" : feature.isBurglaryTarget ? "#DC2626" : darken(color), dashArray: selected ? undefined : feature.isBurglaryTarget ? "5 4" : undefined,
          weight: selected ? 3 : feature.isBurglaryTarget ? 2 : 1, fillColor: color, fillOpacity: selected ? 0.38 : feature.type === "other" ? 0.18 : 0.22,
        }).addTo(layers);
        bindFeatureLayer(buildingLayer as EditableLayer, "building", feature);
        if (visible.postalCode && zoom >= postalCodeMinZoom && feature.postalCode) {
          L.marker(buildingLayer.getBounds().getCenter(), { icon: postalCodeIcon(feature.postalCode), interactive: false, keyboard: false }).addTo(layers);
        }
      });
    }
    if (visible.marker) {
      project.markers.forEach((feature) => {
        if (!visible.marker[feature.type]) return;
        const [x, y] = feature.geometry.coordinates;
        const color = feature.color ?? markerColors[feature.type];
        const marker = L.marker([y * height, x * width], { icon: pinIcon(color, feature.name, feature.size ?? 24, isSelected("marker", feature.id)), keyboard: true });
        marker.addTo(layers);
        bindFeatureLayer(marker as EditableLayer, "marker", feature);
      });
    }
    if (visible.building) {
      project.buildings.forEach((building) => {
        if (building.type !== "residence" || !visible.building.residence) return;
        building.units?.filter((unit) => visibleEntranceUnit?.buildingId === building.id && visibleEntranceUnit.unitId === unit.id).forEach((unit) => unit.entrances.forEach((entrance, entranceIndex) => {
          const [x, y] = entrance.coordinates;
          const entranceMarker = L.marker([y * height, x * width], { icon: entranceIcon(unit.houseNumber), draggable: editorMode, keyboard: true });
          entranceMarker.on("dragend", () => {
            const geometry = normalizedGeometry(entranceMarker, width, height);
            if (geometry?.type === "Point") onEntranceMoved(building.id, unit.id, entranceIndex, geometry);
          });
          entranceMarker.addTo(layers);
        }));
      });
    }
  }, [focusTarget, selection, drawKind, editorMode, onEntranceMoved, onGeometryEdited, onSelect, postalCodeMinZoom, project, visible, visibleEntranceUnit, zoom]);

  return <div className="map-canvas" ref={node} aria-label="커스텀 지도" />;
}

function createTileLayer(project: MapProject): L.GridLayer {
  return new ProjectTileLayer(project);
}

class ProjectTileLayer extends L.GridLayer {
  constructor(private readonly project: MapProject) {
    super({
      tileSize: 512,
      noWrap: true,
      minZoom: -6,
      maxZoom: 1,
      minNativeZoom: -5,
      maxNativeZoom: 0,
      bounds: [[0, 0], [project.image.height, project.image.width]],
    });
  }

  protected createTile(coordinates: L.Coords, done: L.DoneCallback): HTMLElement {
    const image = document.createElement("img");
    image.width = 512;
    image.height = 512;
    image.alt = "";
    image.decoding = "async";
    image.onload = () => done(undefined, image);
    image.onerror = () => done(undefined, image);
    const level = Math.min(5, Math.max(0, -coordinates.z));
    const sourceTileSize = 512 * 2 ** level;
    const columns = Math.ceil(this.project.image.width / sourceTileSize);
    const rows = Math.ceil(this.project.image.height / sourceTileSize);
    // CRS.Simple indexes vertical tiles from the map's bottom edge. Tile files
    // are stored in conventional top-to-bottom order.
    const tileY = rows + coordinates.y;
    if (coordinates.x < 0 || coordinates.x >= columns || tileY < 0 || tileY >= rows) {
      queueMicrotask(() => done(undefined, image));
      return image;
    }
    if (this.project.image.tileUrlTemplate) {
      image.src = this.project.image.tileUrlTemplate.replace("{level}", String(level)).replace("{x}", String(coordinates.x)).replace("{y}", String(tileY));
    } else if (this.project.image.tileProvider) {
      void this.project.image.tileProvider(level, coordinates.x, tileY).then((url) => {
        if (url) image.src = url;
        else done(undefined, image);
      });
    }
    return image;
  }
}

function normalizedGeometry(layer: L.Layer, width: number, height: number): DrawnGeometry | null {
  const feature = (layer as L.Layer & { toGeoJSON(): { geometry?: { type: string; coordinates: unknown } } }).toGeoJSON();
  const geometry = feature.geometry;
  if (!geometry) return null;
  const normalize = ([x, y]: [number, number]): readonly [number, number] => [x / width, y / height] as const;
  if (geometry.type === "Point") return { type: "Point", coordinates: normalize(geometry.coordinates as [number, number]) };
  if (geometry.type === "LineString") return { type: "LineString", coordinates: (geometry.coordinates as [number, number][]).map(normalize) };
  if (geometry.type === "Polygon") return { type: "Polygon", coordinates: (geometry.coordinates as [number, number][][]).map((ring) => ring.map(normalize)) };
  return null;
}

function pinIcon(color: string, name: string | undefined, size: number, selected = false): L.DivIcon {
  return L.divIcon({
    className: "custom-pin-shell",
    iconSize: [44, 44],
    iconAnchor: [22, 41],
    html: `<div class="custom-pin${selected ? " selected" : ""}" style="--pin-color:${color};--pin-size:${size}px" title="${escapeHtml(name ?? "마커")}"><span></span></div>`,
  });
}

function entranceIcon(houseNumber: string | undefined): L.DivIcon {
  return L.divIcon({ className: "entrance-pin-shell", iconSize: [12, 12], iconAnchor: [6, 6], html: `<span class="entrance-pin" title="${escapeHtml(houseNumber ?? "출입구")}"></span>` });
}

function postalCodeIcon(postalCode: string): L.DivIcon {
  return L.divIcon({ className: "postal-code-label-shell", iconSize: [1, 1], iconAnchor: [0, 0], html: `<span class="postal-code-label">${escapeHtml(postalCode)}</span>` });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function darken(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.round(((value >> shift) & 0xff) * 0.75).toString(16).padStart(2, "0");
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}
