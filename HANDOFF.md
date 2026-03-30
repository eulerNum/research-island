# Handoff — Research Island Map

2026-03-31 기준 현황. 다음 에이전트는 이 파일만 읽고 이어갈 수 있음.

---

## 프로젝트 요약

식품과학 연구를 **섬-다리-도시-도로** 메타포로 시각화하는 인터랙티브 웹앱.
Vercel 배포 + GitHub API 데이터 저장으로 어디서든 접근 가능한 클라우드형 도구.

---

## 완료된 작업

### 1. 프로젝트 초기화
- React 19 + TypeScript (strict) + Vite 8 프로젝트 생성 완료
- D3.js v7, react-router-dom v7 설치 완료
- `package.json` name → `"research-island-map"` 수정 완료
- `index.html` title → `"Research Island Map"` 수정 완료
- `npm run build`, `npm run lint`, `npx tsc --noEmit` 모두 통과
- Vite 보일러플레이트 정리 (데모 에셋 제거, App/CSS 재작성)

### 2. 핵심 타입 정의 (`src/services/types.ts`)
- `Paper`, `ResearchGap`, `Island`, `City`, `Bridge`, `Road`, `ResearchMap` 타입 정의
- `Paper.source`: `'semantic_scholar' | 'manual' | 'n8n_import'`
- 방향: `'forward' | 'backward'`만 허용 (양방향 없음)

### 3. 서비스 레이어
- `src/services/mapService.ts` — localStorage 기반 **완전한** CRUD + **인메모리 캐시**
  - Island: get, add, update, delete (cascade: 관련 bridge + 내부 city의 road 삭제)
  - City: get, add, update, delete (cascade: 관련 road 삭제)
  - Bridge: get, add, update, delete
  - Road: get, add, update, delete
  - Paper: get, add, delete (cascade: 모든 bridge/road/city의 paperIds에서 제거)
  - Gap: get, add, delete (cascade: 모든 bridge/road의 gapIds에서 제거)
  - Map: getFullMap (`structuredClone` 반환), importMap, saveFullMap
  - **Position-only 업데이트**: `updateIslandPosition`, `updateCityPosition` — React state refresh 없이 localStorage 직접 저장 (D3가 이미 시각적 이동 처리)
- `src/services/githubService.ts` — GitHub Contents API 기반 Save/Load
  - `saveToGitHub(config, map)` — PUT `/repos/:owner/:repo/contents/data/research-map.json`
  - `loadFromGitHub(config)` — GET + base64 디코드
  - `getGitHubConfig()` / `setGitHubConfig()` — localStorage 기반 PAT/owner/repo 저장
- `src/services/semanticScholarService.ts` — Semantic Scholar API 래퍼 (Phase 2용, 현재 미사용)
- `src/utils/idGenerator.ts` — `crypto.randomUUID()` 기반 ID 생성

### 4. 커스텀 훅
- `src/hooks/useMapData.ts` — ResearchMap 전체 상태 관리 + 모든 CRUD 메서드 + GitHub save/load
  - 패턴: mapService 호출 → `setMapData(mapService.getFullMap())` 으로 React state refresh
  - `saveIslandPosition`, `saveCityPosition` — refresh 없는 position 저장
  - 반환값 `useMemo`로 래핑하여 불필요한 Context consumer re-render 방지
  - `MapDataActions` 타입 export
- `src/hooks/useToolbar.ts` — 툴바 모드 상태 (`ToolbarMode` 타입 + connectionStart)

### 5. 라우팅 + 페이지 구조
- `src/contexts/MapDataContext.ts` — useMapData 결과를 Context로 배포
- `src/App.tsx` — BrowserRouter + Routes (`/`, `/island/:id`) + MapDataContext.Provider
- `src/pages/OverviewPage.tsx` — 섬 조망도 (Toolbar + Sidebar + IslandMap + DetailPanel)
  - add-island: 캔버스 클릭 → PromptDialog → 섬 생성 (색상 자동 순환)
  - bridge-connect: 2-click 연결 (시작 섬 → 끝 섬 → **이름 입력 PromptDialog** → forward 다리 생성)
  - select: 섬 클릭 → `/island/:id` 이동, 다리 클릭 → DetailPanel 표시
- `src/pages/IslandDetailPage.tsx` — 섬 내부 뷰 (Toolbar + CityMap + DetailPanel)
  - add-city: 캔버스 클릭 → PromptDialog → 도시 생성
  - road-connect: 2-click 연결 → **이름 입력 PromptDialog** → forward 도로 생성
  - 뒤로가기 버튼, 섬 이름 표시 배지
  - 존재하지 않는 island id → `/` 리다이렉트

