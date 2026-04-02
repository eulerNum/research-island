# Research Island Map — Plan Spec

인터뷰 기반 구현 계획서 (2026-03-31) / 최종 업데이트 (2026-04-01, 사이드바 인터뷰 반영)

---

## 1. 제품 개요

식품과학(sensory science) 연구를 **섬-다리-도시-도로** 메타포로 시각화하는 인터랙티브 웹앱.
연구자의 **연구 인생 전체**를 이 프레임 안에서 정리하는 것이 목표.
Vercel 배포 + GitHub API 데이터 저장으로 어디서든 브라우저로 접근 가능.

### 핵심 메타포
- **섬(Island)** = 연구 분야 (예: Samples, Flavors, Visual Elements, Images, Emotions)
- **다리(Bridge)** = 실험/분석 프로세스 (input 섬 → processing → output 섬)
- **도시(City)** = 세부 주제
- **도로(Road)** = 도시 간 실험/분석 관계
- **방향** = input → output (forward: 시작점이 input, 도착점이 output)

### 다리/도로의 의미
다리 위의 논문 = 해당 input→output 프로세스를 다룬 연구.
다리의 label = 실험 방법, 가설, 처리 로직 설명.
예: "Samples → Flavors" 다리 = "이 시료를 맛보고 이러한 향미 용어 및 강도가 산출되었다"

### 다리 라벨 명명 체계 (What / How / Who)
연구의 핵심 3요소를 다리 구조에 매핑:
- **What** (무엇을) = 양쪽 섬이 이미 표현 (input 섬 → output 섬)
- **How** (어떻게) = 다리 라벨 메인 — 실험/분석 방법명
- **Who** (누가/무엇이) = 다리 라벨 괄호 — 수행 주체/도구

라벨 형식: **`방법명 (주체)`**
```
[Samples] ──Descriptive Analysis (trained panel)──→ [Flavors]
  What ↗         How ↗              Who ↗              What ↗
```
예시:
- `Descriptive Analysis (trained panel)`
- `CATA (consumer panel)`
- `Image Classification (CNN)`
- `Napping (trained panel)`
- `Flash Profile (semi-trained)`

### 논문-도시 관련성 (Paper–City Relation)
다리는 섬↔섬 연결이지만, 논문은 특정 도시에 더 관련될 수 있음.
- 논문을 다리에 배치할 때 **"관련 도시"를 선택** 가능 (선택적 필드)
- 예: Flavor → Visual 다리의 논문이 특히 Visual 섬의 "Color" 도시와 관련
- DetailPanel에서 도시별 필터 가능
- 데이터 모델: `BridgePaper` 또는 `Paper`에 `relatedCityIds?: string[]` 추가

---

## 2. 뷰 구조 (2레벨) ✅

### 2-1. 홈페이지 — `/`
- 멀티맵 대시보드: 맵 카드 목록 + 새 맵 만들기
- GitHub PAT 설정, PIN 인증
- 상세: PLAN-MANAGE.md 참조

### 2-2. 섬 조망도 (Island Overview) — `/map/:mapId`
- 전체 섬(Island)과 다리(Bridge)만 표시
- 도시(City)는 기본 숨김, 섬 클릭 시 펼쳐서 표시
- **섬 인터랙션**:
  - hover → 섬 하이라이트
  - 클릭 → 해당 섬 중심으로 맵 포커스 이동 + 섬이 확장되며 내부 도시 노출 (재클릭 시 축소)
  - 더블클릭 → 섬 내부 뷰(`/map/:mapId/island/:id`)로 이동
- 다리 클릭 → 사이드 패널 확장 (논문/갭 정보)

### 2-3. 섬 내부 뷰 (Island Detail) — `/map/:mapId/island/:id`
- 해당 섬의 도시(City)들과 도로(Road)를 표시
- 도로 클릭 → 사이드 패널 확장
- 뒤로가기 → 조망도 복귀

---

## 3. 레이아웃 엔진 ✅

| 대상 | 방식 |
|------|------|
| 섬 배치 (조망도) | D3 force-directed 자동 배치 + 드래그로 수동 미세 조정, 위치 저장 |
| 도시 배치 (내부 뷰) | 그리드 기반 자동 정렬 + 드래그로 수동 미세 조정, 위치 저장 |
| 다리/도로 곡률 | Quadratic Bezier + 중간점 드래그 조정 (Select 모드에서 hover 시 핸들 표시) |

