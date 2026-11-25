import { useCallback, useEffect, useMemo, useState } from "react";
import type { MapProject } from "../domain/types";
import { buildingColors, markerColors, roadStyles, terrainColors, zoneColors } from "../domain/theme";
import { MapCanvas, type SelectedFeature, type Visibility } from "../ui/MapCanvas";
import { PopupBanner } from "../ui/PopupBanner";
import { loadProject } from "./loadProject";
import { buildingDetails } from "../domain/buildingDetails";
import { MapFilters } from "../ui/MapFilters";

const labels: Record<string, string> = { mountain: "산", beach: "해변", lake: "호수", city: "도시", institution: "기관", shop: "상점", residence: "주거", burglary: "빈집털이", terminal: "터미널", npc: "NPC", garage: "차고", landmark: "랜드마크", content: "콘텐츠", bus_stop: "버스 정류장", gas_station: "주유소", highway: "고속도로", expressway: "도시고속도로", national_road: "일반도로", jurisdiction: "관할 구역", safe_zone: "안전 구역", pvp_zone: "PVP 구역" };
const initialVisibility = (): Visibility => ({ terrain: { mountain: true, beach: true, lake: true, city: true }, building: { institution: true, shop: true, residence: true, burglary: true, landmark: true, terminal: true, content: true }, marker: { institution: true, shop: true, npc: true, garage: true, landmark: true, content: true, terminal: true, gas_station: true }, zone: true, road: true, name: true, postalCode: true });
const noop = () => {};
function featureColor(selection: SelectedFeature): string {
  if (selection.kind === "marker") return selection.feature.color ?? markerColors[selection.feature.type];
  if (selection.kind === "building") return selection.feature.color ?? buildingColors[selection.feature.type];
  if (selection.kind === "road") return selection.feature.color ?? roadStyles[selection.feature.type].color;
  if (selection.kind === "terrain") return terrainColors[selection.feature.type];
  return zoneColors[selection.feature.type];
}

