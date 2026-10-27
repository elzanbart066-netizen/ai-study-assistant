import type { SourceLink } from "../models/index.js";
import { Icon } from "./Icon.js";

export function SourceCard({ source, index }: { source: SourceLink; index: number }) {
  return (
    <a className="source-card" href={source.url} rel="noopener noreferrer" target="_blank">
      <span className="source-index">{index + 1}</span>
      <span className="source-text">
        <strong>{source.title}</strong>
        <small>
          <Icon name="link" size={13} /> {source.domain}
        </small>
      </span>
    </a>
  );
}
