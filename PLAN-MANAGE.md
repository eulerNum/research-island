# Research Island Map — 멀티맵 관리 시스템 설계서

인터뷰 기반 (2026-03-31)

---

## 1. 개요

Research Island Map을 **여러 개의 맵**으로 확장하여, Vercel 배포 후 **어디서든 접속**하여 연구 논문을 관리할 수 있는 시스템으로 발전시킨다.

### 핵심 목표
- 고정 URL(Vercel 배포) 접속 → 비밀번호만으로 맵 데이터 접근
- 여러 맵을 독립적으로 관리 (2~3개 예상)
- 로컬 PC는 개발 전용, 배포 사이트는 실사용 전용

---

## 2. 사용자 프로필

| 항목 | 내용 |
|------|------|
| 사용자 | 본인 1명 (식품과학 연구자) |
| 접속 기기 | 연구실 PC, 집 PC, 발표용 노트북, 개인 노트북 (4대) |
| 맵 개수 | 2~3개 (연구 프로젝트별 또는 자유 구분) |
| 공유 방식 | PNG/PDF 내보내기로 공유 (URL 공유 불필요) |
| Figure 이미지 | 적극 사용 (논문당 1~2장) |
| 보안 수준 | 간단한 잠금 (함부로 수정 방지) |

---

## 3. 데이터 저장소: GitHub API

### 선택 이유
- 이미 레포(`eulerNum/research-island`) 및 `githubService.ts` 구현 완료
- 1GB 무료 저장 (Figure 이미지 포함 충분)
- Git 이력으로 실수 복구 가능
- 추가 서비스 가입 불필요

### GitHub 레포 내 저장 구조
```
data/
├── maps-index.json              ← 맵 목록 (이름, 설명, PIN 해시, 통계, 생성일)
├── maps/
│   ├── {mapId}.json             ← 각 맵의 ResearchMap 데이터
│   ├── {mapId}.json
│   └── ...
└── figures/
    ├── {paperId}_0.png          ← Figure 이미지 (기존과 동일)
    └── ...
```

### maps-index.json 구조
```json
{
  "maps": [
    {
      "id": "abc123",
      "name": "박사논문 맵",
      "description": "관능과학 선행연구 정리",
      "pinHash": "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4",
      "createdAt": "2026-03-31T10:00:00Z",
      "updatedAt": "2026-03-31T15:30:00Z",
      "stats": {
        "islands": 5,
        "bridges": 8,
        "papers": 23
      }
    }
  ]
}
```

### PIN 저장 방식
- SHA-256 해시로 저장 (평문 저장 ❌)
- 4자리 숫자 (0000~9999)
- 검증: 입력값 해시 === 저장된 해시 비교
- 목적: 간단한 잠금 (보안 등급 아님)

---

## 4. 접속 흐름

```
┌──────────────────────────────────────────────┐
│  홈페이지 (/)                                 │
│                                              │
│  ┌─ GitHub PAT 미설정 시 ──────────────────┐  │
│  │  "GitHub 연결 필요" + Settings 버튼      │  │
│  │  PAT + owner + repo 입력 (기기당 1회)    │  │
│  └─────────────────────────────────────────┘  │
│                                              │
│  ┌─ PAT 설정 완료 시 ─────────────────────┐  │
│  │  맵 목록 카드                           │  │
│  │  ┌─────────────┐  ┌─────────────┐      │  │
│  │  │ 박사논문 맵  │  │ 학회발표 맵  │      │  │
│  │  │ 섬 5 · 논문23│  │ 섬 3 · 논문12│      │  │
│  │  │ 2026-03-31  │  │ 2026-03-20  │      │  │
│  │  └──── 클릭 ───┘  └──── 클릭 ───┘      │  │
│  │                                         │  │
│  │  [+ 새 맵 만들기]                        │  │
│  └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
                    │
                    ▼ (맵 클릭)
┌──────────────────────────────────────────────┐
│  PIN 입력 다이얼로그                          │
│  "박사논문 맵에 접속합니다"                    │
│  [____] 4자리 PIN 입력                       │
│  [확인] [취소]                                │
└──────────────────────────────────────────────┘
                    │
                    ▼ (PIN 일치)
┌──────────────────────────────────────────────┐
│  기존 맵 뷰 (/map/:mapId)                    │
│  Toolbar + Sidebar + IslandMap + DetailPanel │
│  (현재와 동일한 인터페이스)                    │
└──────────────────────────────────────────────┘
```

---

## 5. 라우트 구조 변경

### 현재
```
/                  → OverviewPage (섬 조망도)
/island/:id        → IslandDetailPage (섬 내부)
```

### 변경 후
```
/                          → HomePage (맵 목록 + GitHub 설정)
/map/:mapId                → OverviewPage (섬 조망도)
/map/:mapId/island/:id     → IslandDetailPage (섬 내부)
```

---

## 6. 새 맵 만들기

### 입력 항목
| 필드 | 필수 | 설명 |
|------|------|------|
| 이름 | ✅ | 맵 제목 (예: "박사논문 맵") |
| 설명 | 선택 | 간단한 설명 |
| PIN | ✅ | 4자리 숫자 비밀번호 |

