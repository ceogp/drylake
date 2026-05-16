import { parseXu } from "../xu/parseXu";

function stripFence(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:yaml|yml|xu)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function parseAiRunbookResponse(value: string) {
  return parseXu(stripFence(value));
}

