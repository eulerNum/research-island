# Research Island Map — Plan Spec

인터뷰 기반 구현 계획서 (2026-03-31 업데이트)

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

---

## 2. 뷰 구조 (2레벨)

### 2-1. 섬 조망도 (Island Overview) — `/`
- 전체 섬(Island)과 다리(Bridge)만 표시
- **도시(City)는 표시하지 않음**
- 섬 클릭 → `/island/:id`로 라우트 이동
- 다리 클릭 → 사이드 패널 확장 (논문/갭 정보)

### 2-2. 섬 내부 뷰 (Island Detail) — `/island/:id`
- 해당 섬의 도시(City)들과 도로(Road)를 표시
- 조망도와 동일한 배치 규칙 적용
- 도로 클릭 → 사이드 패널 확장
- 뒤로가기 → 조망도 복귀

---

## 3. 레이아웃 엔진

| 대상 | 방식 |
|------|------|
| 섬 배치 (조망도) | D3 force-directed 자동 배치 + 드래그로 수동 미세 조정, 위치 저장 |
| 도시 배치 (내부 뷰) | 그리드 기반 자동 정렬 + 드래그로 수동 미세 조정, 위치 저장 |

### 확장성 고려
- 섬 10개+, 도시 수십 개 규모까지 성장 예정
- 사이드바 트리 네비게이션 (섬 > 도시 계층 펼침/접힘) 필요

---

## 4. 요소 생성 UX — 상단 툴바 모드 전환

### 모드 목록
| 모드 | 동작 |
|------|------|
| 선택 모드 (기본) | 요소 클릭으로 정보 확인, 드래그로 위치 이동 |
| 섬 추가 모드 | 캔버스 클릭 위치에 새 섬 생성 |
| 다리 연결 모드 | "시작점"란 활성 → 섬 클릭, "끝점"란 활성 → 섬 클릭, 방향은 시작→끝 = forward |
| 도시 추가 모드 | (섬 내부 뷰에서) 캔버스 클릭 위치에 새 도시 생성 |
| 도로 연결 모드 | 다리 연결과 동일 방식, 도시 간 연결 |

### 삭제/편집 — 우클릭 컨텍스트 메뉴
- 섬/도시/다리/도로 우클릭 → "이름 변경 / 삭제 / 색상 변경" 메뉴
- 삭제 시 확인 다이얼로그 (cascade 삭제 경고 포함)
- **Undo/Redo 필수** — 실수로 섬 삭제 시 전체 복원 가능

---

## 5. 사이드 패널 (다리/도로 클릭 시)

패널 구조 (위→아래):

```
┌─────────────────────────────────┐
│ 📝 연구 갭 메모                 │  ← 포스트잇 스타일, 순수 research gap 기록용
│    · 갭 메모 1                  │
│    · 갭 메모 2                  │
├─────────────────────────────────┤
│ 📄 논문 리스트                  │
│    · 논문 제목 (2024)           │
│      저널명 | 간단 설명         │
│      내 메모: "왜 넣었는지"     │  ← 개인 코멘트
│      DOI 링크 | [Figure 보기]   │
│      ↳ 다른 포함: Bridge A → 클릭시 이동
│        Road B → 클릭시 이동     │  ← 클릭 네비게이션
├─────────────────────────────────┤
│ [+ 논문 추가] [+ 갭 메모 추가]  │
│ [AI 논문 제안] (Phase 2)        │
└─────────────────────────────────┘
```

### 논문 추가 방식
- **수동 입력**: 제목, 저자, 연도, 저널명, 간단 설명, 내 메모(코멘트), DOI 링크, Figure 이미지(선택)
- 논문 클릭 → DOI 페이지로 외부 이동 (새 탭)
- Semantic Scholar API는 초기 비활성 (`beta/` 폴더에서 시범 운영)

### 논문 하이라이트 기능
- 논문 선택 시 → 해당 논문이 포함된 모든 다리/도로가 맵에서 발광(glow) 효과
- "이 논문이 맵 전체에서 어디에 기여하는지" 한눈에 파악

### 연구 갭 메모
- 포스트잇 스타일로 간편하게 추가/삭제
- `source: 'manual'` — 갭 분석은 사람의 영역 (AI 자동 생성 아님)
- 추후 AI와 대화하면서 사용자가 직접 기록

---

## 6. 논문 데이터 모델 (확장)

```typescript
interface Paper {
  id: string;
  semanticScholarId?: string;
  title: string;
  authors: string[];
  year: number;
  journal?: string;              // 저널명 (신규)
  abstract?: string;
  comment?: string;              // 내가 왜 이 논문을 넣었는지 메모 (신규)
  figureUrls?: string[];         // Figure 이미지 경로 (신규, GitHub repo 내 별도 저장)
  citationCount?: number;
  url?: string;                  // DOI 링크
  source: 'semantic_scholar' | 'manual' | 'n8n_import';
  createdAt: string;
}
```

