const IMPORT_ROOT_MARKERS = [
  ".agents/skills",
  ".codex/agents",
  ".codex/skills",
  ".claude/agents",
  ".claude/skills",
  ".cursor/rules",
  ".cursor/skills",
];

function normalizeSlashes(rawValue: string) {
  return rawValue.replace(/\\/g, "/").replace(/^\/+/, "").trim();
}

function findMarkerStart(segments: string[], marker: string) {
  const markerSegments = marker.split("/");
  const lowerSegments = segments.map((segment) => segment.toLowerCase());

  for (let index = 0; index <= segments.length - markerSegments.length; index += 1) {
    const matches = markerSegments.every(
      (markerSegment, offset) => lowerSegments[index + offset] === markerSegment,
    );

    if (matches) {
      return index;
    }
  }

  return -1;
}

export function normalizeImportLogicalPath(rawValue: string) {
  const normalized = normalizeSlashes(rawValue);

  if (!normalized) {
    return "";
  }

  const segments = normalized.split("/").filter(Boolean);

  for (const marker of IMPORT_ROOT_MARKERS) {
    const markerStart = findMarkerStart(segments, marker);

    if (markerStart > 0) {
      return segments.slice(markerStart).join("/");
    }
  }

  if (segments.length === 2) {
    const fileName = segments[1];

    if (fileName === "AGENTS.md" || fileName === "CLAUDE.md") {
      return fileName;
    }
  }

  return normalized;
}
