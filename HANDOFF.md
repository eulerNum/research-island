# Handoff — Research Island Map

2026-03-31 기준 현황. 다음 에이전트는 이 파일만 읽고 이어갈 수 있음.

---

## 프로젝트 요약

식품과학 연구를 **섬-다리-도시-도로** 메타포로 시각화하는 인터랙티브 웹앱.
Vercel 배포 + GitHub API 데이터 저장으로 어디서든 접근 가능한 클라우드형 도구.

---

## Git 현황

- **브랜치**: `main`
- **GitHub remote**: `https://github.com/eulerNum/research-island.git`
- **Vercel 배포**: 완료 (push 시 자동 재배포)
- `npm run build` + `npx tsc --noEmit` 통과 상태

### 최근 커밋 히스토리
```
5ff63db fix: 에러 시 GitHub 설정 변경 버튼 표시
d8a6913 feat: 멀티맵 홈페이지 + PIN 잠금 + 자동 저장/로드
693d396 feat: Phase 2-B/2-C 완료 + 다크모드 + 곡률 조정 + UX 개선
df5a006 feat: 색상 변경 팔레트 UI
0a59e9f feat: 다리/도로 커스텀 색상 변경 UI
e029345 feat: Undo/Redo + 섬 색상 변경
63874c0 feat: 라벨 렌더링, 논문 편집, 사이드바 하이라이트
f1f00c0 refactor: 방향 선택 라디오 버튼 제거
cbecc12 feat: MVP UX 보완 — 우클릭 메뉴, 논문 삭제
a0d32e7 feat: Research Island Map MVP 초기 커밋
```

---

## 이번 세션에서 시도한 것 / 성공한 것

### Phase 2-B: Figure GitHub 저장 ✅
- DetailPanel에서 이미지 첨부 시 GitHub `data/figures/`에 자동 업로드 (figureService 연동)
- GitHub 미설정 시 base64 data URL 폴백

### Phase 2-C: AI 논문 제안 ✅
- `aiService.ts` — Claude Haiku 4.5 API로 다리/도로 컨텍스트 기반 논문 5개 제안
- DetailPanel "AI 논문 제안" 버튼 + 추가/무시 UI
- `ClaudeSettings.tsx` — API Key 설정 모달
- PaperForm "S2 검색" — Semantic Scholar에서 제목 검색 → 필드 자동 채움

### 다크모드 (Phase 3) ✅
- CSS 변수 기반 테마 시스템 (`index.css`에 60+ 변수)
- `[data-theme="dark"]` 선택자, `useTheme` 훅, 시스템 설정 감지
- Toolbar에 해/달 토글 버튼
- **모든 컴포넌트** 인라인 스타일을 CSS 변수로 교체 (Toolbar, Sidebar, DetailPanel, IslandMap, CityMap, PaperForm, GapMemo, PromptDialog, ContextMenu, 모든 Settings 모달)

### 다리/도로 곡률 드래그 조정 ✅
- `controlPoint` 필드를 Bridge/Road 타입에 추가
- 곡선 중간점에 드래그 핸들 (Select 모드에서 hover 시 표시)
- 드래그 → Bezier 역계산 (`CP = 2M - 0.5(P0+P2)`) → localStorage 자동 저장
- IslandMap + CityMap 모두 지원

### 버그 수정 ✅
- **Undo 스냅샷 버그**: mutation 후에 스냅샷 → mutation 전으로 수정 (모든 mapService 함수)
- **배지 카운트 오류**: orphaned paperIds 자동 정리 (`getFullMap()`에서)
- **논문 삭제 사이드바 미반영**: 사이드바 논문 항목에 ✕ 삭제 버튼 추가 + removePaper 시 고아 논문 자동 정리

### UX 개선 ✅
- 다리/도로 라벨 명명법: 생성 시 "Source→Target:" 접두사 제거, 순수 이름만 저장
- DetailPanel 헤더: `Source→Target: label` 형식으로 맥락 표시
- Cross-reference("Also in"): `Source→Target: label` 형식으로 소스→타겟 맥락 포함
- PaperForm을 중앙 모달로 변경 (인라인 → 오버레이)

### 멀티맵 홈페이지 ✅
- **HomePage**: 맵 목록 카드 (이름 + 통계 + 날짜) + 새 맵 만들기
- **PinDialog**: 4자리 PIN 입력 (SHA-256 해시 검증, sessionStorage로 세션 내 재입력 방지)
- **NewMapDialog**: 이름 + 설명 + PIN 입력 + PIN 확인
- **mapIndexService**: GitHub `data/maps-index.json` CRUD
- **라우트 변경**: `/` → HomePage, `/map/:mapId` → OverviewPage, `/map/:mapId/island/:id` → IslandDetailPage
- **MapWrapper**: mapId별 MapDataContext 제공
- **mapService**: `activeMapId` 기반 localStorage 키 분리 (`research-map-{mapId}`)
- **githubService**: mapId별 파일 경로 (`data/maps/{mapId}.json`) + `deleteFromGitHub` 추가
- **자동 로드**: 맵 진입 시 GitHub에서 최신 데이터 자동 로드
- **자동 저장**: 30초 디바운스 GitHub auto-sync + 맵 나가기 시 즉시 저장
- **Sidebar**: 홈으로 돌아가기 버튼 + mapId 기반 네비게이션

