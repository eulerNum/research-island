# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
npm install          # install dependencies
npm run dev          # dev server (Vite)
npm run build        # type-check (tsc -b) then production build
npm run lint         # ESLint
npm test             # Vitest (services 단위 테스트, vitest.config.ts)
npx tsc --noEmit     # type-check only
```

## Craft

- `~/.claude/craft-packs/researcher/pack.md` — 연구 워크플로우 공용 자산 (4계층 ontology, 논문 요약 schema, Phase 운영 가이드)

## Plan & Decisions

- 진행 중인 Phase는 `TODO.md` (3단계 구조: Phase / Step / Task)
- 결정 기록은 `docs/decisions/NNNN-*.md` (ADR — 왜 그렇게 했는지)
- 현재 활성 Phase: **A — 거버넌스 정렬 + craft-pack 즉시 승격** (`~/.claude/plans/wild-foraging-music.md`)

## Tech Stack

- React 19 + TypeScript (strict) + Vite 8
- D3.js v7 for SVG map visualization
- React Router v7 for client-side routing
- GitHub API for cloud persistence (PAT auth)
- Google Sheets sync via n8n webhooks
- IndexedDB for local persistence (NOT localStorage — 5MB 한도 초과 문제로 전환)
- Vercel for deployment (git push → webhook → auto build, 백업: `npx vercel --prod`)

## Architecture

Interactive web app that visualizes food-science research as an island-bridge-city-road metaphor.

**Routing**: `App.tsx` → BrowserRouter:
- `/` — HomePage (multi-map dashboard)
- `/map/:mapId` — MapWrapper → OverviewPage (islands + bridges)
- `/map/:mapId/island/:id` — IslandDetailPage (cities + roads within an island)

**State management**: `MapWrapper.tsx` → `useMapData(mapId)` hook → `MapDataContext.Provider`. All mutations go through `mapService` then `getFullMap()` to refresh React state. Return value is `useMemo`-wrapped.

**Data flow**: Pages (`src/pages/`) compose components (`src/components/`). Components call only `src/services/` — never access localStorage or APIs directly.

**Core domain model** (`src/services/types.ts`):
- `Island` = research field, contains `City[]` (sub-topics with linked papers)
- `Bridge` = directed relationship between islands; `Road` = directed relationship between cities
- `Paper` = academic paper with `journal`, `comment`, `figureUrls`, `aiSummary` fields
- `ResearchGap` = identified gap (`auto_detected` | `manual`)
- `ResearchMap` = top-level container for the entire map state

**Key rules**:
- Directions are only `forward` (green `#2a9d8f`) or `backward` (orange `#e76f51`). No bidirectional bridges/roads.
- A single paper can appear on multiple bridges/roads.
- Paper dedup: match by `semanticScholarId` or `title + year`.

**Rendering**:
- `IslandMap` — D3 force-directed layout for islands, Bezier curves for parallel bridges, dash-flow animation
- `CityMap` — D3 grid layout for cities within an island, same curve/animation system
- Both support drag-to-move (position saved without React re-render), zoom/pan, glow highlight
- Both support paper drag-and-drop from sidebar onto bridges/roads

**App state**: `useMapData` hook manages full CRUD + GitHub save/load. Position-only updates bypass React state for D3 drag performance.

**Local persistence** (`mapService.ts`):
- IndexedDB for map data (NOT localStorage — 5MB limit exceeded with large maps)
- In-memory cache for sync reads; IndexedDB writes are async fire-and-forget
- `initStorage()`: migrates legacy localStorage data → IndexedDB on first load
- Undo/redo: size-budgeted (50MB total, max 20 snapshots) to prevent RAM explosion
- localStorage is ONLY used for small config values (API keys, theme, GitHub config)

**GitHub sync** (`githubService.ts`):
- SHA-based conflict detection: tracks last-known SHA per file, compares before save
- Manual save only: user clicks Save button → GitHub push (no auto-save)
- Auto-load: on mount to pick up changes from other devices
- Small files (<1MB): Contents API PUT (single request)
- Large files (>1MB) save: Git Data API (blob → tree → commit → update ref)
- Large files (>1MB) load: Git Blob API fallback (NOT `raw.githubusercontent.com` — CORS blocked with auth headers)
- Cache busting: URL `?t=timestamp` on all GitHub API calls (NOT `cache: 'no-store'` or `If-None-Match` — these cause CORS/fetch failures)
- Base64 encoding: `TextEncoder`/`TextDecoder` based (NOT `btoa`/`atob` with `escape`/`unescape` — breaks on large or Korean-heavy payloads)