---

## 4. 요소 생성 UX ✅

### 상단 툴바 모드 전환
| 모드 | 동작 |
|------|------|
| 선택 모드 (기본) | 요소 클릭으로 정보 확인, 드래그로 위치 이동, 곡률 조정 |
| 섬 추가 모드 | 캔버스 클릭 위치에 새 섬 생성 |
| 다리 연결 모드 | 섬 A 클릭 → 섬 B 클릭 → 라벨 입력 → 방향은 클릭 순서로 결정 |
| 도시 추가 모드 | (섬 내부 뷰에서) 캔버스 클릭 위치에 새 도시 생성 |
| 도로 연결 모드 | 다리 연결과 동일 방식, 도시 간 연결 |

### 삭제/편집 — 우클릭 컨텍스트 메뉴 ✅
- 섬/도시/다리/도로 우클릭 → "이름 변경 / 삭제 / 색상 변경 / 방향 전환" 메뉴
- 색상 변경: 팔레트 UI (10색)
- 삭제 시 확인 다이얼로그 (cascade 삭제 경고 포함)
- **Undo/Redo** — Ctrl+Z / Ctrl+Y (mutation 전 스냅샷 방식)

---

## 5. 사이드 패널 (다리/도로 클릭 시) ✅

```
┌─────────────────────────────────┐
│ 연구 갭 메모                     │  ← 포스트잇 스타일
├─────────────────────────────────┤
│ 논문 리스트                      │
│   · 논문 제목 (2024)            │
│     저널명 | 간단 설명           │
│     내 메모: "왜 넣었는지"       │
│     DOI 링크 | [Figure 보기]    │
│     ↳ Also in: Bridge A → 클릭시 이동  ← 크로스 레퍼런스
├─────────────────────────────────┤
│ [+ 논문 추가] [+ 갭 메모 추가]   │
│ [AI 논문 제안]                   │
└─────────────────────────────────┘
```

### 논문 추가 방식 ✅
- **수동 입력**: 제목, 저자, 연도, 저널명, 간단 설명, 내 메모(코멘트), DOI 링크, Figure 이미지(선택)
- **Semantic Scholar 검색**: PaperForm에서 "S2 검색" → 제목 검색 → 필드 자동 채움
- **사이드바 드래그&드롭**: 사이드바 논문 목록에서 다리/도로 위에 드래그 → 자동 추가
- **AI 논문 제안**: Claude Haiku API로 컨텍스트 기반 5개 제안

### 논문 하이라이트 기능 ✅
- 논문 선택 시 → 해당 논문이 포함된 모든 다리/도로가 맵에서 glow 효과

### 연구 갭 메모 ✅
- 포스트잇 스타일로 간편하게 추가/삭제
- `source: 'manual'` — 갭 분석은 사람의 영역

---

## 5-B. 사이드바 (좌측 패널) 설계

인터뷰 기반 (2026-04-01)

### 레이아웃
- **접이식(collapsible)**: 기본 아이콘만 표시, hover/클릭 시 펼침 → 맵 공간 확보
- 펼침 시 현재와 유사한 260px 패널

### 섹션 구성 (위→아래 순서)

```
┌─────────────────────────────────┐
│ ← 홈  Research Island Map      │
├─────────────────────────────────┤
│ [Save] [Load]                   │  ← 최상단 고정 (가장 자주 쓰는 행동)
│ 동기화 상태 / 충돌 경고 배너     │
├─────────────────────────────────┤
│ 맵 요약: 섬 5 · 다리 8 · 논문 23│  ← 간단한 숫자 통계
├─────────────────────────────────┤
│ ▸ Islands (5)                   │  ← 트리 네비게이션
│   · Samples                     │     hover=하이라이트
│   · Flavors                     │     클릭=맵 포커스 이동
│   · Visual Elements             │     더블클릭=섬 내부 뷰 진입
│     (펼침 시 도시 표시 — 보류)   │
├─────────────────────────────────┤
│ Papers (23)          [연도▾][A▾]│  ← 그룹핑(연도별/저널별) + 필터
│ [검색...]                       │
│ · 💡 Kim et al. (2024)         │     💡아이콘 클릭=맵 glow 하이라이트
│ · 💡 Park et al. (2023)        │     논문 자체 클릭=DetailPanel 상세
│                                 │     드래그=다리/도로에 배치
│ 연도 분포: 2022(3) 2023(8)...   │  ← 간단 통계
├─────────────────────────────────┤
│ Research Gaps (3)               │
│ · "향미-감정 연결 부족"          │     클릭 시 → 관련 다리 위치로
│                                 │     포스트잇이 날아가서 붙는 애니메이션
│                                 │     (한 번에 하나만, 다른 갭 클릭 시 자동 복귀)
├─────────────────────────────────┤
│ Google Sheets [Push][Pull]      │  ← n8n 연동 후 판단
├─────────────────────────────────┤
│ Local Backup [Export][Import]   │
└─────────────────────────────────┘
```

