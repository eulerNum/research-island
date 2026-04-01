# Research Island Map — Plan Spec

인터뷰 기반 구현 계획서 (2026-03-31) / 최종 업데이트 (2026-04-01)

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

## 2. 뷰 구조 (2레벨) ✅

### 2-1. 홈페이지 — `/`
- 멀티맵 대시보드: 맵 카드 목록 + 새 맵 만들기
- GitHub PAT 설정, PIN 인증
- 상세: PLAN-MANAGE.md 참조

### 2-2. 섬 조망도 (Island Overview) — `/map/:mapId`
- 전체 섬(Island)과 다리(Bridge)만 표시
- 도시(City)는 표시하지 않음
- 섬 클릭 → 섬 내부 뷰로 이동
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

### 동기화 방식 (구현 완료)
- **자동 저장**: 5초 디바운스 + visibilitychange 즉시 저장
- **자동 로드**: 맵 진입 시 + 탭 복귀 시 GitHub에서 최신 로드
- **충돌 감지**: SHA 비교 → 충돌 시 경고 + 선택
- **수동**: Save/Load 버튼 (사이드바)
- **캐시 우회**: URL `?t=timestamp`
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

### Phase 3 (미구현)
- [ ] 읽기 전용 공유 모드 (우선순위 낮음 — PNG/PDF 선호)
- [ ] n8n 워크플로우 본격 연동
- [ ] 다크모드 ✅ (이미 구현됨)
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
