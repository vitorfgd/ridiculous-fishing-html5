type DepthEventType = "schoolCorridor" | "treasurePocket" | "trashField" | "predatorPass" | "jellyBloom";

export type ActiveDepthEvent = {
  type: DepthEventType;
  startDepthM: number;
  endDepthM: number;
  label: string;
  accentHex: string;
};

const DEPTH_EVENT_DEFS: Record<DepthEventType, { label: string; accentHex: string }> = {
  schoolCorridor: { label: "SCHOOL CORRIDOR", accentHex: "#9ae0ff" },
  treasurePocket: { label: "TREASURE POCKET", accentHex: "#ffd86c" },
  trashField: { label: "TRASH FIELD", accentHex: "#cda68d" },
  predatorPass: { label: "PREDATOR PASS", accentHex: "#7bc3ff" },
  jellyBloom: { label: "JELLY BLOOM", accentHex: "#ff9de6" },
};

function randomRangeInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function weightedEventType(depthM: number): DepthEventType {
  const weights: Array<{ type: DepthEventType; weight: number }> = [
    { type: "schoolCorridor", weight: depthM < 140 ? 5 : 2 },
    { type: "treasurePocket", weight: depthM >= 60 ? 3 : 1 },
    { type: "trashField", weight: 3 },
    { type: "predatorPass", weight: depthM >= 180 ? 3 : 1 },
    { type: "jellyBloom", weight: depthM >= 240 ? 4 : 1 },
  ];
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return "schoolCorridor";
}

export function createDepthEvents(maxDepthM: number): ActiveDepthEvent[] {
  const events: ActiveDepthEvent[] = [];
  let cursor = 32;
  while (cursor < maxDepthM - 20) {
    const span = randomRangeInt(18, 24);
    const type = weightedEventType(cursor);
    const def = DEPTH_EVENT_DEFS[type];
    events.push({
      type,
      startDepthM: cursor,
      endDepthM: Math.min(maxDepthM - 8, cursor + span),
      label: def.label,
      accentHex: def.accentHex,
    });
    cursor += randomRangeInt(28, 40);
  }
  return events;
}

export function activeDepthEventForDepth(
  depthM: number,
  events: ActiveDepthEvent[],
): ActiveDepthEvent | undefined {
  return events.find((event) => depthM >= event.startDepthM && depthM <= event.endDepthM);
}