### 6. UI 컴포넌트
- `src/components/Toolbar.tsx` — 상단 모드 전환 바 (가용 모드만 표시, 연결 모드 상태 텍스트, ESC 버튼)
- `src/components/IslandMap.tsx` — D3 SVG 섬 조망도
  - Force-directed 레이아웃 (position 없을 때만, 있으면 정적 렌더)
  - 드래그로 섬 위치 조정 + position 저장 (React re-render 없음)
  - 모드별 클릭 핸들러 (select/add-island/bridge-connect)
  - **양방향 다리 곡선 분리**: 같은 섬 쌍 사이 병렬 다리는 Quadratic Bezier 곡선으로 오프셋 (50px 간격)
    - perpendicular 방향을 정렬된 ID 쌍 기준으로 계산하여 A→B / B→A 곡선이 확실히 분리됨
  - **점선 흐름 애니메이션**: CSS `@keyframes`로 `stroke-dashoffset` 애니메이션 — forward는 source→target 방향, backward는 반대 방향으로 흐름
  - **넓은 히트 영역**: 투명 16px 너비 path로 클릭 용이
  - 줌/패닝
- `src/components/CityMap.tsx` — D3 SVG 섬 내부 도시 뷰
  - 그리드 기반 초기 배치 (4열)
  - 도로도 다리와 동일한 곡선 분리 + 흐름 애니메이션 + 넓은 히트 영역 적용
  - 드래그/클릭 동작 IslandMap과 동일 패턴
- `src/components/DetailPanel.tsx` — 우측 상세 패널 (다리/도로 클릭 시)
  - 방향 표시 + 라벨
  - GapMemo 섹션 + Paper 리스트 (**crossRefMap `useMemo`로 최적화**) + PaperForm
- `src/components/PaperForm.tsx` — 논문 수동 추가 (제목, 저자, 연도, 설명, DOI)
- `src/components/GapMemo.tsx` — 포스트잇 스타일 연구 갭 메모 (추가/삭제)
- `src/components/PromptDialog.tsx` — 범용 이름/라벨 입력 모달
- `src/components/GitHubSettings.tsx` — GitHub PAT/owner/repo 설정 모달
- `src/components/Sidebar.tsx` — 좌측 사이드바
  - 섬 목록 (색상 도트 + 클릭 → `/island/:id` 이동)
  - 논문/다리/갭 카운트
  - 하단: GitHub Save/Load/Settings 버튼 (로딩/성공/에러 상태 표시)

### 7. 배포 준비
- `vercel.json` — SPA rewrite 설정 (`/(.*) → /index.html`)

### 8. 문서
- `CLAUDE.md` — 빌드 커맨드, 아키텍처, 컨벤션 정리
- `RESEARCH-ISLAND-MAP-SPEC.md` — 원본 설계 명세
- `PLAN-SPEC.md` — 12개 인터뷰 질문 기반 상세 구현 계획서

### 9. 리팩토링 (성능 최적화)
- **mapService 인메모리 캐시**: `let cache` 변수로 매 작업마다 `JSON.parse` 반복 제거
- **Position-only 저장**: 드래그 종료 시 React state refresh 없이 localStorage만 업데이트
- **IslandMap getCursorStyle 제거**: useCallback 의존성 정리, 인라인 처리
- **useMapData 반환값 useMemo**: Context consumer 불필요 re-render 방지
- **DetailPanel crossRefMap useMemo**: 매 렌더마다 O(P×B+P×R) 재계산 → 의존성 변경 시에만

---

## 알려진 이슈 / 주의사항

1. **git 커밋 없음** — 파일은 스테이징 + 일부 untracked 상태. 첫 커밋 필요
2. **dev 서버 연결 문제** — `npm run dev` 실행 후 `localhost:5173` 연결 거부 발생한 적 있음. `127.0.0.1:5173`으로 시도하거나 터미널에서 직접 실행 필요
3. **bridge/road 생성 시 방향 선택 UI 없음** — 현재 항상 `'forward'`로 생성됨. 방향 선택 다이얼로그 추가 필요
4. **섬/도시 삭제 UI 없음** — mapService에는 구현되어 있으나 UI 버튼 미연결
5. **CLAUDE.md 업데이트 필요** — react-router-dom, 새 파일 구조 반영 안 됨

---

## 다음 단계

### 즉시 해야 할 것
- [ ] 첫 git 커밋 (모든 파일 스테이징 + 커밋)
- [ ] CLAUDE.md 업데이트 (새 기술 스택 + 파일 구조 반영)
- [ ] `npm run dev` 연결 문제 해결/확인

### 기능 보완 (MVP 완성도)
- [ ] Bridge/Road 생성 시 방향(forward/backward) 선택 다이얼로그
- [ ] 섬/도시/다리/도로 삭제 UI (우클릭 메뉴 또는 DetailPanel에서)
- [ ] 섬/도시 이름 편집 UI
- [ ] Paper 삭제 UI (DetailPanel에서)

### Phase 2 (PLAN-SPEC.md 참고, 우선순위: C→B→A→D)
- [ ] **2-C: Highlight + Cross-reference** — 논문 선택 시 관련 다리/도로 glow, 크로스레퍼런스 클릭 → 해당 DetailPanel 이동
- [ ] **2-B: Sheets + Image** — Google Sheets 논문 리스트 연동, 논문별 figure 이미지 저장/표시
- [ ] **2-A: AI Suggest** — Claude/Semantic Scholar로 논문 추천 + 자동 분류
- [ ] **2-D: UX** — 다크모드, undo/redo, 사이드바 트리 네비게이션

