# Handoff — Research Island Map

2026-03-31 기준 현황. 다음 에이전트는 이 파일만 읽고 이어갈 수 있음.

---

## 프로젝트 요약

식품과학 연구를 **섬-다리-도시-도로** 메타포로 시각화하는 인터랙티브 웹앱.
Vercel 배포 + GitHub API 데이터 저장으로 어디서든 접근 가능한 클라우드형 도구.

---

## Git 현황

- **브랜치**: `main` (7 커밋 + 미커밋 변경)
- **미커밋 변경**: Sidebar 검색/Bridge·Gap 목록/JSON export·import, 맵 논문 수 배지, Fit-to-View, 키보드 단축키, AI 논문 제안 (Claude API), Semantic Scholar 검색, Figure GitHub 업로드 연동
- **GitHub remote**: 미설정 — 유저가 repo 생성 후 push 필요
- `npm run build` + `npx tsc --noEmit` 통과 상태

### 커밋 히스토리
```
df5a006 feat: 색상 변경 팔레트 UI
0a59e9f feat: 다리/도로 커스텀 색상 변경 UI
e029345 feat: Undo/Redo + 섬 색상 변경
63874c0 feat: 라벨 렌더링, 논문 편집, 사이드바 하이라이트
f1f00c0 refactor: 방향 선택 라디오 버튼 제거
cbecc12 feat: MVP UX 보완 — 우클릭 메뉴, 논문 삭제
a0d32e7 feat: Research Island Map MVP 초기 커밋
```

---

## 완료된 기능 (전체)

### Core MVP
- React 19 + TypeScript (strict) + Vite 8 + D3.js v7 + React Router v7
- 2-레벨 라우팅: `/` (섬 조망도), `/island/:id` (섬 내부 도시 뷰)
- 섬/도시/다리/도로 CRUD (생성·편집·삭제·색상·방향전환)
- 논문 수동 추가/편집/삭제 + 연구 갭 포스트잇 메모
- GitHub API 저장/불러오기 (PAT 인증)
- Google Sheets Push/Pull (n8n 웹훅 경유)
- localStorage 임시 저장 + 인메모리 캐시
- Vercel 배포 설정 (`vercel.json` SPA rewrite)

### D3 시각화
- **IslandMap**: Force-directed 자동 배치 + 드래그 수동 미세 조정
- **CityMap**: 그리드 기반 배치 + 드래그
- 병렬 다리/도로 Quadratic Bezier 곡선 분리 (perpendicular offset)
- CSS `stroke-dashoffset` 애니메이션으로 방향 흐름 표시
- 넓은 투명 히트 영역 (16px) + 줌/패닝
- 논문 하이라이트 glow 필터 (선택 시 관련 다리/도로 발광)
- 다리/도로 라벨 SVG 텍스트 (곡선 중앙점 계산)
- **논문 수 배지** — 섬 노드에 `N cities · N papers`, 다리/도로에 원형 배지

### UX 기능
- **우클릭 컨텍스트 메뉴**: 이름 변경, 색상 팔레트(10색), 방향 전환, 삭제 (cascade 경고)
- **Undo/Redo**: mapService 스냅샷 스택 (max 50) + Ctrl+Z / Ctrl+Y 단축키
- **키보드 단축키**: ESC→Select 모드, 숫자키 1~N→모드 전환 (input 입력 중 비활성)
- **Fit-to-View 버튼**: BBox 기반 전체 맵 뷰포트 맞춤 (500ms 애니메이션)
- **사이드바**: 섬 트리 네비게이션, 논문 검색 필터, Bridge 목록(클릭 네비게이션), Gap 목록
- **JSON Export/Import**: 로컬 백업용 다운로드/업로드
- **SVG/PNG Export**: Toolbar → Export 드롭다운
- 논문 편집 (PaperForm `initialPaper` 모드)
- 논문 연결 해제(✕) vs 전체 삭제(🗑) 분리
- 논문 하이라이트 고정 (⭐ 핀)
- Figure 이미지 첨부 (파일 선택 + Ctrl+V 붙여넣기, base64 저장)
- Figure 라이트박스 (좌우 네비게이션)
- 크로스 레퍼런스: 논문이 포함된 다른 Bridge/Road 표시 + 클릭 네비게이션

