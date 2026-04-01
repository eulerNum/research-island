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

### 최근 주요 커밋
```
8dc4320 chore: Vercel 재배포 트리거
f5df691 fix: 논문 클릭=glow, 더블클릭=학습패널, 사이드바 기본 펼침
154146d feat: 논문 학습 패널 — 클릭 시 넓은 전용 학습 공간 제공
(이전 세션)
cf56042 fix: CORS 에러 해결 — Git Blob API 사용
d3c7898 feat: SHA 기반 충돌 감지
6f0d02e fix: GitHub 동기화 안정성 개선
3d10490 feat: 사이드바 논문 드래그&드롭
d8a6913 feat: 멀티맵 홈페이지 + PIN 잠금
```

> **주의**: `Update map` 커밋은 앱 auto-save가 생성하는 데이터 커밋으로, 코드 변경이 아님.

---

## 최근 세션 (2026-04-01) 작업 내역

### 1. 논문 학습 패널 (PaperStudyPanel) ✅ — NEW
사이드바에서 논문 더블클릭 시 맵 오른쪽에 넓은 전용 학습 공간이 열림.

- **파일**: `src/components/PaperStudyPanel.tsx` (신규 378줄)
- **레이아웃**: `flex: 1, minWidth: 400` — 맵을 `flex: 0.4`로 밀어내고 나머지 공간 차지
- **섹션 구성**: 기본 정보 → AI 요약 → Figure 갤러리 → 소속 다리/도로 → 마크다운 공부 노트
- **AI 요약**: Claude Haiku 4.5로 3~5문장 요약, `paper.aiSummary`에 캐싱 (재생성 가능)
- **Figure**: 120x120 썸네일, 파일 업로드 + Ctrl+V 붙여넣기, 클릭 시 라이트박스
- **공부 노트**: textarea + 마크다운 미리보기 토글, 1초 디바운스 자동 저장
- **크로스 레퍼런스**: 이 논문이 배치된 다리/도로 목록 (클릭 시 이동)

### 2. 사이드바 리디자인 ✅
- **기본 펼침** (`collapsed: false`, `pinned: true`): hover 자동 접힘/펼침 제거, 접기 버튼으로만 토글
- **논문 인터랙션 3분리**: 클릭=glow 하이라이트, 더블클릭=학습패널, 드래그=다리/도로 배치
- **💡 아이콘 제거**: 클릭만으로 glow 토글 (아이콘 불필요)
- **그룹핑**: 연도별/저널별 그룹핑 + 연도 분포 미니 바 차트
- **hover 툴팁**: 논문 hover 시 소속 다리/도로 목록 표시
- **Bridges 섹션 제거**: 맵에서 직접 확인
- **Settings(Sheets/Claude) → 홈페이지 이동**
- **Save/Load 최상단 배치**

### 3. 섬 조망도 인터랙션 강화 ✅
- **섬 hover**: D3 transition으로 투명도/선굵기 변화
- **섬 클릭**: 섬 확장 (ellipse 커지며 내부 도시 원형 배치), 재클릭 시 축소
- **섬 더블클릭**: 섬 내부 뷰로 이동 (`/map/:mapId/island/:id`)
- **클릭/더블클릭 구분**: 250ms setTimeout 타이머 패턴
- **dblclick zoom 비활성화**: `svg.on('dblclick.zoom', null)`

### 4. 갭 메모 포스트잇 애니메이션 ✅ — NEW
- **파일**: `src/components/GapPostitAnimation.tsx` (신규)
- 사이드바 갭 클릭 → 관련 다리 근처로 포스트잇이 날아가서 붙음
- 3단계: flying → stuck → returning
- 한 번에 하나만, 클릭으로 dismiss

### 5. AI 요약 서비스 추가 ✅
- **파일**: `src/services/aiService.ts` — `summarizePaper()` 함수 추가
- Claude Haiku 4.5, max 512 tokens
- `Paper.aiSummary?: string` 필드 추가 (`src/services/types.ts`)

### 6. DetailPanel standalone 모드 제거 ✅
- `paper?: Paper` prop 및 standalone 논문 렌더링 블록 (~100줄) 제거
- PaperStudyPanel로 완전 이전

### 7. 드래그&드롭 영역 확대 ✅
- IslandMap 다리: stroke-width 16→32
- CityMap 도로: stroke-width 14→28
- 드래그 중 `.dragging-paper` CSS 클래스로 시각 피드백

---

## 이전 세션 작업 (누적)

- 사이드바 → 다리/도로 논문 드래그&드롭 ✅
- GitHub 동기화 안정성 (5s auto-save, visibilitychange, base64, Blob API) ✅
- SHA 기반 충돌 감지 ✅
- CORS 문제 해결 ✅
- Phase 2-B: Figure GitHub 저장 ✅
- Phase 2-C: AI 논문 제안 ✅
- 다크모드 ✅
- 다리/도로 곡률 드래그 조정 ✅
- 멀티맵 홈페이지 ✅
- Undo/Redo, 컨텍스트 메뉴, 색상 팔레트 ✅

(상세 내역은 git log 참조)

---

## 알려진 이슈

