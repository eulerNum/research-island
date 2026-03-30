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
- Semantic Scholar API for paper search
- localStorage for persistence (initial phase)

## Architecture

Interactive web app that visualizes food-science research as an island-bridge-city-road metaphor.

**Data flow**: UI components (`src/components/`) call only `src/services/` — never access localStorage or APIs directly. This separation exists to prepare for future n8n workflow integration.

**Core domain model** (`src/services/types.ts`):
- `Island` = research field, contains `City[]` (sub-topics with linked papers)
- `Bridge` = directed relationship between islands; `Road` = directed relationship between cities
- `Paper` = academic paper (from Semantic Scholar or manual entry)
- `ResearchGap` = identified gap (`auto_detected` | `manual`)
- `ResearchMap` = top-level container for the entire map state

**Key rules**:
- Directions are only `forward` (green `#2a9d8f`) or `backward` (orange `#e76f51`). No bidirectional bridges/roads.
- A single paper can appear on multiple bridges/roads.
- Paper dedup: match by `semanticScholarId` or `title + year`.

**Rendering**: `IslandMap` component uses D3 to render islands as ellipses and bridges as dashed lines on an SVG with zoom/pan. `Sidebar` shows summary counts and lists.

**App state**: `App.tsx` loads the full map from `mapService` on mount and passes it down as props.

## Conventions

- Components: PascalCase filenames, functional components + hooks
- Services/utils: camelCase filenames
- Commit messages: Korean allowed, conventional commits format
- Semantic Scholar API rate limit: 100 req / 5 min without auth key