### Figure 이미지 저장 전략
- JSON에 base64 삽입 ❌ (파일 비대화)
- GitHub repo `data/figures/` 폴더에 이미지 파일 별도 저장
- Paper에는 경로(`figureUrls`)만 참조
- 이미지 업로드 시 GitHub Contents API로 PUT

---

## 7. AI 논문 제안 (Phase 2)

| 항목 | 내용 |
|------|------|
| 엔진 | Claude API 직접 호출 |
| 트리거 | 다리 DetailPanel에서 "AI 논문 제안" 버튼 클릭 |
| 입력 | 다리 양쪽 섬 이름 + 다리 label + 기존 논문 목록 + 갭 메모 |
| 처리 | 정해진 프롬프트 포맷으로 Deep Research 스타일 검색 |
| 출력 | 논문 후보 리스트 (기존 논문과 중복 제거 후) → "이 논문을 추가할까요?" |
| 갭 분석 | AI가 자동 생성하지 않음 — 사용자가 직접 고민/기록 |

### AI 프롬프트 포맷 (초안)

```
You are a food science research assistant specializing in sensory science.

Context:
- Research bridge: "{sourceIsland}" → "{targetIsland}"
- Bridge description: "{bridgeLabel}"
- Existing papers on this bridge: {existingPaperTitles}
- Research gaps noted: {gapDescriptions}

Task:
1. Search for academic papers that investigate the relationship between
   "{sourceIsland}" (as input) and "{targetIsland}" (as output/result).
2. Focus on papers that describe experimental methods, analytical frameworks,
   or validated hypotheses for this input→output process.
3. Exclude papers already listed above.
4. For each suggested paper, provide:
   - Title, Authors, Year, Journal
   - DOI link
   - One-sentence explanation of how it contributes to this bridge
   - Which research gap (if any) it partially addresses

Return up to 5 most relevant papers, ranked by relevance to this bridge.
```

---

## 8. 데이터 영속성

### 저장 구조
```
GitHub Repository
├── data/
│   ├── research-map.json          ← ResearchMap 전체 데이터
│   └── figures/                   ← 논문 Figure 이미지 (Phase 2)
│       ├── {paperId}-fig1.png
│       └── ...
```

### 동기화 방식
- **앱 내 GitHub API 연동**
- "Save to GitHub" 버튼 → GitHub API로 JSON 커밋/푸시
- "Load from GitHub" 버튼 → GitHub API에서 JSON 가져오기
- GitHub Personal Access Token으로 인증
- 작업 중에는 localStorage에 임시 저장 (유실 방지)

### 구글시트 연동 (Phase 2)
- 논문 리스트를 구글시트와 **자동 양방향 동기화**
- 시트에 논문 추가 → 맵에 반영, 맵에서 추가 → 시트에 반영
- 백그라운드 자동 탑재 기능 (수동 트리거 불필요)
- n8n 워크플로우 경유 가능

### 이미지 내보내기
- 맵의 현재 뷰를 PNG/SVG로 내보내기 (발표/오프라인 용)

---

## 9. 배포

| 항목 | 선택 |
|------|------|
| 호스팅 | Vercel (자동 배포, 무료 티어) |
| 도메인 | Vercel 기본 도메인 (초기) |
| CI/CD | GitHub push → Vercel 자동 빌드/배포 |

---

## 10. 시각 디자인

| 항목 | 방향 |
|------|------|
| 전체 톤 | 하이브리드 — 은은한 바다/지형 배경 + 깔끔한 UI 컴포넌트 |
| 섬 | 부드러운 ellipse, 분야별 색상 구분 |
| 다리 | forward = 초록(`#2a9d8f`), backward = 주황(`#e76f51`), 점선 + 화살표 |
| 도시 | 둥근 노드, 섬 색상의 변형 |
| 도로 | 다리와 동일한 색상 규칙, 실선 |
| 배경 | 연한 파란 바다색, 은은한 물결/지형 텍스처 |
| 하이라이트 | 논문 선택 시 관련 다리/도로 glow 효과 |

---

## 11. 방향성 규칙 (불변)

- **forward** (→, 초록 `#2a9d8f`): input → output 방향 (시작점 = input, 끝점 = output)
- **backward** (←, 주황 `#e76f51`): output → input 역방향 관계
- **양방향 다리/도로 없음** — 필요시 forward + backward 두 개 생성
- 하나의 논문이 여러 Bridge/Road에 배치 가능 (다른 역할 수행)

---

## 12. 구현 범위 및 우선순위

### Phase 1: MVP (완료)
- [x] 섬 조망도 (D3 force + 수동 조정)
- [x] 섬 내부 뷰 (그리드 + 수동 조정)
- [x] 라우팅 (`/`, `/island/:id`)
- [x] 상단 툴바 (모드 전환)
- [x] 섬/다리/도시/도로 CRUD
- [x] 사이드 패널 (논문 리스트 + 연구 갭 + 크로스 레퍼런스)
- [x] 논문 수동 추가 (제목, DOI 직접 입력)
- [x] 연구 갭 포스트잇 메모
- [x] GitHub API 저장/불러오기
- [x] Vercel 배포 설정

