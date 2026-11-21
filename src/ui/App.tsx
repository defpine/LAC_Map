import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoProject } from "../domain/demo";
import { shopTypes } from "../domain/schemas";
import type { Building, BuildingType, DetailLocation, Facility, FacilityType, Institution, MapMarker, MapProject, MarkerType, Npc, ResidenceUnit, Road, RoadType, Shop, ShopType, Terrain, TerrainType, Zone, ZoneType } from "../domain/types";
import { chooseProjectFolder, supportsProjectFolderAccess, type ProjectFolderReport, validateProjectFolder } from "../editor/fileSystem";
import { loadMapProject } from "../editor/projectLoader";
import { saveProjectData } from "../editor/projectSaver";
import { buildingColors, markerColors, roadStyles, terrainColors, zoneColors } from "../domain/theme";
import { MapCanvas, type DrawKind, type DrawnGeometry, type SelectedFeature, type Visibility } from "./MapCanvas";
import { PopupBanner } from "./PopupBanner";

const MAX_HISTORY_ENTRIES = 100;
type DetailKind = "institution" | "shop" | "npc" | "facility";

export function App() {
  const [editorMode, setEditorMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [visibility, setVisibility] = useState<Visibility>({
    terrain: { mountain: true, beach: true, lake: true, city: true },
    zone: true,
    road: true,
    postalCode: true,
    building: { institution: true, shop: true, residence: true, burglary: true, landmark: true, terminal: true, content: true },
    marker: { institution: true, shop: true, npc: true, garage: true, landmark: true, content: true, bus_stop: true, gas_station: true },
  });
  const [selection, setSelection] = useState<SelectedFeature | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocus, setSearchFocus] = useState<SelectedFeature | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [folderReport, setFolderReport] = useState<ProjectFolderReport | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [project, setProject] = useState<MapProject>(demoProject);
  const projectRef = useRef(project);
  const [undoStack, setUndoStack] = useState<MapProject[]>([]);
  const [redoStack, setRedoStack] = useState<MapProject[]>([]);
  const [projectRoot, setProjectRoot] = useState<FileSystemDirectoryHandle | null>(null);
  const [drawKind, setDrawKind] = useState<DrawKind | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState("");
  const [draftRoadWidth, setDraftRoadWidth] = useState("16");
  const [draftRoadColor, setDraftRoadColor] = useState("");
  const [draftMarkerSize, setDraftMarkerSize] = useState("24");
  const [draftMarkerColor, setDraftMarkerColor] = useState("");
  const [draftMarkerShopType, setDraftMarkerShopType] = useState<ShopType>("clothing");
  const [draftBurglary, setDraftBurglary] = useState(false);
  const [draftPurchasable, setDraftPurchasable] = useState(false);
  const [draftPostalCode, setDraftPostalCode] = useState("");
  const [draftIconRef, setDraftIconRef] = useState("");
  const [draftBannerRef, setDraftBannerRef] = useState("");
  const [entranceTarget, setEntranceTarget] = useState<{ buildingId: string; unitId: string } | null>(null);
  const [visibleEntranceUnit, setVisibleEntranceUnit] = useState<{ buildingId: string; unitId: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [detailManagerOpen, setDetailManagerOpen] = useState(false);
  const [detailKind, setDetailKind] = useState<DetailKind>("institution");
  const [detailSelection, setDetailSelection] = useState<{ kind: DetailKind; id: string } | null>(null);
  const [detailDraftName, setDetailDraftName] = useState("");
  const [detailDraftDescription, setDetailDraftDescription] = useState("");
  const [detailDraftType, setDetailDraftType] = useState("");
  const [buildingConnection, setBuildingConnection] = useState("");
  const [markerConnection, setMarkerConnection] = useState("");
  const [locationType, setLocationType] = useState<"building" | "free_text">("free_text");
  const [locationValue, setLocationValue] = useState("");
  const [detailDraftItems, setDetailDraftItems] = useState<string[]>([]);
  const [detailDraftQuests, setDetailDraftQuests] = useState<string[]>([]);
  const [detailDraftCustomFields, setDetailDraftCustomFields] = useState<{ label: string; value: string }[]>([]);

  const commitProject = useCallback((update: (current: MapProject) => MapProject) => {
    const current = projectRef.current;
    const next = update(current);
    if (next === current) return;
    projectRef.current = next;
    setProject(next);
    setUndoStack((history) => [...history, current].slice(-MAX_HISTORY_ENTRIES));
    setRedoStack([]);
  }, []);
  const resetHistory = useCallback((nextProject: MapProject) => {
    projectRef.current = nextProject;
    setProject(nextProject);
    setUndoStack([]);
    setRedoStack([]);
  }, []);
  const undo = useCallback(() => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    const current = projectRef.current;
    projectRef.current = previous;
    setProject(previous);
    setUndoStack((history) => history.slice(0, -1));
    setRedoStack((history) => [...history, current].slice(-MAX_HISTORY_ENTRIES));
    setSelection(null);
    setDirty(undoStack.length > 1);
  }, [undoStack]);
  const redo = useCallback(() => {
    const next = redoStack.at(-1);
    if (!next) return;
    const current = projectRef.current;
    projectRef.current = next;
    setProject(next);
    setRedoStack((history) => history.slice(0, -1));
    setUndoStack((history) => [...history, current].slice(-MAX_HISTORY_ENTRIES));
    setSelection(null);
    setDirty(true);
  }, [redoStack]);

  const onSelect = useCallback((next: SelectedFeature | null) => {
    setSearchFocus(null);
    setSelection(next);
  }, []);
  useEffect(() => {
    if (editorMode) setSearchFocus(null);
  }, [editorMode]);
  const selectedDetail = useMemo(() => detailSelection ? findDetail(project, detailSelection.kind, detailSelection.id) : null, [detailSelection, project]);
  const searchResults = useMemo(() => searchFeatures(project, searchQuery), [project, searchQuery]);
  useEffect(() => {
    setDetailDraftName(selectedDetail?.name ?? "");
    setDetailDraftDescription(selectedDetail?.description ?? "");
    setDetailDraftType(selectedDetail?.type ?? "");
    const location = hasLocation(selectedDetail) ? selectedDetail.location : undefined;
    setLocationType(location?.type ?? "free_text");
    setLocationValue(location?.type === "building" ? location.buildingRef : location?.text ?? "");
    setDetailDraftItems(selectedDetail && isShopDetail(selectedDetail) ? [...(selectedDetail.items ?? [])] : []);
    setDetailDraftQuests(selectedDetail?.type === "npc" ? [...(selectedDetail.quests ?? [])] : []);
    setDetailDraftCustomFields(selectedDetail?.customFields ? selectedDetail.customFields.map((field) => ({ ...field })) : []);
  }, [selectedDetail]);
  useEffect(() => {
    setBuildingConnection(selectedDetail ? findBuildingByEntityRef(project, selectedDetail.id)?.id ?? "" : "");
    setMarkerConnection(selectedDetail ? findMarkerByEntityRef(project, selectedDetail.id)?.id ?? "" : "");
  }, [project, detailSelection, selectedDetail]);
  const createDetail = () => {
    let created: { kind: DetailKind; id: string } | null = null;
    commitProject((current) => {
      if (detailKind === "institution") {
        const item: Institution = { id: nextId(current.institutions, "institution"), type: "institution", name: "새 기관" };
        created = { kind: detailKind, id: item.id }; return { ...current, institutions: [...current.institutions, item] };
      }
      if (detailKind === "shop") {
        const item: Shop = { id: nextId(current.shops, "shop"), type: "clothing", name: "새 상점", items: [] };
        created = { kind: detailKind, id: item.id }; return { ...current, shops: [...current.shops, item] };
      }
      if (detailKind === "npc") {
        const item: Npc = { id: nextId(current.npcs, "npc"), type: "npc", name: "새 NPC", quests: [] };
        created = { kind: detailKind, id: item.id }; return { ...current, npcs: [...current.npcs, item] };
      }
      const item: Facility = { id: nextId(current.facilities, "facility"), type: "garage", name: "새 시설" };
      created = { kind: detailKind, id: item.id }; return { ...current, facilities: [...current.facilities, item] };
    });
    if (created) setDetailSelection(created);
    setDirty(true);
  };
  const saveDetail = () => {
    if (!selectedDetail || !detailSelection) return;
    const name = detailDraftName.trim() || undefined;
    const description = detailDraftDescription.trim() || undefined;
    commitProject((current) => {
      const customFields = cleanCustomFields(detailDraftCustomFields);
      if (detailSelection.kind === "institution") return { ...current, institutions: current.institutions.map((item) => item.id === selectedDetail.id ? { ...item, name, description, customFields } : item) };
      if (detailSelection.kind === "shop") return { ...current, shops: current.shops.map((item) => item.id === selectedDetail.id ? { ...item, name, description, type: detailDraftType as ShopType, items: cleanTextList(detailDraftItems), customFields } : item) };
      if (detailSelection.kind === "npc") return { ...current, npcs: current.npcs.map((item) => item.id === selectedDetail.id ? { ...item, name, description, quests: cleanTextList(detailDraftQuests), location: draftLocation(locationType, locationValue), customFields } : item) };
      return { ...current, facilities: current.facilities.map((item) => item.id === selectedDetail.id ? { ...item, name, description, type: detailDraftType as FacilityType, location: draftLocation(locationType, locationValue), customFields } : item) };
    });
    setDirty(true);
  };
  const deleteDetail = () => {
    if (!detailSelection) return;
    const building = findBuildingByEntityRef(project, detailSelection.id);
    const marker = findMarkerByEntityRef(project, detailSelection.id);
    if (building || marker) {
      window.alert("연결된 건물 또는 대표 마커가 있어 삭제할 수 없습니다. 먼저 연결을 해제하세요.");
      return;
    }
    commitProject((current) => removeDetail(current, detailSelection.kind, detailSelection.id));
    setDetailSelection(null);
    setDirty(true);
  };
  const saveConnections = () => {
    if (!selectedDetail || !detailSelection) return;
    const currentBuilding = findBuildingByEntityRef(project, selectedDetail.id)?.id ?? "";
    const currentMarker = findMarkerByEntityRef(project, selectedDetail.id)?.id ?? "";
    const changed = currentBuilding !== buildingConnection || currentMarker !== markerConnection;
    if (changed && (currentBuilding || currentMarker) && !window.confirm("기존 연결을 변경하거나 해제할까요? 기존 대상과 새 대상을 확인한 뒤 계속하세요.")) return;
    commitProject((current) => {
      let next = current;
      if (detailSelection.kind === "institution" || detailSelection.kind === "shop") {
        next = { ...next, buildings: next.buildings.map((building) => building.entityRef === selectedDetail.id && building.id !== buildingConnection ? { ...building, entityRef: undefined } : building) };
        if (buildingConnection) next = { ...next, buildings: next.buildings.map((building) => building.id === buildingConnection ? { ...building, entityRef: selectedDetail.id } : building) };
      }
      next = { ...next, markers: next.markers.map((marker) => marker.entityRef === selectedDetail.id && marker.id !== markerConnection ? { ...marker, entityRef: undefined } : marker) };
      if (markerConnection) next = { ...next, markers: next.markers.map((marker) => marker.id === markerConnection ? { ...marker, entityRef: selectedDetail.id, shopType: isShopDetail(selectedDetail) ? selectedDetail.type : marker.shopType } : marker) };
      return next;
    });
    setDirty(true);
  };
  const updateGeometry = useCallback((kind: SelectedFeature["kind"], id: string, geometry: DrawnGeometry) => {
    commitProject((current) => {
      if (kind === "marker" && geometry.type === "Point") return { ...current, markers: current.markers.map((item) => item.id === id ? { ...item, geometry } : item) };
      if (kind === "road" && geometry.type === "LineString") return { ...current, roads: current.roads.map((item) => item.id === id ? { ...item, geometry } : item) };
      if (kind === "building" && geometry.type === "Polygon") return { ...current, buildings: current.buildings.map((item) => item.id === id ? { ...item, geometry } : item) };
      if (kind === "terrain" && geometry.type === "Polygon") return { ...current, terrain: current.terrain.map((item) => item.id === id ? { ...item, geometry } : item) };
      if (kind === "zone" && geometry.type === "Polygon") return { ...current, zones: current.zones.map((item) => item.id === id ? { ...item, geometry } : item) };
      return current;
    });
    setSelection((current) => current && current.kind === kind && current.feature.id === id ? { ...current, feature: { ...current.feature, geometry } } as SelectedFeature : current);
    setDirty(true);
  }, [commitProject]);
  const updateEntrance = useCallback((buildingId: string, unitId: string, entranceIndex: number, geometry: Extract<DrawnGeometry, { type: "Point" }>) => {
    commitProject((current) => ({ ...current, buildings: current.buildings.map((building) => building.id !== buildingId ? building : { ...building, units: building.units?.map((unit) => unit.id !== unitId ? unit : { ...unit, entrances: unit.entrances.map((entrance, index) => index === entranceIndex ? geometry : entrance) }) } ) }));
    setDirty(true);
  }, [commitProject]);
  const selectedTitle = useMemo(() => selection ? selection.feature.name ?? selection.feature.id : "", [selection]);
  const linkedSelectionDetail = useMemo(() => (selection?.kind === "marker" || selection?.kind === "building") && selection.feature.entityRef ? findDetailById(project, selection.feature.entityRef) : undefined, [project, selection]);
  const saveStateLabel = dirty ? (projectRoot ? "저장되지 않은 변경사항" : "변경사항 있음 · 폴더 연결 필요") : "미저장 변경 없음";
  const canSave = editorMode && dirty && projectRoot !== null && !saving;
  useEffect(() => {
    setDraftName(selection?.feature.name ?? "");
    setDraftType(selection?.feature.type ?? "");
    setDraftRoadWidth(selection?.kind === "road" ? String(selection.feature.width) : "16");
    setDraftRoadColor(selection?.kind === "road" ? selection.feature.color ?? "" : "");
    setDraftMarkerSize(selection?.kind === "marker" ? String(selection.feature.size ?? 24) : "24");
    setDraftMarkerColor(selection?.kind === "marker" ? selection.feature.color ?? "" : "");
    setDraftMarkerShopType(selection?.kind === "marker" ? selection.feature.shopType ?? "clothing" : "clothing");
    setDraftBurglary(selection?.kind === "building" && Boolean(selection.feature.isBurglaryTarget));
    setDraftPurchasable(selection?.kind === "building" && Boolean(selection.feature.isPurchasable));
    setDraftPostalCode(selection?.kind === "building" ? selection.feature.postalCode ?? "" : "");
    setDraftIconRef(selection?.kind === "building" || selection?.kind === "marker" ? selection.feature.iconRef ?? "" : "");
    setDraftBannerRef(selection?.kind === "marker" ? selection.feature.bannerRef ?? "" : "");
    setDeleteConfirm(false);
  }, [selection]);
  useEffect(() => {
    if (selection?.kind !== "building" || selection.feature.id !== visibleEntranceUnit?.buildingId) setVisibleEntranceUnit(null);
  }, [selection?.kind, selection?.feature.id, visibleEntranceUnit?.buildingId]);
  const createFeature = useCallback((kind: DrawKind, geometry: DrawnGeometry) => {
    if (kind === "entrance" && geometry.type === "Point" && entranceTarget) {
      const currentBuilding = projectRef.current.buildings.find((building) => building.id === entranceTarget.buildingId);
      if (!currentBuilding) return;
      const units = currentBuilding.units?.map((unit) => unit.id !== entranceTarget.unitId ? unit : { ...unit, entrances: [...unit.entrances, geometry] });
      const updatedBuilding: Building = { ...currentBuilding, units };
      commitProject((current) => ({ ...current, buildings: current.buildings.map((building) => building.id === updatedBuilding.id ? updatedBuilding : building) }));
      // The inspector stores its own selected feature. Refresh it here so the
      // newly created entrance and its delete button appear without reopening.
      setSelection({ kind: "building", feature: updatedBuilding });
      setDirty(true);
      setDrawKind(null);
      setEntranceTarget(null);
      return;
    }
    commitProject((current) => {
      if (kind === "marker" && geometry.type === "Point") {
        const feature: MapMarker = { id: nextId(current.markers, "marker"), type: "content", name: "새 마커", geometry };
        setSelection({ kind: "marker", feature });
        return { ...current, markers: [...current.markers, feature] };
      }
      if (kind === "building" && geometry.type === "Polygon") {
        const feature: Building = { id: nextId(current.buildings, "building"), type: "burglary", name: "새 건물", geometry };
        setSelection({ kind: "building", feature });
        return { ...current, buildings: [...current.buildings, feature] };
      }
      if (kind === "terrain" && geometry.type === "Polygon") {
        const feature: Terrain = { id: nextId(current.terrain, "terrain"), type: "mountain", name: "새 지형", geometry };
        setSelection({ kind: "terrain", feature });
        return { ...current, terrain: [...current.terrain, feature] };
      }
      if (kind === "zone" && geometry.type === "Polygon") {
        const feature: Zone = { id: nextId(current.zones, "zone"), type: "jurisdiction", name: "새 구역", geometry };
        setSelection({ kind: "zone", feature });
        return { ...current, zones: [...current.zones, feature] };
      }
      if (kind === "road" && geometry.type === "LineString") {
        const feature: Road = { id: nextId(current.roads, "road"), type: "national_road", name: "새 도로", width: 16, geometry };
        setSelection({ kind: "road", feature });
        return { ...current, roads: [...current.roads, feature] };
      }
      return current;
    });
    setDirty(true);
    setDrawKind(null);
  }, [commitProject, entranceTarget]);
  const connectFolder = async () => {
    setFolderError(null);
    setConnecting(true);
    try {
      const root = await chooseProjectFolder();
      const report = await validateProjectFolder(root);
      setFolderReport(report);
      if (report.errors.length === 0) {
        resetHistory(await loadMapProject(root));
        setProjectRoot(root);
        setDirty(false);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFolderError(error instanceof Error ? error.message : "프로젝트 폴더에 연결하지 못했습니다.");
    } finally {
      setConnecting(false);
    }
  };
  const saveProject = async () => {
    if (!projectRoot || !dirty) return;
    const residenceError = validateResidenceEntrances(project);
    if (residenceError) {
      setFolderError(residenceError);
      return;
    }
    setSaving(true);
    setFolderError(null);
    try {
      await saveProjectData(projectRoot, project);
      const savedProject = { ...project, icons: project.icons?.map(({ pendingFile: _file, ...icon }) => icon) };
      projectRef.current = savedProject;
      setProject(savedProject);
      setDirty(false);
      setUndoStack([]);
      setRedoStack([]);
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "프로젝트 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };
  const saveSelectedProperties = () => {
    if (!selection) return;
    const name = draftName.trim() || undefined;
    if (selection.kind === "terrain") {
      const feature: Terrain = { ...selection.feature, name, type: draftType as TerrainType };
      commitProject((current) => ({ ...current, terrain: current.terrain.map((item) => item.id === feature.id ? feature : item) }));
      setSelection({ kind: "terrain", feature });
    } else if (selection.kind === "zone") {
      const feature: Zone = { ...selection.feature, name, type: draftType as ZoneType };
      commitProject((current) => ({ ...current, zones: current.zones.map((item) => item.id === feature.id ? feature : item) }));
      setSelection({ kind: "zone", feature });
    } else if (selection.kind === "road") {
      const color = isHexColor(draftRoadColor) ? draftRoadColor.toUpperCase() : undefined;
      const feature: Road = { ...selection.feature, name, type: draftType as RoadType, width: clampInteger(draftRoadWidth, 4, 100, selection.feature.width), color };
      commitProject((current) => ({ ...current, roads: current.roads.map((item) => item.id === feature.id ? feature : item) }));
      setSelection({ kind: "road", feature });
    } else if (selection.kind === "building") {
      const postalCode = draftPostalCode.trim() || undefined;
      const feature: Building = { ...selection.feature, name, type: draftType as BuildingType, postalCode, iconRef: draftIconRef || undefined, isBurglaryTarget: draftBurglary || undefined, isPurchasable: draftPurchasable || undefined };
      commitProject((current) => ({ ...current, buildings: current.buildings.map((item) => item.id === feature.id ? feature : item) }));
      setSelection({ kind: "building", feature });
    } else {
      const color = isHexColor(draftMarkerColor) ? draftMarkerColor.toUpperCase() : undefined;
      const type = draftType as MarkerType;
      const feature: MapMarker = { ...selection.feature, name, type, size: clampInteger(draftMarkerSize, 20, 48, selection.feature.size ?? 24), color, iconRef: draftIconRef || undefined, bannerRef: draftBannerRef || undefined, shopType: type === "shop" ? draftMarkerShopType : undefined };
      commitProject((current) => ({ ...current, markers: current.markers.map((item) => item.id === feature.id ? feature : item) }));
      setSelection({ kind: "marker", feature });
    }
    setDirty(true);
  };
  const registerIcon = async (file: File, purpose: "icon" | "banner" = "icon") => {
    try {
      if (!projectRoot) throw new Error("이미지를 등록하려면 먼저 프로젝트 폴더를 연결하세요.");
      if (file.size === 0 || file.size > 10 * 1024 * 1024) throw new Error("이미지는 10MB 이하의 비어 있지 않은 파일이어야 합니다.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const signature = Array.from(bytes.slice(0, 12));
      const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => signature[index] === value);
      const jpg = signature[0] === 255 && signature[1] === 216 && signature[2] === 255;
      const webp = String.fromCharCode(...signature.slice(0, 4)) === "RIFF" && String.fromCharCode(...signature.slice(8, 12)) === "WEBP";
      if (!png && !jpg && !webp) throw new Error("PNG, JPG, WebP 이미지만 등록할 수 있습니다.");
      const text = new TextDecoder("latin1").decode(bytes);
      if ((png && text.includes("acTL")) || (webp && text.includes("ANIM"))) throw new Error("애니메이션 이미지는 지원하지 않습니다.");
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const current = projectRef.current;
      const duplicate = current.icons?.find((icon) => icon.sha256 === hash);
      if (duplicate) { if (purpose === "banner") setDraftBannerRef(duplicate.id); else setDraftIconRef(duplicate.id); return; }
      const id = nextId(current.icons ?? [], "image");
      const format = png ? "png" : jpg ? "jpg" : "webp";
      const icon = { id, originalFileName: file.name, filePath: `Assets/images/${purpose === "banner" ? "banners" : "icons"}/${id}.${format}`, format, fileSize: file.size, sha256: hash, url: URL.createObjectURL(file), pendingFile: file } as const;
      commitProject((value) => ({ ...value, icons: [...(value.icons ?? []), icon] }));
      if (purpose === "banner") setDraftBannerRef(id); else setDraftIconRef(id);
      setDirty(true);
    } catch (error) { setFolderError(error instanceof Error ? error.message : "아이콘을 등록하지 못했습니다."); }
  };
  const deleteSelected = () => {
    if (!selection) return;
    commitProject((current) => removeFeature(current, selection.kind, selection.feature.id));
    setSelection(null);
    setDeleteConfirm(false);
    setDirty(true);
  };
  const addResidenceUnit = (building: Building) => {
    const unit: ResidenceUnit = { id: nextUnitId(project.buildings), houseNumber: "", entrances: [] };
    commitProject((current) => ({ ...current, buildings: current.buildings.map((item) => item.id === building.id ? { ...item, units: [...(item.units ?? []), unit] } : item) }));
    setSelection({ kind: "building", feature: { ...building, units: [...(building.units ?? []), unit] } });
    setVisibleEntranceUnit({ buildingId: building.id, unitId: unit.id });
    setDirty(true);
  };
  const updateResidenceUnit = (building: Building, unitId: string, houseNumber: string) => {
    const units = building.units?.map((unit) => unit.id === unitId ? { ...unit, houseNumber } : unit) ?? [];
    commitProject((current) => ({ ...current, buildings: current.buildings.map((item) => item.id === building.id ? { ...item, units } : item) }));
    setSelection({ kind: "building", feature: { ...building, units } });
    setDirty(true);
  };
  const deleteResidenceUnit = (building: Building, unitId: string) => {
    const units = building.units?.filter((unit) => unit.id !== unitId) ?? [];
    commitProject((current) => ({ ...current, buildings: current.buildings.map((item) => item.id === building.id ? { ...item, units } : item) }));
    setSelection({ kind: "building", feature: { ...building, units } });
    if (visibleEntranceUnit?.buildingId === building.id && visibleEntranceUnit.unitId === unitId) setVisibleEntranceUnit(null);
    setDirty(true);
  };
  const deleteEntrance = (building: Building, unitId: string, entranceIndex: number) => {
    const units = building.units?.map((unit) => unit.id !== unitId ? unit : { ...unit, entrances: unit.entrances.filter((_, index) => index !== entranceIndex) }) ?? [];
    commitProject((current) => ({ ...current, buildings: current.buildings.map((item) => item.id === building.id ? { ...item, units } : item) }));
    setSelection({ kind: "building", feature: { ...building, units } });
    setDirty(true);
  };

  return (
    <main className="app-shell">
      <header className="toolbar">
        <div className="brand"><span className="brand-dot" /> <strong>{project.projectName}</strong><span className="save-state">{saveStateLabel}</span></div>
        <div className="toolbar-actions">
          <button className="icon-button" aria-label="실행 취소" onClick={undo} disabled={!editorMode || undoStack.length === 0}>↶</button>
          <button className="icon-button" aria-label="다시 실행" onClick={redo} disabled={!editorMode || redoStack.length === 0}>↷</button>
          <button className="subtle-button" disabled={!editorMode}>설정</button>
          {editorMode && <button className="subtle-button" onClick={connectFolder} disabled={connecting || !supportsProjectFolderAccess()}>{connecting ? "연결 중…" : "프로젝트 폴더"}</button>}
          {editorMode && <button className="subtle-button" onClick={() => setDetailManagerOpen((open) => !open)}>상세 데이터</button>}
          <button className="save-button" onClick={saveProject} disabled={!canSave} title={!projectRoot ? "저장하려면 프로젝트 폴더를 먼저 연결하세요." : undefined}>{saving ? "저장 중…" : "Global Save"}</button>
          <button className={`edit-toggle ${editorMode ? "active" : ""}`} onClick={() => setEditorMode((value) => !value)}>
            {editorMode ? "편집 모드" : "Viewer 모드"}
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className={`filter-sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen((value) => !value)} aria-label="필터 열기 또는 닫기">☰</button>
          {sidebarOpen && <div className="filter-content">
            <div className="filter-header"><h1>필터</h1><button onClick={() => setVisibility(allVisible())}>전체 표시</button></div>
            <FilterGroup title="지형" entries={typedFilterEntries(project, "terrain")} value={visibility.terrain as Record<string, boolean>} onChange={(type) => setVisibility((current) => ({ ...current, terrain: { ...current.terrain, [type]: !current.terrain[type as TerrainType] } }))} onToggleAll={(enabled) => setVisibility((current) => ({ ...current, terrain: Object.fromEntries(Object.keys(current.terrain).map((type) => [type, enabled])) as Visibility["terrain"] }))} />
            <FilterGroup title="건물" entries={typedFilterEntries(project, "building")} value={visibility.building as Record<string, boolean>} onChange={(type) => setVisibility((current) => ({ ...current, building: { ...current.building, [type]: !current.building[type as BuildingType] } }))} onToggleAll={(enabled) => setVisibility((current) => ({ ...current, building: Object.fromEntries(Object.keys(current.building).map((type) => [type, enabled])) as Visibility["building"] }))} />
            <FilterGroup title="마커" entries={typedFilterEntries(project, "marker")} value={visibility.marker as Record<string, boolean>} onChange={(type) => setVisibility((current) => ({ ...current, marker: { ...current.marker, [type]: !current.marker[type as MarkerType] } }))} onToggleAll={(enabled) => setVisibility((current) => ({ ...current, marker: Object.fromEntries(Object.keys(current.marker).map((type) => [type, enabled])) as Visibility["marker"] }))} />
            <div className="simple-filter-group">
              {(["zone", "road"] as const).map((key) => <label className="filter-row" key={key}><input type="checkbox" checked={visibility[key]} onChange={() => setVisibility((current) => ({ ...current, [key]: !current[key] }))} /><span>{key === "zone" ? "구역" : "도로"}</span><small>{featureCount(project, key)}</small></label>)}
              <label className="filter-row"><input type="checkbox" checked={visibility.postalCode} onChange={() => setVisibility((current) => ({ ...current, postalCode: !current.postalCode }))} /><span>우편번호 표시</span><small>{project.buildings.filter((building) => Boolean(building.postalCode)).length}</small></label>
            </div>
            {editorMode && <div className="add-menu">
              <p>객체 추가</p>
              {(["marker", "building", "road", "terrain", "zone"] as DrawKind[]).map((kind) => <button className={drawKind === kind ? "selected" : ""} key={kind} onClick={() => setDrawKind(kind)}>{drawLabel(kind)}</button>)}
            </div>}
          </div>}
        </aside>
        <div className="map-area">
          <MapCanvas project={project} visible={visibility} selection={selection} focusTarget={searchFocus} onSelect={onSelect} drawKind={editorMode ? drawKind : null} onDrawn={createFeature} editorMode={editorMode} onGeometryEdited={updateGeometry} onEntranceMoved={updateEntrance} visibleEntranceUnit={visibleEntranceUnit} />
          <div className="map-search">
            <input aria-label="지도 검색" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="이름 · ID · 우편번호 검색" />
            {searchQuery.trim() && <div className="search-results">{searchResults.length > 0 ? searchResults.map((result) => <button type="button" key={`${result.kind}-${result.feature.id}`} onClick={() => { setSelection(result); setSearchFocus(result); setSearchQuery(""); }}><strong>{result.feature.name || (editorMode ? result.feature.id : "이름 없음")}</strong><small>{kindLabel(result.kind, result.feature.type)}{editorMode ? ` · ${result.feature.id}` : ""}{result.kind === "building" && result.feature.postalCode ? ` · ${result.feature.postalCode}` : ""}</small></button>) : <p>일치하는 객체가 없습니다.</p>}</div>}
          </div>
          <MapLegend open={legendOpen} onToggle={() => setLegendOpen((open) => !open)} />
          {selection && <aside className="detail-card" role="dialog" aria-label="선택한 객체 정보">
            {selection.kind === "marker" && <PopupBanner url={project.icons?.find((image) => image.id === selection.feature.bannerRef)?.url} />}
            <button className="detail-close" onClick={() => setSelection(null)} aria-label="닫기">×</button>
            <div className={`feature-chip ${selection.kind}`} style={{ backgroundColor: featureChipColor(selection) }}>{(selection.kind === "building" || selection.kind === "marker") && (() => { const icon = project.icons?.find((item) => item.id === selection.feature.iconRef); return icon?.url ? <img className="feature-icon-image" src={icon.url} alt="" onError={(event) => { event.currentTarget.hidden = true; }} /> : null; })()}</div>
            <p className="eyebrow">{kindLabel(selection.kind, selection.feature.type)}{!editorMode && linkedSelectionDetail && selection.kind === "marker" && selection.feature.type === "shop" ? ` · ${detailTypeLabel(linkedSelectionDetail.type)}` : ""}</p>
            <h2>{editorMode ? selectedTitle : linkedSelectionDetail?.name || selection.feature.name || "이름 없음"}</h2>
            {editorMode && <p className="feature-id">{selection.feature.id}</p>}
            {!editorMode && selection.kind === "building" && selection.feature.type === "residence" && <ViewerResidenceUnits building={selection.feature} activeUnitId={visibleEntranceUnit?.buildingId === selection.feature.id ? visibleEntranceUnit.unitId : null} onSelectUnit={(unitId) => setVisibleEntranceUnit((current) => current?.buildingId === selection.feature.id && current.unitId === unitId ? null : { buildingId: selection.feature.id, unitId })} />}
            {!editorMode && selection.kind === "building" && <ViewerBuildingInfo building={selection.feature} />}
            {!editorMode && linkedSelectionDetail && <DetailPopupContent detail={linkedSelectionDetail} />}
            {editorMode && !drawKind && <p className="geometry-hint">{selection.kind === "marker" ? "마커를 끌어 위치를 바꿀 수 있습니다." : "표시된 꼭짓점을 끌거나 눌러 경계를 편집할 수 있습니다."}</p>}
            {selection.kind === "road" && <p>폭: {selection.feature.width}px</p>}
            {editorMode && <div className="inspector-fields">
              <label>이름<input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="이름 없음" /></label>
              <label>종류<select value={draftType} onChange={(event) => setDraftType(event.target.value)}>{!typeOptions(selection.kind).some(option => option.value === draftType) && <option value={draftType} disabled>기존 유형 ({draftType})</option>}{typeOptions(selection.kind).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              {selection.kind === "road" && <>
                <label>기본 폭 (4–100)<input type="number" min="4" max="100" value={draftRoadWidth} onChange={(event) => setDraftRoadWidth(event.target.value)} /></label>
                <label>사용자 색상 (선택)<input value={draftRoadColor} onChange={(event) => setDraftRoadColor(event.target.value)} placeholder="#RRGGBB · 비워두면 종류 기본색" /></label>
              </>}
              {selection.kind === "building" && <>
                <label>우편번호 (선택)<input value={draftPostalCode} onChange={(event) => setDraftPostalCode(event.target.value)} placeholder="예: 0123" /></label>
                <label className="checkbox-field"><input type="checkbox" checked={draftBurglary} onChange={(event) => setDraftBurglary(event.target.checked)} /> 절도 대상</label>
                {draftType === "residence" && <label className="checkbox-field"><input type="checkbox" checked={draftPurchasable} onChange={(event) => setDraftPurchasable(event.target.checked)} /> 구매 가능</label>}
              </>}
              {selection.kind === "marker" && <>
                {draftType === "shop" && <label>상점 세부 유형<select value={draftMarkerShopType} onChange={(event) => setDraftMarkerShopType(event.target.value as ShopType)}>{detailTypeOptions("shop").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
                <label>크기 (20–48)<input type="number" min="20" max="48" value={draftMarkerSize} onChange={(event) => setDraftMarkerSize(event.target.value)} /></label>
                <label>사용자 색상 (선택)<input value={draftMarkerColor} onChange={(event) => setDraftMarkerColor(event.target.value)} placeholder="#RRGGBB · 비워두면 종류 기본색" /></label>
              </>}
              {(selection.kind === "building" || selection.kind === "marker") && <><label>전용 아이콘<select value={draftIconRef} onChange={(event) => setDraftIconRef(event.target.value)}><option value="">없음 · 기본 색상 사용</option>{(project.icons ?? []).map((icon) => <option key={icon.id} value={icon.id}>{icon.originalFileName}</option>)}</select></label><label>아이콘 이미지 등록<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void registerIcon(file); }} /></label><small>PNG, JPG, WebP · 최대 10MB · 애니메이션 제외</small></>}
              {selection.kind === "marker" && <><label>미리보기 배너<select value={draftBannerRef} onChange={(event) => setDraftBannerRef(event.target.value)}><option value="">없음</option>{(project.icons ?? []).map((image) => <option key={image.id} value={image.id}>{image.originalFileName}</option>)}</select></label><label>배너 이미지 등록<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void registerIcon(file, "banner"); }} /></label><small>권장 800 × 450px · 16:9 · PNG, JPG, WebP · 최대 10MB</small></>}
              <div className="inspector-actions"><button className="save-property" onClick={saveSelectedProperties}>속성 Save</button><button className="delete-property" onClick={() => setDeleteConfirm(true)}>Delete</button></div>
              {selection.kind === "building" && selection.feature.type === "residence" && <ResidenceUnitsEditor building={selection.feature} activeUnitId={visibleEntranceUnit?.buildingId === selection.feature.id ? visibleEntranceUnit.unitId : null} onSelectUnit={(unitId) => setVisibleEntranceUnit((current) => current?.buildingId === selection.feature.id && current.unitId === unitId ? null : { buildingId: selection.feature.id, unitId })} onAddUnit={addResidenceUnit} onUpdateUnit={updateResidenceUnit} onDeleteUnit={deleteResidenceUnit} onAddEntrance={(unitId) => { setVisibleEntranceUnit({ buildingId: selection.feature.id, unitId }); setEntranceTarget({ buildingId: selection.feature.id, unitId }); setDrawKind("entrance"); }} onDeleteEntrance={deleteEntrance} />}
            </div>}
          </aside>}
          {deleteConfirm && selection && <aside className="confirm-card" role="dialog" aria-modal="true" aria-label="객체 삭제 확인">
            <h2>객체를 삭제할까요?</h2>
            <p><strong>{selectedTitle}</strong><br />{kindLabel(selection.kind, selection.feature.type)} · {selection.feature.id}</p>
            <p className="confirm-note">이 작업은 Global Save 전까지 Undo 기능으로 되돌릴 수 있습니다.</p>
            <div className="inspector-actions"><button className="subtle-button" onClick={() => setDeleteConfirm(false)}>취소</button><button className="delete-property" onClick={deleteSelected}>삭제</button></div>
          </aside>}
          {(folderReport || folderError) && <aside className={`connection-card ${folderReport?.errors.length ? "has-errors" : ""}`} role="status">
            <button className="detail-close" onClick={() => { setFolderReport(null); setFolderError(null); }} aria-label="닫기">×</button>
            <p className="eyebrow">프로젝트 연결</p>
            {folderError ? <p>{folderError}</p> : folderReport && <>
              <h2>{folderReport.directoryName}</h2>
              {folderReport.errors.length === 0 ? <p className="success-message">필수 폴더와 JSON 파일 {folderReport.parsedFiles.length}개를 확인했습니다.</p> : <>
                <p className="error-message">프로젝트를 열 수 없습니다. 아래 항목을 수정하세요.</p>
                <ul>{folderReport.errors.map((error) => <li key={error}>{error}</li>)}</ul>
              </>}
            </>}
          </aside>}
          {detailManagerOpen && <aside className="detail-manager" aria-label="상세 데이터 관리">
            <button className="detail-close" onClick={() => setDetailManagerOpen(false)} aria-label="닫기">×</button>
            <p className="eyebrow">상세 데이터 관리</p>
            <div className="detail-tabs">{(["institution", "shop", "npc", "facility"] as DetailKind[]).map((kind) => <button key={kind} className={detailKind === kind ? "active" : ""} onClick={() => { setDetailKind(kind); setDetailSelection(null); }}>{detailKindLabel(kind)}</button>)}</div>
            <button className="save-property new-detail" onClick={createDetail}>새 {detailKindLabel(detailKind)}</button>
            <div className="detail-list">{detailRecords(project, detailKind).map((item) => <button key={item.id} className={detailSelection?.id === item.id && detailSelection.kind === detailKind ? "selected" : ""} onClick={() => setDetailSelection({ kind: detailKind, id: item.id })}><strong>{item.name ?? item.id}</strong><small>{detailTypeLabel(item.type)} · {item.id}</small></button>)}{detailRecords(project, detailKind).length === 0 && <p>등록된 데이터가 없습니다.</p>}</div>
            {selectedDetail && <div className="detail-editor">
              <label>이름<input value={detailDraftName} onChange={(event) => setDetailDraftName(event.target.value)} placeholder="이름 없음" /></label>
              {(detailSelection?.kind === "shop" || detailSelection?.kind === "facility") && <label>종류<select value={detailDraftType} onChange={(event) => setDetailDraftType(event.target.value)}>{detailTypeOptions(detailSelection.kind).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
              <label>설명<textarea value={detailDraftDescription} onChange={(event) => setDetailDraftDescription(event.target.value)} placeholder="설명 없음" /></label>
              {detailSelection?.kind === "shop" && <TextListEditor title="판매 품목" values={detailDraftItems} onChange={setDetailDraftItems} placeholder="품목명" />}
              {detailSelection?.kind === "npc" && <TextListEditor title="퀘스트" values={detailDraftQuests} onChange={setDetailDraftQuests} placeholder="퀘스트 내용" />}
              <CustomFieldsEditor values={detailDraftCustomFields} onChange={setDetailDraftCustomFields} />
              {(detailSelection?.kind === "npc" || detailSelection?.kind === "facility") && <>
                <label>위치 방식<select value={locationType} onChange={(event) => setLocationType(event.target.value as "building" | "free_text")}><option value="free_text">자유 텍스트</option><option value="building">건물 참조</option></select></label>
                {locationType === "building" ? <label>건물<select value={locationValue} onChange={(event) => setLocationValue(event.target.value)}><option value="">선택 안 함</option>{project.buildings.map((building) => <option key={building.id} value={building.id}>{building.name ?? building.id} · {building.id}</option>)}</select></label> : <label>위치 설명<input value={locationValue} onChange={(event) => setLocationValue(event.target.value)} placeholder="위치 설명" /></label>}
              </>}
              <section className="connection-section"><strong>연결 정보</strong>
                {(detailSelection?.kind === "institution" || detailSelection?.kind === "shop") && <label>건물 연결<select value={buildingConnection} onChange={(event) => setBuildingConnection(event.target.value)}><option value="">연결 안 함</option>{availableBuildings(project, selectedDetail).map((building) => <option key={building.id} value={building.id}>{building.name ?? building.id} · {building.type} · {building.id}</option>)}</select></label>}
                <label>대표 마커 연결<select value={markerConnection} onChange={(event) => setMarkerConnection(event.target.value)}><option value="">연결 안 함</option>{availableMarkers(project, selectedDetail).map((marker) => <option key={marker.id} value={marker.id}>{marker.name ?? marker.id} · {marker.id}</option>)}</select></label>
                {availableMarkers(project, selectedDetail).length === 0 && <small className="connection-empty">연결 가능한 마커가 없습니다.</small>}
                <button className="subtle-button" onClick={saveConnections}>연결 정보 Save</button>
              </section>
              <div className="inspector-actions"><button className="save-property" onClick={saveDetail}>상세 Save</button><button className="delete-property" onClick={deleteDetail}>Delete</button></div>
            </div>}
          </aside>}
        </div>
      </section>
    </main>
  );
}

function TextListEditor({ title, values, onChange, placeholder }: { title: string; values: string[]; onChange: (values: string[]) => void; placeholder: string }) {
  const update = (index: number, value: string) => onChange(values.map((item, itemIndex) => itemIndex === index ? value : item));
  return <section className="list-editor"><strong>{title}</strong>{values.map((value, index) => <div key={index}><input value={value} onChange={(event) => update(index, event.target.value)} placeholder={placeholder} /><button type="button" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}<button type="button" className="subtle-button" onClick={() => onChange([...values, ""])}>+ 추가</button></section>;
}

function ResidenceUnitsEditor({ building, activeUnitId, onSelectUnit, onAddUnit, onUpdateUnit, onDeleteUnit, onAddEntrance, onDeleteEntrance }: { building: Building; activeUnitId: string | null; onSelectUnit: (unitId: string) => void; onAddUnit: (building: Building) => void; onUpdateUnit: (building: Building, unitId: string, houseNumber: string) => void; onDeleteUnit: (building: Building, unitId: string) => void; onAddEntrance: (unitId: string) => void; onDeleteEntrance: (building: Building, unitId: string, entranceIndex: number) => void }) {
  return <section className="units-editor"><strong>주거 유닛</strong>{(building.units ?? []).map((unit) => <div className="unit-card" key={unit.id}><small>{unit.id}</small><label>houseNumber<input value={unit.houseNumber ?? ""} onChange={(event) => onUpdateUnit(building, unit.id, event.target.value)} placeholder="예: 101" /></label><div className="unit-entrances"><span>출입구 {unit.entrances.length}개</span><button type="button" className={activeUnitId === unit.id ? "subtle-button selected" : "subtle-button"} onClick={() => onSelectUnit(unit.id)}>{activeUnitId === unit.id ? "출입구 숨기기" : "출입구 보기"}</button><button type="button" className="subtle-button" onClick={() => onAddEntrance(unit.id)}>출입구 추가</button>{unit.entrances.map((_, index) => <button type="button" className="delete-property" key={index} onClick={() => onDeleteEntrance(building, unit.id, index)}>출입구 {index + 1} 삭제</button>)}</div><button type="button" className="delete-property" onClick={() => onDeleteUnit(building, unit.id)}>유닛 삭제</button></div>)}<button type="button" className="subtle-button" onClick={() => onAddUnit(building)}>+ 유닛 추가</button></section>;
}

function ViewerResidenceUnits({ building, activeUnitId, onSelectUnit }: { building: Building; activeUnitId: string | null; onSelectUnit: (unitId: string) => void }) {
  const units = building.units ?? [];
  return <section className="viewer-units"><strong>주거 유닛</strong>{units.length === 0 ? <p>등록된 유닛이 없습니다.</p> : <><p>유닛을 선택하면 해당 출입구만 지도에 표시됩니다.</p><div>{units.map((unit) => <button type="button" key={unit.id} className={activeUnitId === unit.id ? "active" : ""} onClick={() => onSelectUnit(unit.id)}>{unit.houseNumber?.trim() || unit.id} <small>출입구 {unit.entrances.length}</small></button>)}</div></>}</section>;
}

function ViewerBuildingInfo({ building }: { building: Building }) {
  const details: string[] = [];
  if (building.postalCode) details.push(`우편번호 ${building.postalCode}`);
  if (building.isPurchasable) details.push("구매 가능");
  if (building.isBurglaryTarget) details.push("절도 대상");
  if (building.type === "residence") details.push(`유닛 ${(building.units ?? []).length}개`);
  return details.length > 0 ? <div className="viewer-building-info">{details.map((detail) => <span key={detail}>{detail}</span>)}</div> : null;
}

function MapLegend({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const entries = [
    ["건물", [["기관", buildingColors.institution], ["상점", buildingColors.shop], ["빈집털이", buildingColors.burglary], ["랜드마크", buildingColors.landmark], ["터미널", buildingColors.terminal], ["콘텐츠", buildingColors.content]]],
    ["도로", [["고속도로", roadStyles.highway.color], ["고속화도로", roadStyles.expressway.color], ["국도", roadStyles.national_road.color]]],
    ["지형", [["산", terrainColors.mountain], ["해변", terrainColors.beach], ["호수", terrainColors.lake], ["도시", terrainColors.city]]],
    ["마커", [["기관", markerColors.institution], ["상점", markerColors.shop], ["NPC", markerColors.npc], ["차고", markerColors.garage], ["콘텐츠", markerColors.content], ["버스 정류장", markerColors.bus_stop], ["주유소", markerColors.gas_station]]],
  ] as const;
  return <aside className={`map-legend ${open ? "open" : ""}`} aria-label="지도 범례"><button type="button" onClick={onToggle} aria-expanded={open}>범례 <span>{open ? "−" : "+"}</span></button>{open && <div className="legend-panel">{entries.map(([title, items]) => <section key={title}><strong>{title}</strong>{items.map(([label, color]) => <span key={label}><i style={{ backgroundColor: color }} />{label}</span>)}</section>)}<p><i className="legend-selection" />선택 강조</p></div>}</aside>;
}

function CustomFieldsEditor({ values, onChange }: { values: { label: string; value: string }[]; onChange: (values: { label: string; value: string }[]) => void }) {
  const update = (index: number, key: "label" | "value", value: string) => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  return <section className="list-editor"><strong>추가 정보</strong>{values.map((field, index) => <div className="custom-field-row" key={index}><input value={field.label} onChange={(event) => update(index, "label", event.target.value)} placeholder="항목명" /><input value={field.value} onChange={(event) => update(index, "value", event.target.value)} placeholder="값" /><button type="button" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}<button type="button" className="subtle-button" onClick={() => onChange([...values, { label: "", value: "" }])}>+ 항목 추가</button></section>;
}

function DetailPopupContent({ detail }: { detail: DetailRecord }) {
  const list = isShopDetail(detail) ? detail.items : detail.type === "npc" ? detail.quests : undefined;
  const listTitle = isShopDetail(detail) ? "판매 품목" : detail.type === "npc" ? "퀘스트" : undefined;
  return <div className="viewer-detail-content">
    {detail.description && <p className="detail-description">{detail.description}</p>}
    {list && list.length > 0 && <section><strong>{listTitle}</strong><ul>{list.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></section>}
    {detail.customFields && detail.customFields.length > 0 && <section><strong>추가 정보</strong><dl>{detail.customFields.map((field, index) => <div key={`${field.label}-${index}`}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl></section>}
  </div>;
}

function FilterGroup({ title, entries, value, onChange, onToggleAll }: { title: string; entries: readonly { type: string; label: string; count: number }[]; value: Record<string, boolean>; onChange: (type: string) => void; onToggleAll: (enabled: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const allEnabled = entries.length > 0 && entries.every((entry) => value[entry.type]);
  return <section className={`filter-group ${open ? "open" : ""}`}><div className="filter-group-header"><label><input type="checkbox" checked={allEnabled} onChange={() => onToggleAll(!allEnabled)} /><span>전체</span></label><button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>{title}<span>{open ? "−" : "+"}</span></button></div>{open && <div className="filter-group-items">{entries.map((entry) => <label className="filter-row" key={entry.type}><input type="checkbox" checked={value[entry.type]} onChange={() => onChange(entry.type)} /><span>{entry.label}</span><small>{entry.count}</small></label>)}</div>}</section>;
}

function allVisible(): Visibility {
  return { terrain: { mountain: true, beach: true, lake: true, city: true }, zone: true, road: true, postalCode: true, building: { institution: true, shop: true, residence: true, burglary: true, landmark: true, terminal: true, content: true }, marker: { institution: true, shop: true, npc: true, garage: true, landmark: true, content: true, bus_stop: true, gas_station: true } };
}

function typedFilterEntries(project: MapProject, kind: "terrain" | "building" | "marker"): { type: string; label: string; count: number }[] {
  const labels: Record<string, string> = { mountain: "산", beach: "해변", lake: "호수", city: "도시", institution: "기관", shop: "상점", burglary: "빈집털이", terminal: "터미널", npc: "NPC", garage: "차고", landmark: "랜드마크", content: "콘텐츠", bus_stop: "버스 정류장", gas_station: "주유소" };
  const items = kind === "terrain" ? project.terrain : kind === "building" ? project.buildings : project.markers;
  const types = kind === "terrain" ? ["mountain", "beach", "lake", "city"] : kind === "building" ? ["institution", "shop", "burglary", "landmark", "terminal", "content"] : ["institution", "shop", "npc", "garage", "content", "bus_stop", "gas_station"];
  return types.map((type) => ({ type, label: labels[type], count: items.filter((item) => item.type === type).length }));
}

function searchFeatures(project: MapProject, query: string): SelectedFeature[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const candidates: SelectedFeature[] = [
    ...project.terrain.map((feature) => ({ kind: "terrain" as const, feature })),
    ...project.zones.map((feature) => ({ kind: "zone" as const, feature })),
    ...project.roads.map((feature) => ({ kind: "road" as const, feature })),
    ...project.buildings.map((feature) => ({ kind: "building" as const, feature })),
    ...project.markers.map((feature) => ({ kind: "marker" as const, feature })),
  ];
  return candidates.filter((candidate) => {
    const postalCode = candidate.kind === "building" ? candidate.feature.postalCode ?? "" : "";
    return `${candidate.feature.name ?? ""} ${candidate.feature.id} ${postalCode}`.toLocaleLowerCase().includes(normalized);
  }).slice(0, 10);
}

function featureCount(project: MapProject, kind: "terrain" | "zone" | "road" | "building" | "marker"): number {
  return ({ terrain: project.terrain.length, zone: project.zones.length, road: project.roads.length, building: project.buildings.length, marker: project.markers.length })[kind];
}

function nextId(items: readonly { id: string }[], prefix: string): string {
  const largest = items.reduce((max, item) => Math.max(max, Number.parseInt(item.id.split("_").at(-1) ?? "0", 10) || 0), 0);
  return `${prefix}_${String(largest + 1).padStart(6, "0")}`;
}

function nextUnitId(buildings: readonly Building[]): string {
  return nextId(buildings.flatMap((building) => building.units ?? []), "unit");
}

function drawLabel(kind: DrawKind): string {
  return ({ marker: "마커", entrance: "출입구", building: "건물", road: "도로", terrain: "지형", zone: "구역" })[kind];
}

function removeFeature(project: MapProject, kind: SelectedFeature["kind"], id: string): MapProject {
  if (kind === "terrain") return { ...project, terrain: project.terrain.filter((feature) => feature.id !== id) };
  if (kind === "zone") return { ...project, zones: project.zones.filter((feature) => feature.id !== id) };
  if (kind === "road") return { ...project, roads: project.roads.filter((feature) => feature.id !== id) };
  if (kind === "building") return { ...project, buildings: project.buildings.filter((feature) => feature.id !== id) };
  return { ...project, markers: project.markers.filter((feature) => feature.id !== id) };
}

function kindLabel(kind: SelectedFeature["kind"], type: TerrainType | ZoneType | RoadType | BuildingType | MarkerType): string {
  const labels: Record<string, string> = { terrain: "지형", zone: "구역", road: "도로", building: "건물", marker: "마커" };
  const typeLabel = typeOptions(kind).find((option) => option.value === type)?.label ?? type;
  return `${labels[kind]} · ${typeLabel}`;
}

function typeOptions(kind: SelectedFeature["kind"]): { value: string; label: string }[] {
  if (kind === "terrain") return [{ value: "mountain", label: "산" }, { value: "beach", label: "해변" }, { value: "lake", label: "호수" }, { value: "city", label: "도시" }];
  if (kind === "zone") return [{ value: "jurisdiction", label: "관할" }, { value: "safe_zone", label: "안전 구역" }, { value: "pvp_zone", label: "PVP 구역" }];
  if (kind === "road") return [{ value: "highway", label: "고속도로" }, { value: "expressway", label: "자동차전용도로" }, { value: "national_road", label: "국도" }];
  if (kind === "building") return [{ value: "institution", label: "기관" }, { value: "shop", label: "상점" }, { value: "burglary", label: "빈집털이" }, { value: "landmark", label: "랜드마크" }, { value: "terminal", label: "터미널" }, { value: "content", label: "콘텐츠" }];
  return [{ value: "institution", label: "기관" }, { value: "shop", label: "상점" }, { value: "npc", label: "NPC" }, { value: "garage", label: "차고" }, { value: "content", label: "콘텐츠" }, { value: "bus_stop", label: "버스 정류장" }, { value: "gas_station", label: "주유소" }];
}

function clampInteger(value: string, minimum: number, maximum: number, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : Math.min(maximum, Math.max(minimum, parsed));
}

function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function featureChipColor(selection: SelectedFeature): string {
  if (selection.kind === "marker") return selection.feature.color ?? markerColors[selection.feature.type];
  if (selection.kind === "road") return selection.feature.color ?? roadStyles[selection.feature.type].color;
  if (selection.kind === "terrain") return terrainColors[selection.feature.type];
  if (selection.kind === "zone") return zoneColors[selection.feature.type];
  return buildingColors[selection.feature.type];
}

type DetailRecord = Institution | Shop | Npc | Facility;
function detailRecords(project: MapProject, kind: DetailKind): DetailRecord[] {
  if (kind === "institution") return project.institutions;
  if (kind === "shop") return project.shops;
  if (kind === "npc") return project.npcs;
  return project.facilities;
}
function findDetail(project: MapProject, kind: DetailKind, id: string): DetailRecord | undefined {
  return detailRecords(project, kind).find((item) => item.id === id);
}
function findDetailById(project: MapProject, id: string): DetailRecord | undefined {
  return [...project.institutions, ...project.shops, ...project.npcs, ...project.facilities].find((item) => item.id === id);
}
function removeDetail(project: MapProject, kind: DetailKind, id: string): MapProject {
  if (kind === "institution") return { ...project, institutions: project.institutions.filter((item) => item.id !== id) };
  if (kind === "shop") return { ...project, shops: project.shops.filter((item) => item.id !== id) };
  if (kind === "npc") return { ...project, npcs: project.npcs.filter((item) => item.id !== id) };
  return { ...project, facilities: project.facilities.filter((item) => item.id !== id) };
}
function detailKindLabel(kind: DetailKind): string {
  return ({ institution: "기관", shop: "상점", npc: "NPC", facility: "시설" })[kind];
}
function detailTypeLabel(type: string): string {
  return ({ institution: "기관", npc: "NPC", clothing: "의류점", convenience: "편의점", restaurant: "음식점", bar: "바", club: "클럽", street_vendor: "노점", gun_store: "총포상", car_dealership: "차량 판매점", jewelry_store: "보석상", premium_shop: "프리미엄 상점", tattoo_shop: "타투샵", supermarket: "마트", pawn_shop: "전당포", pet_shop: "펫샵", furniture_store: "가구점", ifruit_store: "iFruit 스토어", hair_salon: "미용실", garage: "차고", landmark: "랜드마크", content: "콘텐츠", bus_stop: "버스 정류장", gas_station: "주유소" }[type] ?? type);
}
function detailTypeOptions(kind: "shop" | "facility"): { value: string; label: string }[] {
  return kind === "shop"
    ? shopTypes.map((value) => ({ value, label: detailTypeLabel(value) }))
    : ["garage", "landmark", "content", "bus_stop", "gas_station"].map((value) => ({ value, label: detailTypeLabel(value) }));
}

function hasLocation(detail: DetailRecord | null | undefined): detail is Npc | Facility {
  return Boolean(detail && (detail.type === "npc" || ["garage", "landmark", "content", "bus_stop", "gas_station"].includes(detail.type)));
}
function draftLocation(type: "building" | "free_text", value: string): DetailLocation | undefined {
  const text = value.trim();
  if (!text) return undefined;
  return type === "building" ? { type, buildingRef: text } : { type, text };
}
function findBuildingByEntityRef(project: MapProject, entityRef: string): Building | undefined {
  return project.buildings.find((building) => building.entityRef === entityRef);
}
function findMarkerByEntityRef(project: MapProject, entityRef: string): MapMarker | undefined {
  return project.markers.find((marker) => marker.entityRef === entityRef);
}
function availableBuildings(project: MapProject, detail: DetailRecord): Building[] {
  const requiredType = detail.type === "institution" ? "institution" : detail.type === "npc" || isFacilityDetail(detail) ? undefined : "shop";
  return project.buildings.filter((building) => (!requiredType || building.type === requiredType) && (!building.entityRef || building.entityRef === detail.id));
}
function availableMarkers(project: MapProject, detail: DetailRecord): MapMarker[] {
  return project.markers.filter((marker) => (!marker.entityRef || marker.entityRef === detail.id) && markerMatchesDetail(marker, detail));
}
function isFacilityDetail(detail: DetailRecord): detail is Facility {
  return ["garage", "landmark", "content", "bus_stop", "gas_station"].includes(detail.type);
}
function markerMatchesDetail(marker: MapMarker, detail: DetailRecord): boolean {
  if (detail.type === "institution") return marker.type === "institution";
  if (detail.type === "npc") return marker.type === "npc";
  if (isFacilityDetail(detail)) return marker.type === detail.type;
  return marker.type === "shop" && (!marker.shopType || marker.shopType === detail.type);
}
function isShopDetail(detail: DetailRecord): detail is Shop {
  return detail.type !== "institution" && detail.type !== "npc" && !isFacilityDetail(detail);
}
function cleanTextList(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}
function cleanCustomFields(values: readonly { label: string; value: string }[]): { label: string; value: string }[] {
  return values.map((field) => ({ label: field.label.trim(), value: field.value.trim() })).filter((field) => field.label || field.value);
}
function validateResidenceEntrances(project: MapProject): string | null {
  const invalid = project.buildings.find((building) => building.type === "residence" && building.isBurglaryTarget && (!(building.units?.length) || building.units.some((unit) => unit.entrances.length === 0)));
  return invalid ? `절도 대상 주거 건물 “${invalid.name ?? invalid.id}”의 모든 유닛에는 출입구가 최소 1개 필요합니다.` : null;
}