### ⚠️ Vercel 배포 반영 문제 (미해결)
- 코드 push 후 Vercel에서 변경사항이 반영되지 않는 현상 발생
- 빈 커밋(`8dc4320`)으로 재배포 트리거 시도함
- **유저 확인 필요**: Ctrl+Shift+R 하드 리프레시 후 반영 여부
- 원인 추정: 앱 auto-save가 `data/maps/` 커밋을 계속 push → Vercel가 해당 커밋으로 빌드하면서 이전 코드 사용 가능성
- **확인 방법**: Vercel 대시보드에서 최신 빌드 로그 확인

### CORS / fetch 실패 교훈 (중요)
**절대 하지 말 것**:
- `cache: 'no-store'` → CORS 실패
- `If-None-Match` 헤더 → CORS preflight 실패
- `raw.githubusercontent.com` + `Authorization` → CORS 차단
- `btoa(unescape(encodeURIComponent(...)))` → 큰 JSON 깨짐

**올바른 방법**: URL `?t=timestamp`, `TextEncoder/TextDecoder`, Git Blob API

### auto-save 커밋이 git push를 방해
- 앱이 `data/maps/` 변경을 5초마다 auto-save로 GitHub에 push
- 개발자가 코드 push 시 remote가 이미 앞서 있어 reject됨
- **해결**: `git pull --rebase` 후 push (또는 `git stash && pull --rebase && stash pop && push`)

---

## 미구현 항목

### Phase 3-C: 다리 라벨 체계
- [ ] 다리 라벨 `방법명 (주체)` 가이드 UI
- [ ] What(섬) / How(라벨) / Who(괄호) 체계 적용

### Phase 3 기타
- [ ] 논문에 "관련 도시" 필드 추가 (`relatedCityIds`)
- [ ] n8n 워크플로우 본격 연동
- [ ] 읽기 전용 공유 모드 (우선순위 낮음)

### PLAN-MANAGE.md Phase B
- [ ] 기존 단일맵 데이터 마이그레이션 다이얼로그
- [ ] 맵 삭제 기능 (HomePage에서)
- [ ] 맵 이름/설명/PIN 수정 기능

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
12. **논문 학습 패널**: flex 레이아웃으로 맵 축소 + 패널 확장 (`main flex: 0.4`, panel `flex: 1`)
13. **클릭/더블클릭 구분**: 250ms setTimeout 타이머 (D3 환경에서 네이티브 dblclick과 click 분리)
14. **마크다운 렌더링**: regex 기반 간단 변환 (bold, italic, headers, lists — 외부 의존성 없음)

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
- 식품과학(관능과학) 연구자 — 연구 분야: Samples, Flavors, Visual Elements, Images, Emotions
- 접속 기기: 연구실 PC, 집 PC, 발표용 노트북, 개인 노트북 (4대)
- 맵 개수: 2~3개 예상
- GitHub Desktop 사용하지만 GitHub API는 처음
- 불필요한 UI 싫어함 — UI가 "정신 사나운" 것을 극히 싫어함
- 공유: PNG/PDF 내보내기 선호
- Figure 이미지 적극 사용 예정
- 논문을 단순히 정리가 아닌 **학습 공간**으로 활용하고 싶어함

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
│   │   ├── HomePage.tsx         멀티맵 홈 + Settings(GitHub/Sheets/Claude)
│   │   ├── MapWrapper.tsx       mapId별 MapDataContext 제공
│   │   ├── OverviewPage.tsx     섬 조망도 + PaperStudyPanel 레이아웃
│   │   └── IslandDetailPage.tsx 섬 내부 뷰
│   ├── components/
│   │   ├── IslandMap.tsx        D3 섬 + 다리 + 섬 확장 + paper drop target
│   │   ├── CityMap.tsx          D3 도시 + 도로 + paper drop target
│   │   ├── Sidebar.tsx          트리 네비 + 논문 그룹핑 + draggable + hover 툴팁
│   │   ├── DetailPanel.tsx      우측 패널 (다리/도로 전용, standalone 제거됨)
│   │   ├── PaperStudyPanel.tsx  논문 전용 학습 공간 (AI요약/Figure/노트)
│   │   ├── GapPostitAnimation.tsx 갭 메모 포스트잇 날아가기 애니메이션
│   │   └── ...                  (ContextMenu, PaperForm, FigureLightbox, Dialogs, Settings 등)
│   ├── hooks/
│   │   ├── useMapData.ts        CRUD + GitHub sync + 충돌 감지 + visibilitychange
│   │   ├── useToolbar.ts
│   │   └── useTheme.ts
│   ├── services/
│   │   ├── types.ts             핵심 타입 (Paper에 aiSummary 추가됨)
│   │   ├── githubService.ts     Contents API + Blob API + SHA 추적 + ConflictError
│   │   ├── mapService.ts        localStorage CRUD + Undo/Redo
│   │   ├── mapIndexService.ts   maps-index.json CRUD
│   │   ├── aiService.ts         Claude API (suggestPapers + summarizePaper)
│   │   └── ...                  (sheets, figure, semanticScholar)
│   └── utils/
└── data/                        GitHub API로 관리
    ├── maps-index.json
    └── maps/{mapId}.json
```