export function Viewer() {
  const [project, setProject] = useState<MapProject | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { const controller = new AbortController(); void loadProject(controller.signal).then(setProject).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); }); return () => controller.abort(); }, []);
  if (error) return <main className="viewer-message" role="alert"><h1>지도를 불러오지 못했습니다</h1><p>{error}</p><button onClick={() => location.reload()}>다시 시도</button></main>;
  if (!project) return <main className="viewer-message" role="status">지도를 불러오는 중…</main>;
  return <LoadedViewer project={project} />;
}
function LoadedViewer({ project }: { project: MapProject }) {
  const [visible, setVisible] = useState(initialVisibility);
  const [selection, setSelection] = useState<SelectedFeature | null>(null);
  const [focus, setFocus] = useState<SelectedFeature | null>(null);
  const [unit, setUnit] = useState<{ buildingId: string; unitId: string } | null>(null);
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<"filter" | "legend" | null>(null);
  const onSelect = useCallback((next: SelectedFeature | null) => { setSelection(next); setFocus(null); setUnit(null); setPanel(current => current === "legend" ? current : null); }, []);
  const results = useMemo(() => {
    const candidates: SelectedFeature[] = [ ...project.terrain.map(feature => ({ kind: "terrain" as const, feature })), ...project.buildings.map(feature => ({ kind: "building" as const, feature })), ...project.roads.map(feature => ({ kind: "road" as const, feature })), ...project.zones.map(feature => ({ kind: "zone" as const, feature })) ];
    const key = query.trim().toLocaleLowerCase();
    return key ? candidates.filter(({ kind, feature }) => `${feature.name ?? ""} ${feature.id} ${kind === "building" && "postalCode" in feature ? feature.postalCode ?? "" : ""}`.toLocaleLowerCase().includes(key)) : [];
  }, [project, query]);
  const chooseResult = (result: SelectedFeature) => {
    setVisible(current => result.kind === "zone" || result.kind === "road" ? { ...current, [result.kind]: true } : { ...current, [result.kind]: { ...current[result.kind], [result.feature.type]: true } });
    setSelection(result); setFocus({ ...result }); setUnit(null); setQuery(""); setPanel(null);
  };
  const linkedDetails = selection?.kind === "building" ? buildingDetails(project, selection.feature) : [];
  return <main className="public-viewer">
    <header className="viewer-toolbar"><strong>{project.projectName}</strong><nav aria-label="지도 패널"><button aria-expanded={panel === "filter"} onClick={() => setPanel(panel === "filter" ? null : "filter")}>필터</button><button aria-expanded={panel === "legend"} onClick={() => setPanel(panel === "legend" ? null : "legend")}>범례</button></nav></header>
    <section className="viewer-map">
      <MapCanvas project={project} visible={visible} selection={selection} focusTarget={focus} onSelect={onSelect} editorMode={false} drawKind={null} onDrawn={noop} onGeometryEdited={noop} onEntranceMoved={noop} visibleEntranceUnit={unit} />
      <div className="viewer-search"><input aria-label="지도 검색" placeholder="이름 · 객체 ID · 우편번호 검색" value={query} onFocus={() => setPanel(null)} onChange={e => setQuery(e.target.value)} />{query && <button aria-label="검색 지우기" onClick={() => setQuery("")}>×</button>}
        {query.trim() && <div className="viewer-results" aria-label="검색 결과">{results.length ? results.map(result => <button key={`${result.kind}-${result.feature.id}`} onClick={() => chooseResult(result)}><strong>{result.feature.name || "이름 없음"}</strong><small>{labels[result.feature.type]}{result.kind === "building" && result.feature.postalCode ? ` · ${result.feature.postalCode}` : ""}</small></button>) : <p>검색 결과가 없습니다.</p>}</div>}
      </div>
      {panel && <aside className="viewer-panel" aria-label={panel === "filter" ? "필터" : "범례"}><div className="viewer-panel-heading"><h2>{panel === "filter" ? "필터" : "범례"}</h2><button aria-label="패널 닫기" onClick={() => setPanel(null)}>×</button></div>
        {panel === "filter" ? <><button onClick={() => setVisible(initialVisibility())}>전체 표시</button><MapFilters visible={visible} setVisible={setVisible} /></> : <>{[["건물", buildingColors], ["도로", Object.fromEntries(Object.entries(roadStyles).map(([key, value]) => [key, value.color]))], ["지형", terrainColors]].map(([title, colors]) => <details key={String(title)} open><summary>{String(title)}</summary>{Object.entries(colors).filter(([key]) => !(title === "건물" && key === "residence") && !(title === "지형" && key === "city")).map(([key, color]) => <div className="viewer-swatch" key={key}><i style={{ background: color as string }} />{labels[key]}</div>)}</details>)}<p className="viewer-swatch"><i style={{ border: "3px solid #ffffff" }} />선택 강조</p><small>사용자 지정 색상이 있으면 해당 색상을 우선 표시합니다.</small></>}
      </aside>}
      {selection && panel !== "filter" && <aside className="viewer-detail" role="dialog" aria-label="객체 상세">{selection.kind !== "road" && <PopupBanner url={project.icons?.find(image => image.id === selection.feature.bannerRef)?.url} />}<div className="viewer-panel-heading"><div className="viewer-feature-title"><span aria-hidden="true" className={`feature-chip ${selection.kind}`} style={{ display: "block", backgroundColor: featureColor(selection) }}>{(selection.kind === "marker" || selection.kind === "building") && (() => { const icon = project.icons?.find(item => item.id === selection.feature.iconRef); return icon?.url ? <img className="feature-icon-image" src={icon.url} alt="" onError={event => { event.currentTarget.hidden = true; }} /> : null; })()}</span><h2>{selection.feature.name || labels[selection.feature.type]}</h2></div><button aria-label="상세 닫기" onClick={() => onSelect(null)}>×</button></div><small>{{ terrain: "지형", building: "건물", marker: "마커", road: "도로", zone: "구역" }[selection.kind]} · {labels[selection.feature.type]}</small>
        {selection.kind !== "road" && selection.kind !== "marker" && selection.feature.description && <p>{selection.feature.description}</p>}
        {selection.kind === "building" && <>{selection.feature.postalCode && <div className="viewer-building-info"><span>우편번호 {selection.feature.postalCode}</span></div>}{selection.feature.type === "residence" && <section><h3>주거 유닛</h3>{selection.feature.units?.length ? <><select aria-label="주거 유닛 선택" value={unit?.unitId ?? ""} onChange={e => setUnit(e.target.value ? { buildingId: selection.feature.id, unitId: e.target.value } : null)}><option value="">유닛 선택 · 출입구 숨김</option>{selection.feature.units.map(item => <option key={item.id} value={item.id}>{item.houseNumber || "이름 없는 유닛"}</option>)}</select><p>선택한 유닛의 출입구만 흰색 원으로 표시됩니다.</p></> : <p>등록된 유닛이 없습니다.</p>}</section>}</>}
        {linkedDetails.map(linked => <section key={linked.id}><h3>{linked.name || "연결 상세"}</h3>{linked.description && <p>{linked.description}</p>}{"items" in linked && linked.items?.length ? <><h4>판매 품목</h4><ul>{linked.items.map((item, i) => <li key={i}>{item}</li>)}</ul></> : null}{"quests" in linked && linked.quests?.length ? <><h4>퀘스트</h4><ul>{linked.quests.map((item, i) => <li key={i}>{item}</li>)}</ul></> : null}{"location" in linked && linked.location?.type === "free_text" && <p>{linked.location.text}</p>}<dl>{linked.customFields?.map((field, i) => <div key={i}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl></section>)}
      </aside>}
    </section>
  </main>;
}