### AI 논문 제안 (Phase 2-C)
- **Claude API 연동**: `aiService.ts` — Haiku 4.5 모델, 다리/도로 컨텍스트 기반 논문 제안
- **AI 논문 제안 버튼**: DetailPanel에서 "AI 논문 제안" 클릭 → 5개 논문 후보 표시
- 기존 논문 목록 + 갭 메모를 프롬프트에 포함하여 중복 제거
- 제안된 논문 "추가" / "무시" 개별 선택
- **Semantic Scholar 검색**: PaperForm에서 제목 입력 후 "S2 검색" → 자동 필드 채우기
- **Claude API 설정**: Sidebar 하단 "API Settings" + DetailPanel 에러 시 설정 유도
- `ClaudeSettings.tsx` — API Key 입력 모달 (localStorage 저장)

### Figure GitHub 저장 (Phase 2-B)
- GitHub 설정 시 Figure 이미지를 `data/figures/`에 자동 업로드 (GitHub Contents API)
- GitHub 미설정 시 기존 base64 data URL 폴백
- DetailPanel 붙여넣기/파일선택 모두 GitHub 업로드 지원

### 방향 규칙
- **forward** (→, 초록 `#2a9d8f`): input → output
- **backward** (←, 주황 `#e76f51`): output → input
- 양방향 없음. 생성 시 클릭 순서가 방향 결정 (첫 클릭=source, 둘째=target → forward)
- 방향 전환은 우클릭 컨텍스트 메뉴에서

---

## 미구현 항목 (PLAN-SPEC.md 기준)

### Phase 3 (전체)
- [ ] 읽기 전용 공유 모드 (URL 공유 → 인터랙티브 뷰잉)
- [ ] 시스템 공유 (다른 연구자 독립 맵 운영)
- [ ] 협업 편집
- [ ] n8n 워크플로우 본격 연동
- [ ] 다크모드

### 인프라
- [ ] GitHub remote 설정 + push
- [ ] Vercel 연결 + 첫 배포

---

## 파일 구조