### 생성 시 동작
1. 빈 ResearchMap 생성 (`{ islands: [], bridges: [], roads: [], papers: [], gaps: [] }`)
2. `data/maps/{newId}.json`에 저장 (GitHub API)
3. `data/maps-index.json`에 메타데이터 추가
4. 생성 후 바로 해당 맵으로 이동

---

## 7. 주요 컴포넌트 변경

### 신규
- `src/pages/HomePage.tsx` — 맵 목록 + GitHub 설정 + 맵 생성
- `src/services/mapIndexService.ts` — maps-index.json CRUD (GitHub API 경유)
- `src/components/PinDialog.tsx` — PIN 입력 모달
- `src/components/MapCard.tsx` — 맵 카드 (이름, 통계, 날짜)
- `src/components/NewMapDialog.tsx` — 새 맵 생성 모달

### 수정
- `src/App.tsx` — 라우트 구조 변경
- `src/services/githubService.ts` — 맵별 파일 경로 지원 (`data/maps/{mapId}.json`)
- `src/services/mapService.ts` — localStorage 키에 mapId 포함 (`research-map-{mapId}`)
- `src/hooks/useMapData.ts` — mapId 파라미터 추가
- `src/pages/OverviewPage.tsx` — 라우트 파라미터 변경
- `src/pages/IslandDetailPage.tsx` — 라우트 파라미터 변경
- `src/components/Sidebar.tsx` — 홈으로 돌아가기 버튼 추가

---

## 8. 데이터 흐름 변경

### 현재
```
앱 시작 → localStorage('research-island-map') 로드 → 사용
Save 클릭 → GitHub data/research-map.json 저장
```

### 변경 후
```
홈 접속 → GitHub data/maps-index.json 로드 → 맵 목록 표시
맵 선택 + PIN → GitHub data/maps/{mapId}.json 로드 → localStorage 캐시 → 사용
자동저장/Save → GitHub data/maps/{mapId}.json + maps-index.json 통계 업데이트
```

### 자동 저장 전략
- 변경 발생 시 **localStorage에 즉시 저장** (기존과 동일, 빠름)
- **30초 디바운스**로 GitHub에 자동 sync (네트워크 비용 최소화)
- 사이드바의 Save 버튼은 즉시 GitHub sync (수동 트리거)
- 맵 나가기(홈 이동) 시 미저장 데이터가 있으면 자동 sync

---

## 9. 기존 데이터 마이그레이션

현재 localStorage에 있는 단일 맵 데이터를 자동으로 멀티맵 구조로 전환:

1. 앱 시작 시 `localStorage('research-island-map')` 확인
2. 존재하면 → "기존 맵 데이터가 있습니다. 새 맵으로 가져올까요?" 다이얼로그
3. 이름/설명/PIN 입력 → 새 맵으로 생성 + GitHub 업로드
4. 마이그레이션 완료 후 기존 localStorage 키 제거

---

## 10. 성능 고려사항

### Figure 이미지 (적극 사용 예정)
- GitHub Contents API: 파일당 **최대 100MB**
- 현재 base64로 JSON 내 저장 → **GitHub `data/figures/`에 분리 저장** (이미 구현됨)
- 맵 JSON에는 URL만 참조 → 로딩 속도 영향 없음

### 맵 데이터 크기 예상
- 논문 100개 × 0.5KB ≈ 50KB
- 섬/다리/도시/도로 메타데이터 ≈ 20KB
- 맵당 약 70~100KB (Figure 제외)
- 2~3개 맵: 총 300KB 이하 → **문제 없음**

### 네트워크 최적화
- GitHub API 호출 최소화 (디바운스)
- localStorage를 로컬 캐시로 활용
- 변경 없으면 sync 건너뜀

---

## 11. 구현 우선순위

### Phase A: 멀티맵 홈페이지 (핵심)
1. HomePage + 라우트 구조 변경
2. mapIndexService (maps-index.json CRUD)
3. githubService 맵별 경로 지원
4. PIN 입력 다이얼로그
5. 새 맵 생성 다이얼로그
6. mapService 멀티맵 지원 (mapId별 localStorage 키)

### Phase B: 자동 저장 + 마이그레이션
7. GitHub 자동 sync (30초 디바운스)
8. 기존 단일맵 데이터 마이그레이션
9. 맵 삭제 기능
10. 맵 이름/설명/PIN 수정 기능

### Phase C: Vercel 배포
11. Vercel 연결 + 첫 배포
12. 배포 후 실기기 테스트

---

## 12. 검증 방법

1. `npm run build && npx tsc --noEmit` — 빌드 통과
2. 로컬에서 전체 플로우 테스트:
   - 홈 → GitHub 설정 → 맵 생성 → PIN 입력 → 맵 사용 → 홈으로 복귀
   - 다른 브라우저에서 같은 맵 접속 (localStorage 없이 GitHub에서 로드)
3. Vercel 배포 후 다른 기기에서 접속 테스트