### 제거/이동된 섹션
- **Bridges 목록** → 제거 (맵에서 직접 확인)
- **Settings (GitHub, Sheets, Claude)** → 홈페이지(`/`)로 이동 (향후 설정 항목 확장 예정)

### 논문 인터랙션 분리 (3가지 행동) ✅ 구현 완료
| 행동 | 트리거 | 효과 |
|------|--------|------|
| 하이라이트 | 논문 클릭 | 맵에서 관련 다리/도로 glow 효과 (토글) |
| 학습 패널 | 논문 더블클릭 | PaperStudyPanel — 넓은 전용 학습 공간 |
| 배치 | 드래그 → 다리/도로에 드롭 | 해당 다리/도로에 논문 추가 |

> 💡 아이콘은 제거됨 — 클릭만으로 glow 토글. 유저 피드백: "아이콘이 정신 사나움"

### 드래그&드롭 개선
- 드롭 대상(다리/도로) 영역 확대 — 현재 선이 가늘어서 정확히 놓기 어려움
- 드래그 중 드롭 가능 영역 시각 피드백 강화

### 갭 메모 포스트잇 애니메이션
- 사이드바에서 갭 메모 클릭 → 관련 다리 근처로 포스트잇이 날아가서 붙음
- 한 번에 **하나의 갭만** 맵에 표시 (다른 갭 클릭 시 이전 것 자동 복귀)
- 다시 클릭하면 사이드바로 복귀

---

## 6. 논문 데이터 모델 ✅

```typescript
interface Paper {
  id: string;
  semanticScholarId?: string;
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  abstract?: string;
  comment?: string;              // 내가 왜 이 논문을 넣었는지 메모
  figureUrls?: string[];         // Figure 이미지 경로 (GitHub data/figures/ 저장)
  citationCount?: number;
  url?: string;                  // DOI 링크
  source: 'semantic_scholar' | 'manual' | 'n8n_import';
  createdAt: string;
}
```

---

## 7. AI 논문 제안 ✅

| 항목 | 내용 |
|------|------|
| 엔진 | Claude Haiku 4.5 (브라우저 직접 호출) |
| 트리거 | DetailPanel "AI 논문 제안" 버튼 |
| 입력 | 다리 양쪽 섬 이름 + 다리 label + 기존 논문 목록 + 갭 메모 |
| 출력 | 논문 후보 5개 → "추가" / "무시" 버튼 |
| API Key | ClaudeSettings.tsx에서 별도 설정 |

---

## 8. 데이터 영속성 ✅

### 저장 구조
```
GitHub Repository (data/)
├── maps-index.json          ← 맵 목록 메타데이터
├── maps/{mapId}.json        ← 각 맵의 ResearchMap 데이터
└── figures/{paperId}_0.png  ← 논문 Figure 이미지
```

### 동기화 방식 (구현 완료, auto-save 제거됨)
- **수동 저장**: Save 버튼 클릭 시에만 GitHub에 push (auto-save 제거됨)
- **자동 로드**: 맵 진입 시 + 탭 복귀 시 GitHub에서 최신 로드
- **localStorage**: 변경 즉시 저장 (브라우저 내 데이터 보호)
- **충돌 감지**: SHA 비교 → 충돌 시 경고 + 선택
- **캐시 우회**: URL `?t=timestamp`
- **Vercel ignoreCommand**: `data/` 전용 커밋 빌드 스킵
- 상세: PLAN-MANAGE.md § 6 참조