```
research-island-map/
├── CLAUDE.md                    빌드/아키텍처/컨벤션 가이드
├── PLAN-SPEC.md                 상세 구현 계획서 (인터뷰 기반)
├── RESEARCH-ISLAND-MAP-SPEC.md  원본 설계서
├── HANDOFF.md                   이 파일
├── package.json
├── vercel.json                  SPA rewrite
├── vite.config.ts / tsconfig*.json / eslint.config.js
├── src/
│   ├── main.tsx
│   ├── App.tsx                  BrowserRouter + MapDataContext.Provider
│   ├── App.css / index.css
│   ├── contexts/
│   │   └── MapDataContext.ts    useMapData 결과를 Context로 배포
│   ├── hooks/
│   │   ├── useMapData.ts        전체 CRUD + GitHub sync + Undo/Redo + useMemo
│   │   └── useToolbar.ts        모드 상태 (ToolbarMode + connectionStart)
│   ├── pages/
│   │   ├── OverviewPage.tsx     섬 조망도 (Toolbar+Sidebar+IslandMap+DetailPanel+ContextMenu)
│   │   └── IslandDetailPage.tsx 섬 내부 뷰 (Toolbar+CityMap+DetailPanel+ContextMenu)
│   ├── components/
│   │   ├── IslandMap.tsx        D3 force + drag + Bezier bridges + glow + badges
│   │   ├── CityMap.tsx          D3 grid + drag + Bezier roads + glow + badges
│   │   ├── Sidebar.tsx          트리 네비게이션 + 검색 + Bridge/Gap 목록 + JSON backup + GitHub/Sheets sync
│   │   ├── DetailPanel.tsx      우측 패널 (논문+갭+크로스레퍼런스+Figure)
│   │   ├── Toolbar.tsx          모드 전환 + Fit-to-View + Export + 키보드 단축키
│   │   ├── ContextMenu.tsx      우클릭 메뉴 (button + palette 아이템 타입)
│   │   ├── PaperForm.tsx        논문 추가/편집 폼
│   │   ├── GapMemo.tsx          갭 메모 포스트잇
│   │   ├── PromptDialog.tsx     범용 입력 모달
│   │   ├── FigureLightbox.tsx   Figure 이미지 라이트박스
│   │   ├── GitHubSettings.tsx   GitHub PAT/owner/repo 설정 모달
│   │   ├── SheetsSettings.tsx   Google Sheets 웹훅 URL 설정 모달
│   │   └── ClaudeSettings.tsx   Claude API Key 설정 모달
│   ├── services/
│   │   ├── types.ts             Paper, ResearchGap, Island, City, Bridge, Road, ResearchMap
│   │   ├── mapService.ts        localStorage CRUD + 인메모리 캐시 + Undo/Redo 스택
│   │   ├── githubService.ts     GitHub Contents API Save/Load
│   │   ├── sheetsService.ts     Google Sheets Push/Pull (n8n 경유)
│   │   ├── figureService.ts     Figure GitHub 업로드 (DetailPanel 연동 완료)
│   │   ├── aiService.ts         Claude API 논문 제안 (Haiku 4.5)
│   │   └── semanticScholarService.ts  Semantic Scholar 논문 검색 (PaperForm 연동 완료)
│   └── utils/
│       ├── idGenerator.ts       crypto.randomUUID()
│       └── exportMap.ts         SVG/PNG 내보내기
└── public/
    ├── favicon.svg
    └── icons.svg
```

---

## 핵심 아키텍처 결정

1. **상태 관리**: `App.tsx` → `useMapData()` → `MapDataContext.Provider`. 모든 mutation은 `mapService` 호출 후 `getFullMap()`으로 React state refresh. 반환값 `useMemo` 래핑
2. **D3 콜백 ref 패턴**: IslandMap/CityMap에서 `useRef` + `useEffect`로 최신 props 동기화 (React 19 strict mode 호환)
3. **Position-only 저장**: 드래그 종료 시 React state refresh 없이 localStorage만 업데이트 (D3가 시각적 이동 처리)
4. **인메모리 캐시**: mapService `let cache` 변수. `getFullMap()`은 `structuredClone`으로 안전한 복사본 반환
5. **Undo/Redo**: `undoStack`/`redoStack`에 JSON 스냅샷 저장 (max 50). Position-only/importMap은 스택 오염 방지를 위해 plain `saveMap` 사용
6. **병렬 엣지 분리**: Quadratic Bezier + perpendicular offset (정렬된 ID 쌍 기준으로 A→B / B→A가 다른 방향으로 휘어짐)
7. **ContextMenu**: `ContextMenuButtonItem` (클릭 동작) + `ContextMenuPaletteItem` (인라인 색상 원형 그리드) 두 가지 아이템 타입
8. **AI 논문 제안**: `anthropic-dangerous-direct-browser-access` 헤더로 브라우저에서 직접 Claude API 호출. Haiku 4.5 모델 사용
9. **Figure GitHub 업로드**: GitHub 설정 시 figureService로 `data/figures/`에 업로드, 미설정 시 base64 폴백

---

## 유저 특성

- 한국어 소통 선호
- 식품과학(관능과학) 연구자
- 연구 분야: Samples, Flavors, Visual Elements, Images, Emotions
- 다리 의미: input→output 실험 프로세스
- GitHub Desktop 사용하지만 GitHub API는 처음
- 즉시 사용 예정: 선행연구 조사 + 학회 발표
- 불필요한 UI 싫어함 (예: 방향 선택 라디오 버튼 → 클릭 순서로 충분하다고 피드백)
- 색상 변경은 단순 버튼이 아닌 팔레트 UI 선호
