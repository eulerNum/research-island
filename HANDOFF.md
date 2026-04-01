# Handoff — Research Island Map

2026-04-01 기준 현황. 다음 에이전트는 이 파일만 읽고 이어갈 수 있음.

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
cf56042 fix: CORS 에러 해결 — raw.githubusercontent.com 대신 Git Blob API 사용
cf9d375 fix: GitHub fetch 네트워크 에러 처리 + cache: no-store를 If-None-Match로 교체
d3c7898 feat: SHA 기반 충돌 감지 — 다른 기기 동시 작업 시 데이터 덮어쓰기 방지
6f0d02e fix: GitHub 동기화 안정성 개선 — base64 인코딩 수정 + 대용량 파일 지원 + auto-save 강화
3d10490 feat: 사이드바 논문을 다리/도로에 드래그&드롭으로 추가하는 기능
699382c docs: HANDOFF.md 전체 업데이트
5ff63db fix: 에러 시 GitHub 설정 변경 버튼 표시
d8a6913 feat: 멀티맵 홈페이지 + PIN 잠금 + 자동 저장/로드
693d396 feat: Phase 2-B/2-C 완료 + 다크모드 + 곡률 조정 + UX 개선
```

---

## 이번 세션 (2026-04-01) 작업 내역

### 사이드바 → 다리/도로 논문 드래그&드롭 ✅
- Sidebar 논문 항목에 `draggable` + `onDragStart` (paperId 전달)
- IslandMap 다리, CityMap 도로에 native DOM `dragover`/`drop` 이벤트
- 드래그 오버 시 glow 하이라이트 피드백
- 드롭 시 `addPaperToBridge` / `addPaperToRoad` 자동 호출

### GitHub 동기화 안정성 대폭 개선 ✅
- **auto-save 디바운스**: 30초 → 5초
- **visibilitychange**: 탭 숨김 → 즉시 저장, 탭 복귀 → GitHub에서 최신 로드
- **base64 인코딩**: `btoa/atob` → `TextEncoder/TextDecoder` 기반 (`utf8ToBase64`/`base64ToUtf8`)
- **1MB 초과 파일**: `raw.githubusercontent.com` (CORS 차단) → Git Blob API로 교체
- **캐시 우회**: `cache: 'no-store'` (fetch 실패 유발) → URL `?t=timestamp`
- **네트워크 에러**: `fetch()` try/catch 감싸서 한국어 에러 메시지

### SHA 기반 충돌 감지 (1단계) ✅
- `knownShaMap`: load/save 시 파일별 SHA 추적
- 저장 시 원격 SHA와 비교 → 다르면 `ConflictError`
- **수동 Save**: confirm 다이얼로그 (덮어쓰기 / 취소)
- **auto-save**: 사이드바에 경고 배너 + "Load로 최신 데이터 가져오기" 버튼
- last-write-wins 방지 (양쪽 PC 동시 작업 시 데이터 유실 차단)

---

## 이전 세션 작업 (누적)

### Phase 2-B: Figure GitHub 저장 ✅
### Phase 2-C: AI 논문 제안 ✅
### 다크모드 (Phase 3) ✅
### 다리/도로 곡률 드래그 조정 ✅
### 멀티맵 홈페이지 ✅
### Undo/Redo, 컨텍스트 메뉴, 색상 팔레트, 라벨, 사이드바 등 ✅

(상세 내역은 git log 참조)

---

## 알려진 이슈 / 실패한 시도

### CORS / fetch 실패 교훈 (중요)
이번 세션에서 여러 번 fetch 에러를 겪고 수정함. **절대 하지 말 것**:
- `cache: 'no-store'` → 일부 브라우저에서 cross-origin CORS 실패
- `If-None-Match: ''` 헤더 → CORS preflight 트리거로 실패
- `raw.githubusercontent.com` + `Authorization` 헤더 → preflight 미지원 CORS 차단
- `btoa(unescape(encodeURIComponent(...)))` → 큰 JSON에서 깨짐

**올바른 방법**: URL `?t=timestamp`, `TextEncoder/TextDecoder`, Git Blob API

### Save/Load 버튼 중복
- 사이드바에 수동 Save/Load 버튼 여전히 존재 (auto-save와 중복)
- 정리 or "수동 저장" 의미로 유지할지 결정 필요

---

## 미구현 항목

### PLAN-MANAGE.md Phase B
- [ ] 기존 단일맵 데이터 마이그레이션 다이얼로그
- [ ] 맵 삭제 기능 (HomePage에서)
- [ ] 맵 이름/설명/PIN 수정 기능

### 기타
- [ ] 읽기 전용 공유 모드 (우선순위 낮음)
- [ ] n8n 워크플로우 본격 연동
- [ ] Sidebar Save/Load 버튼 정리

---

## 핵심 아키텍처 결정

1. **멀티맵 라우팅**: `/` → HomePage, `/map/:mapId/*` → MapWrapper → OverviewPage/IslandDetailPage
2. **mapId별 데이터 격리**: localStorage 키 `research-map-{mapId}` + GitHub `data/maps/{mapId}.json`
3. **GitHub sync**: 5초 auto-save + visibilitychange 즉시 저장/로드 + SHA 충돌 감지
4. **캐시 우회**: URL `?t=Date.now()` (NOT `cache: 'no-store'`, NOT `If-None-Match`)
5. **대용량 파일**: Git Blob API (NOT `raw.githubusercontent.com`)
6. **Base64**: `TextEncoder/TextDecoder` 기반 (NOT `btoa/atob + escape/unescape`)
7. **PIN 인증**: SHA-256 해시, sessionStorage로 세션 내 재입력 방지
8. **D3 콜백 ref 패턴**: `useRef` + `useEffect`로 최신 props 동기화
9. **Position-only 저장**: D3 드래그 종료 시 React 리렌더 없이 localStorage만 업데이트
10. **Undo/Redo**: `pushUndo()`를 mutation 전에 호출
11. **다크모드**: CSS 변수 `[data-theme="dark"]` + `useTheme` 훅

---

## 디버깅 워크플로우

유저에게 에러 발생 시 아래 순서로 지시:

1. **F12** → Console 탭 열기
2. 빨간색 에러 메시지 **전문** 복사 (요약 X, 전문 O)
3. Network 탭에서 실패한 요청의 **Status**, **URL**, **Response** 확인
4. 위 정보를 그대로 전달

> "failed to fetch"만으로는 원인 파악 불가. CORS policy, status code, URL 등 상세 정보가 핵심.

---

## 유저 특성

- 한국어 소통 선호
- 식품과학(관능과학) 연구자
- 접속 기기: 연구실 PC, 집 PC, 발표용 노트북, 개인 노트북 (4대)
- 맵 개수: 2~3개 예상
- GitHub Desktop 사용하지만 GitHub API는 처음
- 불필요한 UI 싫어함
- 공유: PNG/PDF 내보내기 선호
- Figure 이미지 적극 사용 예정

---

## 파일 구조

```
research-island-map/
├── CLAUDE.md                    빌드/아키텍처/컨벤션/디버깅 가이드
├── PLAN-SPEC.md                 상세 구현 계획서
├── PLAN-MANAGE.md               멀티맵 관리 시스템 설계서
├── HANDOFF.md                   이 파일
├── src/
│   ├── App.tsx                  BrowserRouter + ThemeContext
│   ├── pages/
│   │   ├── HomePage.tsx         멀티맵 홈
│   │   ├── MapWrapper.tsx       mapId별 MapDataContext 제공
│   │   ├── OverviewPage.tsx     섬 조망도
│   │   └── IslandDetailPage.tsx 섬 내부 뷰
│   ├── components/
│   │   ├── IslandMap.tsx        D3 섬 + 다리 + paper drop target
│   │   ├── CityMap.tsx          D3 도시 + 도로 + paper drop target
│   │   ├── Sidebar.tsx          트리 네비 + draggable papers + sync 경고 배너
│   │   ├── DetailPanel.tsx      우측 패널
│   │   └── ...                  (ContextMenu, PaperForm, Dialogs, Settings 등)
│   ├── hooks/
│   │   ├── useMapData.ts        CRUD + GitHub sync + 충돌 감지 + visibilitychange
│   │   ├── useToolbar.ts
│   │   └── useTheme.ts
│   ├── services/
│   │   ├── githubService.ts     Contents API + Blob API + SHA 추적 + ConflictError
│   │   ├── mapService.ts        localStorage CRUD + Undo/Redo
│   │   ├── mapIndexService.ts   maps-index.json CRUD
│   │   └── ...                  (sheets, figure, ai, semanticScholar)
│   └── utils/
└── data/                        GitHub API로 관리
    ├── maps-index.json
    └── maps/{mapId}.json
```