### Phase 2-A: 논문 하이라이트 + 네비게이션 (최우선)
- [ ] 논문 선택 → 관련 다리/도로 glow 하이라이트
- [ ] 크로스 레퍼런스 클릭 → 해당 다리/도로 DetailPanel로 이동
- [ ] Paper 타입 확장: journal, comment 필드 추가
- [ ] 사이드바 트리 네비게이션 (섬 > 도시 계층 펼침)

### Phase 2-B: 구글시트 동기화 + 이미지
- [ ] 구글시트 ↔ 맵 논문 자동 양방향 동기화 (n8n 경유)
- [ ] 논문 Figure 이미지 첨부 (GitHub `data/figures/` 저장)
- [ ] Paper 타입 확장: figureUrls 필드 추가
- [ ] 맵 이미지 내보내기 (SVG/PNG export)

### Phase 2-C: AI 논문 제안
- [ ] Claude API 연동
- [ ] 다리 DetailPanel "AI 논문 제안" 버튼
- [ ] 정해진 프롬프트 포맷으로 논문 검색/제안
- [ ] 기존 논문 대비 중복 제거 후 "추가할까요?" 제안
- [ ] Semantic Scholar API 연동 (`beta/` → 본류 통합)

### Phase 2-D: UX 기본기 완성
- [ ] 우클릭 컨텍스트 메뉴 (이름 변경/삭제/색상 변경)
- [ ] Undo/Redo 스택
- [ ] Bridge/Road 생성 시 방향 선택 다이얼로그
- [ ] Bridge/Road 생성 시 label 입력

### Phase 3 (미래)
- [ ] 읽기 전용 공유 모드 (URL 공유 → 인터랙티브 뷰잉)
- [ ] 시스템 공유 — 다른 연구자가 자기 주제로 독립 맵 운영
- [ ] 협업 편집 (검토 후 결정)
- [ ] n8n 워크플로우 본격 연동
- [ ] 다크모드

---

## 13. 기술 스택 (확정)

| 레이어 | 기술 |
|--------|------|
| 프레임워크 | React 19 + TypeScript (strict) |
| 빌드 | Vite 8 |
| 시각화 | D3.js v7 |
| 라우팅 | React Router v7 |
| 데이터 저장 | localStorage (임시) + GitHub API (영구) |
| 인증 | GitHub PAT |
| 배포 | Vercel |
| AI (Phase 2-C) | Claude API |
| 자동화 (Phase 2-B/C) | n8n |
| 시트 연동 (Phase 2-B) | Google Sheets API (n8n 경유) |

---

## 14. 디렉토리 구조

```
src/
├── components/
│   ├── IslandMap.tsx          # 섬 조망도 D3 캔버스
│   ├── CityMap.tsx            # 섬 내부 도시 뷰 D3 캔버스
│   ├── Sidebar.tsx            # 좌측 사이드바 (트리 네비게이션 예정)
│   ├── DetailPanel.tsx        # 우측 사이드 패널 (다리/도로 클릭 시)
│   ├── Toolbar.tsx            # 상단 툴바 (모드 전환)
│   ├── PaperForm.tsx          # 논문 수동 추가 폼
│   ├── GapMemo.tsx            # 연구 갭 포스트잇 메모
│   ├── PromptDialog.tsx       # 범용 입력 모달
│   └── GitHubSettings.tsx     # GitHub 설정 모달
├── services/
│   ├── types.ts               # 핵심 타입 정의
│   ├── mapService.ts          # 맵 CRUD (localStorage)
│   ├── githubService.ts       # GitHub API 저장/불러오기
│   └── semanticScholarService.ts  # (Phase 2-C) 논문 검색
├── hooks/
│   ├── useMapData.ts          # 맵 데이터 상태 관리
│   └── useToolbar.ts          # 툴바 모드 상태
├── pages/
│   ├── OverviewPage.tsx       # 섬 조망도 페이지
│   └── IslandDetailPage.tsx   # 섬 내부 뷰 페이지
├── contexts/
│   └── MapDataContext.ts      # 맵 데이터 Context
├── utils/
│   └── idGenerator.ts
├── data/
│   └── sampleMap.json
└── beta/
    └── (Semantic Scholar API 시범 운영)
```

---

## 15. 사용자 프로필

- 식품과학(sensory science) 연구자
- 연구 분야: samples, flavors, visual elements, images, emotions
- 현재 워크플로우: GPT Deep Research → 구글시트 + PPT(핵심 figure + 발표자 노트)
- 이 도구의 위치: 다른 사람의 논문 정리 파일 → 이 사이트가 그 역할
- 즉시 실전 투입: 선행연구 조사 + 기존 연구 학회 발표용
- 장기 목표: 연구 인생 전체를 이 프레임 안에서 정리