### Vercel 배포
- [ ] GitHub에 push
- [ ] Vercel에 repo 연결 + 첫 배포

---

## 파일 구조 현황

```
research-island-map/
├── CLAUDE.md                    (업데이트 필요)
├── PLAN-SPEC.md                 상세 구현 계획서
├── RESEARCH-ISLAND-MAP-SPEC.md  원본 설계서
├── HANDOFF.md                   이 파일
├── package.json
├── package-lock.json
├── index.html
├── vite.config.ts
├── vercel.json                  SPA rewrite
├── tsconfig*.json
├── eslint.config.js
├── src/
│   ├── main.tsx
│   ├── App.tsx                  Router + Context Provider
│   ├── App.css
│   ├── index.css
│   ├── contexts/
│   │   └── MapDataContext.ts    useMapData Context
│   ├── hooks/
│   │   ├── useMapData.ts        전체 CRUD + GitHub sync + useMemo
│   │   └── useToolbar.ts        모드 상태 관리
│   ├── pages/
│   │   ├── OverviewPage.tsx     섬 조망도
│   │   └── IslandDetailPage.tsx 섬 내부 뷰
│   ├── components/
│   │   ├── Toolbar.tsx          상단 모드 전환
│   │   ├── IslandMap.tsx        D3 force + drag + 곡선 다리 + 흐름 애니메이션
│   │   ├── CityMap.tsx          D3 그리드 + drag + 곡선 도로 + 흐름 애니메이션
│   │   ├── Sidebar.tsx          목록 + GitHub 버튼
│   │   ├── DetailPanel.tsx      우측 상세 패널 + crossRef useMemo
│   │   ├── PaperForm.tsx        논문 추가 폼
│   │   ├── GapMemo.tsx          갭 메모 포스트잇
│   │   ├── PromptDialog.tsx     범용 입력 모달
│   │   └── GitHubSettings.tsx   GitHub 설정 모달
│   ├── services/
│   │   ├── types.ts             핵심 타입 (n8n_import 포함)
│   │   ├── mapService.ts        완전한 CRUD + 인메모리 캐시 + position-only 저장
│   │   ├── githubService.ts     GitHub Contents API
│   │   └── semanticScholarService.ts  (Phase 2)
│   ├── utils/
│   │   └── idGenerator.ts
│   └── data/
│       └── sampleMap.json       (빈 맵)
└── public/
    ├── favicon.svg
    └── icons.svg
```

---

## 핵심 아키텍처 결정 (다음 에이전트 참고)

1. **상태 관리**: `App.tsx` → `useMapData()` → `MapDataContext.Provider`로 전체 앱에 배포. 모든 mutation은 `mapService` 호출 후 `getFullMap()`으로 React state refresh. 반환값은 `useMemo`로 래핑
2. **D3 Force**: 저장된 position이 있으면 정적 렌더, 모든 position이 (0,0)이면 force simulation 실행
3. **콜백 ref 패턴**: IslandMap/CityMap에서 D3 이벤트 핸들러가 최신 props를 참조하도록 `useRef` + `useEffect`로 동기화 (React 19 lint 규칙 준수)
4. **2-click 연결**: bridge-connect/road-connect 모드에서 `connectionStart` state로 첫 번째 클릭 저장, 두 번째 클릭에서 이름 입력 다이얼로그 표시 후 생성
5. **병렬 엣지 분리**: 같은 노드 쌍 사이 복수 다리/도로를 Quadratic Bezier 곡선으로 오프셋. perpendicular 방향은 정렬된 ID 쌍 기준으로 계산하여 A→B / B→A가 반드시 다른 방향으로 휘어짐
6. **방향 표시**: 화살표 마커 대신 CSS `stroke-dashoffset` 애니메이션으로 점선이 방향을 따라 흐르는 효과. forward=source→target 흐름, backward=반대 방향 흐름
7. **인메모리 캐시**: mapService가 localStorage 파싱 결과를 캐시. `getFullMap()`은 `structuredClone`으로 안전한 복사본 반환. 드래그 position은 React state 갱신 없이 직접 저장

---

## 유저 특성 (다음 에이전트 참고)

- 한국어 소통 선호
- 식품과학(관능과학) 연구자, AI 활용하여 논문 탐색/정리
- 연구 분야: Samples, Flavors, Visual Elements, Images, Emotions (섬 구조)
- 다리 의미: input→output 실험 프로세스 (시료→향미, 시료→이미지 등)
- GitHub Desktop은 사용하지만 GitHub API는 처음 → 리드해달라고 요청함
- 확장성 중시: n8n, MCP, Claude API 연동 미래 계획 있음
- 수동 저장 선호 (자동 동기화 X)
- 즉시 사용 예정: 선행연구 조사 + 학회 발표에 활용
- Phase 2 우선순위: C(highlight/cross-ref) → B(sheets+image) → A(AI suggest) → D(UX)
