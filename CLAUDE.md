# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
npm install          # install dependencies
npm run dev          # dev server (Vite)
npm run build        # type-check (tsc -b) then production build
npm run lint         # ESLint
npx tsc --noEmit     # type-check only
```

No test runner is configured yet.

## Tech Stack

- React 19 + TypeScript (strict) + Vite 8
- D3.js v7 for SVG map visualization
- React Router v7 for client-side routing
- GitHub API for cloud persistence (PAT auth)
- Google Sheets sync via n8n webhooks
- localStorage for local persistence
- Vercel for deployment

## Architecture

Interactive web app that visualizes food-science research as an island-bridge-city-road metaphor.

**Routing**: `App.tsx` → BrowserRouter with 2 routes:
- `/` — OverviewPage (islands + bridges)
- `/island/:id` — IslandDetailPage (cities + roads within an island)

**State management**: `App.tsx` → `useMapData()` hook → `MapDataContext.Provider`. All mutations go through `mapService` then `getFullMap()` to refresh React state. Return value is `useMemo`-wrapped.

**Data flow**: Pages (`src/pages/`) compose components (`src/components/`). Components call only `src/services/` — never access localStorage or APIs directly.

**Core domain model** (`src/services/types.ts`):
- `Island` = research field, contains `City[]` (sub-topics with linked papers)
- `Bridge` = directed relationship between islands; `Road` = directed relationship between cities
- `Paper` = academic paper with `journal`, `comment`, `figureUrls` fields
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

**App state**: `useMapData` hook manages full CRUD + GitHub save/load. Position-only updates bypass React state for D3 drag performance.

## File Structure

```
src/
├── pages/              # Route-level components
│   ├── OverviewPage.tsx
│   └── IslandDetailPage.tsx
├── components/         # UI components
│   ├── IslandMap.tsx   # D3 island overview
│   ├── CityMap.tsx     # D3 city detail view
│   ├── Sidebar.tsx     # Left sidebar (tree nav + sync buttons)
│   ├── DetailPanel.tsx # Right panel (papers + gaps + cross-refs)
│   ├── Toolbar.tsx     # Top mode switcher + export
│   ├── PaperForm.tsx   # Paper manual entry form
│   ├── GapMemo.tsx     # Research gap sticky notes
│   ├── PromptDialog.tsx
│   ├── FigureLightbox.tsx
│   ├── GitHubSettings.tsx
│   └── SheetsSettings.tsx
├── hooks/
│   ├── useMapData.ts   # All CRUD + GitHub sync + useMemo
│   └── useToolbar.ts   # Mode state management
├── contexts/
│   └── MapDataContext.ts
├── services/
│   ├── types.ts        # Core type definitions
│   ├── mapService.ts   # localStorage CRUD + in-memory cache
│   ├── githubService.ts
│   ├── sheetsService.ts
│   ├── figureService.ts
│   └── semanticScholarService.ts (Phase 2)
└── utils/
    ├── idGenerator.ts
    └── exportMap.ts    # SVG/PNG export
```

## Conventions

- Components: PascalCase filenames, functional components + hooks
- Services/utils: camelCase filenames
- Commit messages: Korean allowed, conventional commits format
- Semantic Scholar API rate limit: 100 req / 5 min without auth key
