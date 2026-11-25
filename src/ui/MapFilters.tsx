import type { Dispatch, SetStateAction } from "react";
import type { Visibility } from "./MapCanvas";

const filters = [
  ["terrain", "지형"], ["building", "랜드마크"], ["zone", "구역"],
  ["road", "도로"], ["name", "이름"], ["postalCode", "우편번호"],
] as const;

export function MapFilters({ visible, setVisible }: { visible: Visibility; setVisible: Dispatch<SetStateAction<Visibility>> }) {
  return <div className="map-filters">{filters.map(([key, label]) => {
    const value = visible[key];
    const checked = typeof value === "boolean" ? value : Object.values(value).every(Boolean);
    return <label className="filter-row" key={key}>
      <input type="checkbox" checked={checked} onChange={event => {
        const enabled = event.target.checked;
        setVisible(current => {
          const existing = current[key];
          return { ...current, [key]: typeof existing === "boolean" ? enabled : Object.fromEntries(Object.keys(existing).map(type => [type, enabled])) };
        });
      }} />
      <span>{label}</span>
    </label>;
  })}</div>;
}

