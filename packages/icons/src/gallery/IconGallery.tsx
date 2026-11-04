import { useId, useState } from "react";
import { iconList } from "../generated/icon-list";
import type { IconSize } from "../Icon";
import { filterIcons } from "./filterIcons";
import "./IconGallery.css";

export interface IconGalleryProps {
  /** Size every icon is drawn at. */
  readonly size?: IconSize;
  /** Text already in the filter box. */
  readonly initialQuery?: string;
}

/** Every icon with its name, filtered by name as you type. Shown on the Foundations/Icons page. */
export function IconGallery({ size = 24, initialQuery = "" }: IconGalleryProps) {
  const inputId = useId();
  const [query, setQuery] = useState(initialQuery);
  const shown = filterIcons(iconList, query);

  return (
    <div className="mb-icon-gallery">
      <label htmlFor={inputId}>Filter icons by name</label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
      />
      <p aria-live="polite" className="mb-icon-gallery__count">
        {shown.length === 0
          ? `No icon matches “${query.trim()}”.`
          : `${shown.length} of ${iconList.length} icons`}
      </p>
      <ul className="mb-icon-gallery__grid">
        {shown.map(({ name, Icon }) => (
          <li key={name}>
            <Icon size={size} />
            <code>{name}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