**Vercel deployment**:
- git push → GitHub webhook → Vercel 자동 빌드
- `vercel.json`: SPA rewrite만 (ignoreCommand 제거됨 — 모든 push에서 빌드)
- webhook 장애 시: `npx vercel --prod`로 로컬 직접 배포
- 전체 데이터 흐름은 `storage-flow.md` 참조

## File Structure

```
src/
├── pages/              # Route-level components
│   ├── HomePage.tsx    # Multi-map dashboard
│   ├── MapWrapper.tsx  # mapId-scoped MapDataContext
│   ├── OverviewPage.tsx
│   └── IslandDetailPage.tsx
├── components/         # UI components
│   ├── IslandMap.tsx   # D3 island overview + bridge drop targets + island expand
│   ├── CityMap.tsx     # D3 city detail view + road drop targets
│   ├── Sidebar.tsx     # Left sidebar (tree nav + paper grouping + draggable + hover tooltip)
│   ├── DetailPanel.tsx # Right panel (bridge/road papers + gaps + AI chat + resizable)
│   ├── AIChatPanel.tsx # AI 채팅 UI (DetailPanel 상단, Gemini tool use)
│   ├── PaperStudyPanel.tsx # Wide paper study panel (AI summary, figures, notes)
│   ├── GapPostitAnimation.tsx # Gap memo postit fly animation
│   ├── Toolbar.tsx     # Top mode switcher + export
│   ├── PaperForm.tsx   # Paper manual entry form + S2 search
│   ├── GapMemo.tsx     # Research gap sticky notes
│   ├── PromptDialog.tsx
│   ├── PinDialog.tsx
│   ├── NewMapDialog.tsx
│   ├── FigureLightbox.tsx
│   ├── ContextMenu.tsx
│   ├── GitHubSettings.tsx
│   ├── SheetsSettings.tsx
│   └── ClaudeSettings.tsx  # Claude + Gemini API key 설정
├── hooks/
│   ├── useMapData.ts   # All CRUD + manual Save + auto Load + conflict detection
│   ├── useAIChat.ts    # AI 채팅 상태 관리 (messages, streaming, tool status)
│   ├── useToolbar.ts   # Mode state management
│   └── useTheme.ts     # Dark mode toggle
├── contexts/
│   ├── MapDataContext.ts
│   └── ThemeContext.ts
├── services/
│   ├── types.ts        # Core type definitions
│   ├── mapService.ts   # IndexedDB CRUD + in-memory cache + Undo/Redo
│   ├── mapIndexService.ts # GitHub maps-index.json CRUD + PIN hash
│   ├── githubService.ts   # GitHub Contents API + Blob API + conflict detection
│   ├── aiService.ts       # Claude API (suggestPapers, summarizePaper — legacy)
│   ├── aiChatService.ts   # Gemini 기반 AI 채팅 (tool use + 자동분류)
│   ├── geminiService.ts   # Gemini 2.5 Flash API 연동
│   ├── deepSearchService.ts # Deep Search v2 (7-phase pipeline)
│   ├── semanticScholarService.ts # S2 search + refs/cites + recommendations
│   ├── openAlexService.ts # OpenAlex search + citations + venue search
│   ├── pubmedService.ts   # PubMed E-utilities search
│   ├── sheetsService.ts
│   └── figureService.ts
└── utils/
    ├── idGenerator.ts
    └── exportMap.ts    # SVG/PNG export
```

## Conventions

- Components: PascalCase filenames, functional components + hooks
- Services/utils: camelCase filenames
- Commit messages: Korean allowed, conventional commits format
- Semantic Scholar API rate limit: 100 req / 5 min without auth key

## Debugging & Troubleshooting

유저에게 에러가 발생하면 아래 순서로 지시:

1. **브라우저 콘솔 확인**: F12 → Console 탭에서 빨간색 에러 메시지 전문 복사
2. **Network 탭 확인**: F12 → Network 탭에서 실패한 요청의 Status, URL, Response 확인
3. 에러 메시지 전문을 그대로 전달 — "failed to fetch" 같은 요약이 아니라 CORS policy, status code 등 상세 정보가 핵심

### 알려진 함정 (절대 하지 말 것)
- `cache: 'no-store'` — cross-origin fetch에서 브라우저별로 CORS 실패 유발
- `If-None-Match` 커스텀 헤더 — CORS preflight 트리거, GitHub API 외 서버에서 실패
- `raw.githubusercontent.com` + `Authorization` 헤더 — preflight 미지원으로 CORS 차단
- `btoa(unescape(encodeURIComponent(...)))` — 큰 payload에서 call stack overflow 또는 인코딩 깨짐
- GitHub Contents API 응답의 `download_url` — private repo + auth 조합에서 CORS 실패, Git Blob API 사용할 것
