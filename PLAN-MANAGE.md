# Research Island Map — 멀티맵 관리 시스템 설계서

인터뷰 기반 (2026-03-31) / 최종 업데이트 (2026-04-01)

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
│   └── ...
└── figures/
    ├── {paperId}_0.png          ← Figure 이미지
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
      "pinHash": "03ac674216f3e15c...",
      "createdAt": "2026-03-31T10:00:00Z",
      "updatedAt": "2026-03-31T15:30:00Z",
      "stats": { "islands": 5, "bridges": 8, "papers": 23 }
    }
  ]
}
```

### PIN 저장 방식
- SHA-256 해시로 저장 (평문 저장 X)
- 4자리 숫자 (0000~9999)
- 검증: 입력값 해시 === 저장된 해시 비교
- 목적: 간단한 잠금 (보안 등급 아님)

---

## 4. 접속 흐름

```
홈페이지 (/)
├── GitHub PAT 미설정 → Settings 버튼 → PAT+owner+repo 입력 (기기당 1회)
└── PAT 설정 완료 → 맵 목록 카드 표시
    ├── 맵 클릭 → PIN 입력 → 맵 뷰 (/map/:mapId)
    └── [+ 새 맵 만들기] → 이름+설명+PIN → 생성 후 바로 진입
```

---

## 5. 라우트 구조 ✅ (구현 완료)

```
/                          → HomePage (맵 목록 + GitHub 설정)
/map/:mapId                → MapWrapper → OverviewPage (섬 조망도)
/map/:mapId/island/:id     → IslandDetailPage (섬 내부)
```

---

## 6. GitHub 동기화 전략 ✅ (구현 완료 + 강화)

### 자동 저장
- 변경 발생 → localStorage 즉시 저장 + **5초 디바운스** GitHub auto-sync
- `visibilitychange` 이벤트: 탭 숨김 → 즉시 GitHub 저장
- 맵 나가기(홈 이동) 시 미저장 데이터 자동 sync

### 자동 로드
- 맵 진입 시 GitHub에서 최신 데이터 자동 로드
- `visibilitychange` 이벤트: 탭 복귀 → GitHub에서 최신 로드 (다른 기기 변경분 반영)

### 충돌 감지 (1단계) ✅
- 파일별 SHA 추적 (`knownShaMap`)
- 저장 시 원격 SHA 비교 → 불일치 시 `ConflictError`
- 수동 Save: confirm 다이얼로그 (덮어쓰기 / 취소)
- auto-save: 사이드바 경고 배너 + "Load로 최신 데이터 가져오기" 버튼

### 캐시 우회
- URL `?t=Date.now()` 타임스탬프 (browser cache 무효화)
- **절대 사용 금지**: `cache: 'no-store'`, `If-None-Match` 헤더 (CORS 실패 유발)

### 대용량 파일 (>1MB)
- GitHub Contents API는 1MB 초과 시 `content: null` 반환
- Git Blob API (`/git/blobs/{sha}`)로 fallback
- **절대 사용 금지**: `raw.githubusercontent.com` + Authorization (CORS 차단)

### Base64 인코딩
- `TextEncoder`/`TextDecoder` 기반 `utf8ToBase64`/`base64ToUtf8`
- **절대 사용 금지**: `btoa(unescape(encodeURIComponent(...)))` (큰 payload 깨짐)

---

## 7. 주요 컴포넌트 ✅ (구현 완료)

### 신규 (구현됨)
- `src/pages/HomePage.tsx` — 맵 목록 + GitHub 설정 + 맵 생성
- `src/pages/MapWrapper.tsx` — mapId별 MapDataContext 제공
- `src/services/mapIndexService.ts` — maps-index.json CRUD
- `src/components/PinDialog.tsx` — PIN 입력 모달
- `src/components/NewMapDialog.tsx` — 새 맵 생성 모달

### 수정됨
- `src/App.tsx` — 라우트 구조 변경
- `src/services/githubService.ts` — mapId별 경로 + Blob API + SHA 충돌 감지
- `src/services/mapService.ts` — activeMapId 기반 localStorage 키 분리
- `src/hooks/useMapData.ts` — mapId + auto-sync + visibilitychange + 충돌 감지

---

## 8. 미구현 항목

### Phase B (남은 작업)
- [ ] 기존 단일맵 데이터 마이그레이션 다이얼로그 (`mapService.hasLegacyData()` 구현됨, UI 미연결)
- [ ] 맵 삭제 기능 (HomePage에서)
- [ ] 맵 이름/설명/PIN 수정 기능

### 충돌 감지 2단계 (미래)
- [ ] 자동 병합 (추가된 것은 합치고, 삭제/수정은 확인)
- [ ] WebSocket 실시간 동기화 (Google Docs 스타일) — 복잡도 높아 당분간 불필요

---

## 9. 디버깅 워크플로우

유저에게 에러 발생 시:

1. **F12** → Console 탭 열기
2. 빨간색 에러 메시지 **전문** 복사 (요약 X, 전문 O)
3. Network 탭에서 실패한 요청의 **Status**, **URL**, **Response** 확인
4. 위 정보를 그대로 전달

> "failed to fetch"만으로는 원인 파악 불가. CORS policy, status code, URL 등 상세 정보가 핵심.
