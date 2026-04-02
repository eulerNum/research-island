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
const DB_NAME = 'research-island-map-db';
const DB_VERSION = 1;
const STORE_NAME = 'maps';
const MAX_UNDO = 20;
const UNDO_BUDGET_BYTES = 50 * 1024 * 1024; // 50 MB total for undo+redo

let activeMapId: string | null = null;
let cache: ResearchMap | null = null;
const undoStack: string[] = [];
const redoStack: string[] = [];
let undoBytes = 0;
let redoBytes = 0;

function strBytes(s: string): number {
  return s.length * 2; // JS strings are UTF-16
}

function storageKey(): string {
  return activeMapId ? `research-map-${activeMapId}` : LEGACY_STORAGE_KEY;
}

// ─── IndexedDB helpers ─────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Read a map from IndexedDB (async) */
async function idbGet(key: string): Promise<ResearchMap | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Write a map to IndexedDB (async, fire-and-forget safe) */
async function idbSet(key: string, value: ResearchMap): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Delete a key from IndexedDB */
async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Check if a key exists in IndexedDB */
async function idbHas(key: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count(key);
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror = () => reject(req.error);
  });
}

// ─── Migration: localStorage → IndexedDB ───────────────────

/** Migrate all research-map-* keys from localStorage to IndexedDB, then remove them. */
async function migrateFromLocalStorage(): Promise<void> {
  const keysToMigrate: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key === LEGACY_STORAGE_KEY || key.startsWith('research-map-'))) {
      keysToMigrate.push(key);
    }
  }
  for (const key of keysToMigrate) {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const map = JSON.parse(raw) as ResearchMap;
        const alreadyInIdb = await idbHas(key);
        if (!alreadyInIdb) {
          await idbSet(key, map);
        }
        localStorage.removeItem(key);
      } catch {
        // corrupted data — just remove it
        localStorage.removeItem(key);
      }
    }
  }
}

// ─── Init (async, called once per mapId switch) ────────────

let initPromise: Promise<void> | null = null;
let initDone = false;

/** Initialize: migrate localStorage → IndexedDB, load into cache.
 *  Returns a promise that resolves when cache is ready.
 *  Safe to call multiple times — deduplicates. */
export async function initStorage(): Promise<void> {
  if (initDone) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await migrateFromLocalStorage();
    // Load current map into cache
    const data = await idbGet(storageKey());
    if (data) {
      cache = data;
    } else {
      cache = { islands: [], bridges: [], roads: [], papers: [], gaps: [] };
    }
    initDone = true;
  })();
  return initPromise;
}

/** Reset init state — called when activeMapId changes */
function resetInit(): void {
  initDone = false;
  initPromise = null;
}

// ─── Core load/save ────────────────────────────────────────

/** Set the active map ID. Clears cache and undo stacks. */
export function setActiveMapId(mapId: string | null): void {
  if (mapId === activeMapId) return;
  activeMapId = mapId;
  cache = null;
  undoStack.length = 0;
  redoStack.length = 0;
  undoBytes = 0;
  redoBytes = 0;
  resetInit();
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
  idbDelete(LEGACY_STORAGE_KEY).catch(() => {});
}

function loadMap(): ResearchMap {
  if (cache) return cache;
  // Fallback: if initStorage hasn't completed, return empty map.
  // initStorage will overwrite cache when done.
  cache = { islands: [], bridges: [], roads: [], papers: [], gaps: [] };
  return cache;
}

function saveMap(map: ResearchMap): void {
  cache = map;
  // Fire-and-forget write to IndexedDB (async, but we don't block)
  idbSet(storageKey(), structuredClone(map)).catch((err) => {
    console.warn('[mapService] IndexedDB write failed:', err);
  });
}

/** Push current state to undo stack before a mutation */
function pushUndo(): void {
  const snapshot = JSON.stringify(loadMap());
  const size = strBytes(snapshot);
  undoStack.push(snapshot);
  undoBytes += size;

  // Evict oldest until under budget and count cap
  while (undoStack.length > MAX_UNDO || undoBytes + redoBytes > UNDO_BUDGET_BYTES) {
    if (undoStack.length <= 1) break;
    const evicted = undoStack.shift()!;
    undoBytes -= strBytes(evicted);
  }

  // Clear redo on new action
  redoStack.length = 0;
  redoBytes = 0;
}

export function undo(): boolean {
  const snapshot = undoStack.pop();
  if (!snapshot) return false;
  undoBytes -= strBytes(snapshot);

  const currentSnapshot = JSON.stringify(loadMap());
  redoStack.push(currentSnapshot);
  redoBytes += strBytes(currentSnapshot);

  const restored = JSON.parse(snapshot) as ResearchMap;
  saveMap(restored);
  return true;
}

export function redo(): boolean {
  const snapshot = redoStack.pop();
  if (!snapshot) return false;
  redoBytes -= strBytes(snapshot);

  const currentSnapshot = JSON.stringify(loadMap());
  undoStack.push(currentSnapshot);
  undoBytes += strBytes(currentSnapshot);

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
    cache = structuredClone(map);
    saveMap(cache);
  }
  return map;
}

export function importMap(map: ResearchMap): void {
  saveMap(map);
}

export function saveFullMap(map: ResearchMap): void {
  saveMap(map);
}
