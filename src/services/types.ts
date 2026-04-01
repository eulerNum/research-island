// ─── 논문 (Paper) ───────────────────────────────────────────

export interface Paper {
  id: string;
  semanticScholarId?: string;
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  abstract?: string;
  comment?: string;
  aiSummary?: string;
  figureUrls?: string[];
  citationCount?: number;
  url?: string;
  source: 'semantic_scholar' | 'manual' | 'n8n_import';
  createdAt: string;
}

// ─── 연구 갭 (Research Gap) ─────────────────────────────────

export interface ResearchGap {
  id: string;
  description: string;
  source: 'auto_detected' | 'manual';
  relatedPaperIds: string[];
  createdAt: string;
}

// ─── 섬 (Island) = 연구 분야 ────────────────────────────────

export interface Island {
  id: string;
  name: string;
  description?: string;
  position: { x: number; y: number };
  cities: City[];
  color?: string;
}

// ─── 도시 (City) = 세부 주제 ────────────────────────────────

export interface City {
  id: string;
  islandId: string;
  name: string;
  description?: string;
  position: { x: number; y: number };
  paperIds: string[];
}

// ─── 다리 (Bridge) = 섬 간 관계 ────────────────────────────

export type BridgeDirection = 'forward' | 'backward';

export interface Bridge {
  id: string;
  sourceIslandId: string;
  targetIslandId: string;
  direction: BridgeDirection;
  label?: string;
  color?: string;
  controlPoint?: { x: number; y: number };
  paperIds: string[];
  gapIds: string[];
}

// ─── 도로 (Road) = 도시 간 관계 ────────────────────────────

export type RoadDirection = 'forward' | 'backward';

export interface Road {
  id: string;
  sourceCityId: string;
  targetCityId: string;
  direction: RoadDirection;
  label?: string;
  color?: string;
  controlPoint?: { x: number; y: number };
  paperIds: string[];
  gapIds: string[];
}

// ─── 전체 맵 데이터 ────────────────────────────────────────

export interface ResearchMap {
  islands: Island[];
  bridges: Bridge[];
  roads: Road[];
  papers: Paper[];
  gaps: ResearchGap[];
}