### 인프라 ✅
- GitHub remote 설정 + push 완료
- Vercel 배포 완료

---

## 실패한 것 / 알려진 이슈

### PAT 401 에러 (미해결)
- 유저가 Vercel 배포 사이트에서 PAT 입력 시 `Failed to load maps index: 401` 에러 발생
- **원인 추정**: Fine-grained token 사용 또는 토큰 복사 오류
- **시도한 수정**: 에러 메시지 아래에 "GitHub 설정 변경" 버튼 추가하여 재입력 가능하게 함
- **다음 에이전트 조치**: 유저에게 Classic token (repo scope) 재발급 안내. 401이 계속되면 githubService에서 에러 응답 body를 로깅하여 상세 원인 파악

### Save/Load 버튼 중복
- 사이드바에 수동 Save/Load/Settings 버튼이 여전히 있음
- 자동 저장/로드가 구현되었으므로 이 버튼들을 정리하거나 "수동 저장" 의미로 유지할지 결정 필요

---

## 미구현 항목

### PLAN-MANAGE.md Phase B (자동 저장 보완)
- [ ] 기존 단일맵 데이터 마이그레이션 다이얼로그 (`mapService.hasLegacyData()` 이미 구현됨, UI 미연결)
- [ ] 맵 삭제 기능 (HomePage에서)
- [ ] 맵 이름/설명/PIN 수정 기능

### PLAN-SPEC.md Phase 3
- [ ] 읽기 전용 공유 모드 (URL 공유 → 인터랙티브 뷰잉) — 유저가 PNG/PDF 내보내기 선호하므로 우선순위 낮음
- [ ] n8n 워크플로우 본격 연동

### 기타
- [ ] CLAUDE.md 업데이트 (새 파일 구조, 멀티맵 아키텍처 반영)
- [ ] Sidebar Save/Load 버튼 정리 (자동 저장으로 대체 가능)

---

## 파일 구조

```
research-island-map/
├── CLAUDE.md                    빌드/아키텍처/컨벤션 가이드
├── PLAN-SPEC.md                 상세 구현 계획서 (인터뷰 기반)
├── PLAN-MANAGE.md               멀티맵 관리 시스템 설계서 (인터뷰 기반)
├── HANDOFF.md                   이 파일
├── package.json
├── vercel.json                  SPA rewrite
├── vite.config.ts / tsconfig*.json / eslint.config.js
├── .claude/commands/            커스텀 슬래시 명령 (deploy, check, sync)
├── .github/workflows/           GitHub Actions (Claude code review)
├── src/
│   ├── main.tsx
│   ├── App.tsx                  BrowserRouter + ThemeContext (MapDataContext는 MapWrapper로 이동)
│   ├── App.css / index.css      CSS 변수 기반 테마 (light/dark)
│   ├── contexts/
│   │   ├── MapDataContext.ts    useMapData 결과를 Context로 배포
│   │   └── ThemeContext.ts      다크모드 테마 Context
│   ├── hooks/
│   │   ├── useMapData.ts        전체 CRUD + GitHub auto-sync + Undo/Redo + mapId 지원
│   │   ├── useToolbar.ts        모드 상태 (ToolbarMode + connectionStart)
│   │   └── useTheme.ts          다크모드 토글 + localStorage + 시스템 설정 감지
│   ├── pages/
│   │   ├── HomePage.tsx         멀티맵 홈 (맵 목록 카드 + GitHub 설정 + 새 맵 생성)
│   │   ├── MapWrapper.tsx       mapId별 MapDataContext 제공 + 하위 라우트
│   │   ├── OverviewPage.tsx     섬 조망도 (Toolbar+Sidebar+IslandMap+DetailPanel+ContextMenu)
│   │   └── IslandDetailPage.tsx 섬 내부 뷰 (Toolbar+CityMap+DetailPanel+ContextMenu)
│   ├── components/
│   │   ├── IslandMap.tsx        D3 force + drag + Bezier + glow + badges + 곡률 드래그 핸들
│   │   ├── CityMap.tsx          D3 grid + drag + Bezier + glow + badges + 곡률 드래그 핸들
│   │   ├── Sidebar.tsx          트리 네비게이션 + 검색 + 목록 + 홈 버튼 + sync
│   │   ├── DetailPanel.tsx      우측 패널 (논문+갭+크로스레퍼런스+Figure+AI제안)
│   │   ├── Toolbar.tsx          모드 전환 + Fit-to-View + Export + 테마 토글 + 키보드 단축키
│   │   ├── ContextMenu.tsx      우클릭 메뉴 (button + palette)
│   │   ├── PaperForm.tsx        논문 추가/편집 폼 + S2 검색 (중앙 모달)
│   │   ├── GapMemo.tsx          갭 메모 포스트잇
│   │   ├── PromptDialog.tsx     범용 입력 모달
│   │   ├── PinDialog.tsx        PIN 4자리 입력 모달
│   │   ├── NewMapDialog.tsx     새 맵 생성 모달 (이름+설명+PIN)
│   │   ├── FigureLightbox.tsx   Figure 이미지 라이트박스
│   │   ├── GitHubSettings.tsx   GitHub PAT/owner/repo 설정 모달
│   │   ├── SheetsSettings.tsx   Google Sheets 웹훅 URL 설정 모달
│   │   └── ClaudeSettings.tsx   Claude API Key 설정 모달
│   ├── services/
│   │   ├── types.ts             Paper, ResearchGap, Island, City, Bridge(+controlPoint), Road(+controlPoint), ResearchMap
│   │   ├── mapService.ts        localStorage CRUD + 캐시 + Undo/Redo + activeMapId 분리
│   │   ├── mapIndexService.ts   GitHub data/maps-index.json CRUD + PIN 해시
│   │   ├── githubService.ts     GitHub Contents API (mapId별 경로 + delete 지원)
│   │   ├── sheetsService.ts     Google Sheets Push/Pull (n8n 경유)
│   │   ├── figureService.ts     Figure GitHub 업로드 (연동 완료)
│   │   ├── aiService.ts         Claude API 논문 제안 (Haiku 4.5)
│   │   └── semanticScholarService.ts  Semantic Scholar 논문 검색 (연동 완료)
│   └── utils/
│       ├── idGenerator.ts       crypto.randomUUID()
│       └── exportMap.ts         SVG/PNG 내보내기
├── data/                        GitHub API로 관리되는 데이터 (코드 레포에도 포함)
│   ├── maps-index.json          맵 목록 메타데이터
│   └── maps/
│       └── {mapId}.json         각 맵의 ResearchMap 데이터
└── public/
    ├── favicon.svg
    └── icons.svg
```