### 구글시트 연동 ✅ (기본 구현)
- Push: 맵 논문 → 구글시트 (n8n webhook 경유)
- Pull: 구글시트 → 맵 논문 (n8n webhook 경유)
- SheetsSettings.tsx에서 webhook URL 설정

### 이미지 내보내기 ✅
- Toolbar에서 SVG/PNG export

---

## 9. 배포 ✅

| 항목 | 선택 |
|------|------|
| 호스팅 | Vercel (자동 배포, 무료 티어) |
| 도메인 | `research-island.vercel.app` |
| CI/CD | GitHub push → Vercel 자동 빌드/배포 |

---

## 10. 시각 디자인 ✅

| 항목 | 방향 |
|------|------|
| 전체 톤 | 은은한 배경 + 깔끔한 UI, 다크모드 지원 |
| 섬 | 부드러운 ellipse, 분야별 색상 (팔레트 10색 선택 가능) |
| 다리 | forward = 초록(`#2a9d8f`), backward = 주황(`#e76f51`), 점선 + dash-flow 애니메이션 |
| 도시 | 둥근 노드, 섬 색상의 변형 |
| 도로 | 다리와 동일한 색상/애니메이션 규칙 |
| 하이라이트 | 논문 선택 시 관련 다리/도로 glow 효과 |
| 다크모드 | CSS 변수 `[data-theme="dark"]` + 해/달 토글 |

---

## 11. 방향성 규칙 (불변)

- **forward** (→, 초록 `#2a9d8f`): input → output
- **backward** (←, 주황 `#e76f51`): output → input
- **양방향 다리/도로 없음** — 필요시 2개 생성
- 하나의 논문이 여러 Bridge/Road에 배치 가능
- 방향 전환: 우클릭 메뉴에서 가능

---

## 12. 구현 상태

### Phase 1: MVP ✅
- [x] 섬 조망도 (D3 force + 수동 조정)
- [x] 섬 내부 뷰 (그리드 + 수동 조정)
- [x] 라우팅 + 멀티맵 홈페이지
- [x] 상단 툴바 (모드 전환)
- [x] 섬/다리/도시/도로 CRUD
- [x] 사이드 패널 (논문 + 갭 + 크로스 레퍼런스)
- [x] GitHub API 저장/불러오기
- [x] Vercel 배포

### Phase 2-A: 논문 하이라이트 + 네비게이션 ✅
- [x] 논문 선택 → 관련 다리/도로 glow 하이라이트
- [x] 크로스 레퍼런스 클릭 → 해당 다리/도로로 이동
- [x] Paper 타입 확장: journal, comment 필드
- [x] 사이드바 트리 네비게이션 (섬 > 도시 계층 펼침)

### Phase 2-B: Figure + 시트 연동 ✅
- [x] 논문 Figure 이미지 첨부 (GitHub `data/figures/` 저장)
- [x] 구글시트 Push/Pull (n8n webhook 경유)
- [x] 맵 이미지 내보내기 (SVG/PNG)

### Phase 2-C: AI 논문 제안 ✅
- [x] Claude API 연동 (Haiku 4.5, 브라우저 직접 호출)
- [x] DetailPanel "AI 논문 제안" 버튼 + 추가/무시 UI
- [x] Semantic Scholar API 검색 (PaperForm "S2 검색")

### Phase 2-D: UX 기본기 ✅
- [x] 우클릭 컨텍스트 메뉴 (이름 변경/삭제/색상 변경/방향 전환)
- [x] Undo/Redo (Ctrl+Z / Ctrl+Y)
- [x] 다리/도로 곡률 드래그 조정

### 추가 구현 (이번 세션) ✅
- [x] 사이드바 논문 → 다리/도로 드래그&드롭
- [x] GitHub 동기화 안정성 (5s auto-save, visibilitychange, base64 수정)
- [x] SHA 충돌 감지 (다른 기기 동시 작업 보호)
- [x] CORS 문제 해결 (Git Blob API, URL timestamp)

