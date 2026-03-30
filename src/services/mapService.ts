import type {
  ResearchMap,
  Island,
  Bridge,
  Road,
  City,
  Paper,
  ResearchGap,
} from './types';

const LEGACY_STORAGE_KEY = 'research-island-map';
const MAX_UNDO = 50;

let activeMapId: string | null = null;
let cache: ResearchMap | null = null;
const undoStack: string[] = [];
const redoStack: string[] = [];

function storageKey(): string {
  return activeMapId ? `research-map-${activeMapId}` : LEGACY_STORAGE_KEY;
}

/** Set the active map ID. Clears cache and undo stacks. */
export function setActiveMapId(mapId: string | null): void {
  if (mapId === activeMapId) return;
  activeMapId = mapId;
  cache = null;
  undoStack.length = 0;
  redoStack.length = 0;
}

export function getActiveMapId(): string | null {
  return activeMapId;
}

/** Check if legacy (single-map) data exists in localStorage */
export function hasLegacyData(): boolean {
  return localStorage.getItem(LEGACY_STORAGE_KEY) !== null;
}

/** Remove legacy data after migration */
export function removeLegacyData(): void {
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

function loadMap(): ResearchMap {
  if (cache) return cache;
  const raw = localStorage.getItem(storageKey());
  if (raw) {
    cache = JSON.parse(raw) as ResearchMap;
    return cache;
  }
  cache = { islands: [], bridges: [], roads: [], papers: [], gaps: [] };
  return cache;
}

function saveMap(map: ResearchMap): void {
  cache = map;
  localStorage.setItem(storageKey(), JSON.stringify(map));
}

/** Push current state to undo stack before a mutation */
function pushUndo(): void {
  const snapshot = JSON.stringify(loadMap());
  undoStack.push(snapshot);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0; // clear redo on new action
}


export function undo(): boolean {
  const snapshot = undoStack.pop();
  if (!snapshot) return false;
  redoStack.push(JSON.stringify(loadMap()));
  const restored = JSON.parse(snapshot) as ResearchMap;
  saveMap(restored);
  return true;
}

export function redo(): boolean {
  const snapshot = redoStack.pop();
  if (!snapshot) return false;
  undoStack.push(JSON.stringify(loadMap()));
  const restored = JSON.parse(snapshot) as ResearchMap;
  saveMap(restored);
  return true;
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

// ─── Islands ────────────────────────────────────────────────

export function getIslands(): Island[] {
  return loadMap().islands;
}

export function addIsland(island: Island): void {
  pushUndo();
  const map = loadMap();
  map.islands.push(island);
  saveMap(map);
}

export function updateIsland(island: Island): void {
  pushUndo();
  const map = loadMap();
  map.islands = map.islands.map((i) => (i.id === island.id ? island : i));
  saveMap(map);
}

export function deleteIsland(id: string): void {
  pushUndo();
  const map = loadMap();
  const island = map.islands.find((i) => i.id === id);
  if (island) {
    const cityIds = new Set(island.cities.map((c) => c.id));
    map.roads = map.roads.filter(
      (r) => !cityIds.has(r.sourceCityId) && !cityIds.has(r.targetCityId),
    );
  }
  map.islands = map.islands.filter((i) => i.id !== id);
  map.bridges = map.bridges.filter(
    (b) => b.sourceIslandId !== id && b.targetIslandId !== id,
  );
  saveMap(map);
}

/** Update island position only — no React state refresh needed */
export function updateIslandPosition(
  id: string,
  position: { x: number; y: number },
): void {
  const map = loadMap();
  const island = map.islands.find((i) => i.id === id);
  if (island) {
    island.position = position;
    saveMap(map);
  }
}

/** Update city position only — no React state refresh needed */
export function updateCityPosition(
  islandId: string,
  cityId: string,
  position: { x: number; y: number },
): void {
  const map = loadMap();
  const island = map.islands.find((i) => i.id === islandId);
  if (island) {
    const city = island.cities.find((c) => c.id === cityId);
    if (city) {
      city.position = position;
      saveMap(map);
    }
  }
}

// ─── Cities ─────────────────────────────────────────────────

export function getCities(islandId: string): City[] {
  const island = loadMap().islands.find((i) => i.id === islandId);
  return island?.cities ?? [];
}

export function addCity(islandId: string, city: City): void {
  pushUndo();
  const map = loadMap();
  const island = map.islands.find((i) => i.id === islandId);
  if (island) {
    island.cities.push(city);
    saveMap(map);
  }
}

export function updateCity(islandId: string, city: City): void {
  pushUndo();
  const map = loadMap();
  const island = map.islands.find((i) => i.id === islandId);
  if (island) {
    island.cities = island.cities.map((c) => (c.id === city.id ? city : c));
    saveMap(map);
  }
}

export function deleteCity(islandId: string, cityId: string): void {
  pushUndo();
  const map = loadMap();
  const island = map.islands.find((i) => i.id === islandId);
  if (island) {
    island.cities = island.cities.filter((c) => c.id !== cityId);
  }
  map.roads = map.roads.filter(
    (r) => r.sourceCityId !== cityId && r.targetCityId !== cityId,
  );
  saveMap(map);
}

// ─── Bridges ────────────────────────────────────────────────

export function getBridges(): Bridge[] {
  return loadMap().bridges;
}

export function addBridge(bridge: Bridge): void {
  pushUndo();
  const map = loadMap();
  map.bridges.push(bridge);
  saveMap(map);
}

export function updateBridge(bridge: Bridge): void {
  pushUndo();
  const map = loadMap();
  map.bridges = map.bridges.map((b) => (b.id === bridge.id ? bridge : b));
  saveMap(map);
}

/** Update bridge control point only — no React re-render needed (D3 handles visuals) */
export function updateBridgeControlPoint(
  id: string,
  controlPoint: { x: number; y: number },
): void {
  const map = loadMap();
  const bridge = map.bridges.find((b) => b.id === id);
  if (bridge) {
    bridge.controlPoint = controlPoint;
    saveMap(map);
  }
}

export function deleteBridge(id: string): void {
  pushUndo();
  const map = loadMap();
  map.bridges = map.bridges.filter((b) => b.id !== id);
  saveMap(map);
}

// ─── Roads ──────────────────────────────────────────────────

export function getRoads(): Road[] {
  return loadMap().roads;
}

export function addRoad(road: Road): void {
  pushUndo();
  const map = loadMap();
  map.roads.push(road);
  saveMap(map);
}

export function updateRoad(road: Road): void {
  pushUndo();
  const map = loadMap();
  map.roads = map.roads.map((r) => (r.id === road.id ? road : r));
  saveMap(map);
}

/** Update road control point only — no React re-render needed */
export function updateRoadControlPoint(
  id: string,
  controlPoint: { x: number; y: number },
): void {
  const map = loadMap();
  const road = map.roads.find((r) => r.id === id);
  if (road) {
    road.controlPoint = controlPoint;
    saveMap(map);
  }
}

export function deleteRoad(id: string): void {
  pushUndo();
  const map = loadMap();
  map.roads = map.roads.filter((r) => r.id !== id);
  saveMap(map);
}

// ─── Papers ─────────────────────────────────────────────────

export function getPapers(): Paper[] {
  return loadMap().papers;
}

/** Add paper. Returns the actual stored paper ID (existing if duplicate detected). */
export function addPaper(paper: Paper): string {
  const map = loadMap();
  const existing = map.papers.find(
    (p) =>
      (paper.semanticScholarId && p.semanticScholarId === paper.semanticScholarId) ||
      (p.title === paper.title && p.year === paper.year),
  );
  if (existing) {
    return existing.id;
  }
  pushUndo();
  map.papers.push(paper);
  saveMap(map);
  return paper.id;
}

// ─── Research Gaps ──────────────────────────────────────────

export function getGaps(): ResearchGap[] {
  return loadMap().gaps;
}

export function addGap(gap: ResearchGap): void {
  pushUndo();
  const map = loadMap();
  map.gaps.push(gap);
  saveMap(map);
}

export function deleteGap(id: string): void {
  pushUndo();
  const map = loadMap();
  map.gaps = map.gaps.filter((g) => g.id !== id);
  map.bridges.forEach((b) => {
    b.gapIds = b.gapIds.filter((gid) => gid !== id);
  });
  map.roads.forEach((r) => {
    r.gapIds = r.gapIds.filter((gid) => gid !== id);
  });
  saveMap(map);
}

// ─── Papers (extended) ─────────────────────────────────────

export function updatePaper(paper: Paper): void {
  pushUndo();
  const map = loadMap();
  map.papers = map.papers.map((p) => (p.id === paper.id ? paper : p));
  saveMap(map);
}

export function deletePaper(id: string): void {
  pushUndo();
  const map = loadMap();
  map.papers = map.papers.filter((p) => p.id !== id);
  map.bridges.forEach((b) => {
    b.paperIds = b.paperIds.filter((pid) => pid !== id);
  });
  map.roads.forEach((r) => {
    r.paperIds = r.paperIds.filter((pid) => pid !== id);
  });
  map.islands.forEach((island) => {
    island.cities.forEach((city) => {
      city.paperIds = city.paperIds.filter((pid) => pid !== id);
    });
  });
  saveMap(map);
}

// ─── Full Map ───────────────────────────────────────────────

export function getFullMap(): ResearchMap {
  const map = structuredClone(loadMap());
  // Clean up orphaned paperIds (paperIds referencing non-existent papers)
  const validPaperIds = new Set(map.papers.map((p) => p.id));
  let cleaned = false;
  for (const b of map.bridges) {
    const before = b.paperIds.length;
    b.paperIds = b.paperIds.filter((pid) => validPaperIds.has(pid));
    if (b.paperIds.length !== before) cleaned = true;
  }
  for (const r of map.roads) {
    const before = r.paperIds.length;
    r.paperIds = r.paperIds.filter((pid) => validPaperIds.has(pid));
    if (r.paperIds.length !== before) cleaned = true;
  }
  for (const island of map.islands) {
    for (const city of island.cities) {
      const before = city.paperIds.length;
      city.paperIds = city.paperIds.filter((pid) => validPaperIds.has(pid));
      if (city.paperIds.length !== before) cleaned = true;
    }
  }
  if (cleaned) {
    // Persist the cleanup to cache + localStorage
    cache = structuredClone(map);
    localStorage.setItem(storageKey(), JSON.stringify(cache));
  }
  return map;
}

export function importMap(map: ResearchMap): void {
  saveMap(map);
}

export function saveFullMap(map: ResearchMap): void {
  saveMap(map);
}