---

## 핵심 아키텍처 결정

1. **멀티맵 라우팅**: `/` → HomePage, `/map/:mapId/*` → MapWrapper(MapDataContext) → OverviewPage/IslandDetailPage
2. **mapId별 데이터 격리**: mapService의 `activeMapId`로 localStorage 키 분리 (`research-map-{mapId}`)
3. **자동 로드/저장**: 맵 진입 시 GitHub에서 자동 로드, 변경 후 30초 디바운스 자동 저장, 맵 나가기 시 즉시 저장
4. **PIN 인증**: SHA-256 해시로 저장, sessionStorage로 세션 내 재입력 방지
5. **상태 관리**: `MapWrapper.tsx` → `useMapData(mapId)` → `MapDataContext.Provider`
6. **D3 콜백 ref 패턴**: IslandMap/CityMap에서 `useRef` + `useEffect`로 최신 props 동기화
7. **Position-only 저장**: 드래그/곡률 조정 종료 시 React 리렌더 없이 localStorage만 업데이트
8. **곡률 조정**: 커스텀 controlPoint → Quadratic Bezier 역계산 (`CP = 2M - 0.5(P0+P2)`)
9. **Undo/Redo**: pushUndo()를 mutation 전에 호출 → 정확한 이전 상태 스냅샷
10. **다크모드**: CSS 변수 `[data-theme="dark"]` + `useTheme` 훅 (localStorage + prefers-color-scheme)
11. **AI 논문 제안**: `anthropic-dangerous-direct-browser-access` 헤더로 브라우저에서 직접 Claude API 호출

---

## GitHub 데이터 저장 구조

```
data/
├── maps-index.json          ← 맵 목록 메타데이터 (MapMeta[])
│   {
│     "maps": [
│       { "id": "...", "name": "...", "pinHash": "sha256...", "stats": {...}, ... }
│     ]
│   }
├── maps/
│   └── {mapId}.json         ← ResearchMap (islands, bridges, roads, papers, gaps)
└── figures/
    └── {paperId}_0.png      ← 논문 Figure 이미지
```

---

## 유저 특성

- 한국어 소통 선호
- 식품과학(관능과학) 연구자
- 연구 분야: Samples, Flavors, Visual Elements, Images, Emotions
- 다리 의미: input→output 실험 프로세스
- GitHub Desktop 사용하지만 GitHub API는 처음
- 즉시 사용 예정: 선행연구 조사 + 학회 발표
- 불필요한 UI 싫어함 (예: 방향 선택 라디오 버튼 → 클릭 순서로 충분)
- 색상 변경은 팔레트 UI 선호
- 접속 기기: 연구실 PC, 집 PC, 발표용 노트북, 개인 노트북 (4대)
- 맵 개수: 2~3개 예상
- 공유: PNG/PDF 내보내기 선호 (URL 공유 불필요)
- Figure 이미지 적극 사용 예정