### Phase 3-A: 사이드바 리디자인 ✅ (2026-04-01 완료)
- [x] 접이식 사이드바 (기본 펼침, 접기 버튼으로 토글)
- [x] Save/Load 최상단 배치
- [x] Bridges 섹션 제거
- [x] Settings → 홈페이지 이동
- [x] 맵 요약 숫자 표시 (섬, 다리, 논문, 갭)
- [x] 논문 연도별/저널별 그룹핑 & 필터 + 연도 분포 미니 바 차트
- [x] 논문 인터랙션 분리 (클릭=glow 하이라이트 / 더블클릭=학습패널 / 드래그=배치)
- [x] 💡 아이콘 제거 (클릭만으로 glow 토글)
- [x] hover 툴팁 (논문 hover 시 소속 다리/도로 표시)
- [x] 드래그&드롭 영역 확대 (다리 32px, 도로 28px)
- [x] 갭 메모 → 다리 포스트잇 날아가기 애니메이션 (GapPostitAnimation.tsx)

### Phase 3-A-2: 논문 학습 패널 ✅ (2026-04-01 완료)
- [x] PaperStudyPanel.tsx — 논문 더블클릭 시 넓은 전용 학습 공간
- [x] AI 요약 (Claude Haiku 4.5, paper.aiSummary 캐싱)
- [x] Figure 갤러리 (120x120, 업로드+붙여넣기, 라이트박스)
- [x] 소속 다리/도로 크로스 레퍼런스 (클릭 시 이동)
- [x] 마크다운 공부 노트 (textarea + preview 토글, 자동 저장)
- [x] flex 레이아웃 (맵 0.4 : 패널 1, CSS transition)

### Phase 3-B: 섬 조망도 인터랙션 강화 ✅ (2026-04-01 완료)
- [x] 섬 hover=하이라이트, 클릭=포커스이동+도시펼침, 더블클릭=내부뷰 진입
- [x] 섬 펼침 시 내부 도시 노출 (ellipse 확장 + 도시 원형 배치)
- [x] 클릭/더블클릭 구분 (250ms 타이머)
- [ ] 논문에 "관련 도시" 필드 추가 (`relatedCityIds`) — 미구현

### Phase 3-C: 다리 라벨 체계 (미구현)
- [ ] 다리 라벨 `방법명 (주체)` 가이드 UI
- [ ] What(섬) / How(라벨) / Who(괄호) 체계 적용

### Phase 3 기타
- [ ] 읽기 전용 공유 모드 (우선순위 낮음 — PNG/PDF 선호)
- [ ] n8n 워크플로우 본격 연동
- [x] 다크모드 ✅
- [ ] 맵 삭제/수정 기능 (HomePage)
- [ ] 기존 단일맵 데이터 마이그레이션 UI

---

## 13. 기술 스택 (확정)

| 레이어 | 기술 |
|--------|------|
| 프레임워크 | React 19 + TypeScript (strict) |
| 빌드 | Vite 8 |
| 시각화 | D3.js v7 |
| 라우팅 | React Router v7 |
| 데이터 저장 | localStorage (캐시) + GitHub API (영구) |
| 인증 | GitHub PAT + PIN (SHA-256 해시) |
| 배포 | Vercel |
| AI | Claude Haiku 4.5 (브라우저 직접 호출) |
| 시트 연동 | Google Sheets (n8n webhook 경유) |

---

## 14. 사용자 프로필

- 식품과학(sensory science) 연구자
- 연구 분야: samples, flavors, visual elements, images, emotions
- 접속 기기 4대 (연구실, 집, 발표용, 개인)
- 즉시 실전 투입: 선행연구 조사 + 학회 발표용
- 장기 목표: 연구 인생 전체를 이 프레임 안에서 정리
- 불필요한 UI 싫어함, 색상은 팔레트 선호

---

## 15. 디버깅 워크플로우

유저에게 에러 발생 시:

1. **F12** → Console 탭 열기
2. 빨간색 에러 메시지 **전문** 복사 (요약 X, 전문 O)
3. Network 탭에서 실패한 요청의 **Status**, **URL**, **Response** 확인
4. 위 정보를 그대로 전달

### 알려진 함정 (CLAUDE.md에도 기재)
- `cache: 'no-store'` → CORS 실패
- `If-None-Match` 헤더 → CORS preflight 실패
- `raw.githubusercontent.com` + Auth → CORS 차단
- `btoa/atob` + `escape/unescape` → 큰 JSON 깨짐
