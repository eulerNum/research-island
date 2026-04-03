# Storage & Deployment Flow

이 문서는 Research Island Map 앱의 데이터 저장 흐름과 배포 구조를 설명합니다.

---

## 저장소 구조

```
┌─────────────────────────────────────────────────────────┐
│                    브라우저 (각 도메인별 독립)              │
│                                                         │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ 메모리 cache  │  │   IndexedDB   │  │ localStorage │  │
│  │ (JS 변수)     │  │  (영구 저장)   │  │ (설정값만)    │  │
│  │              │  │              │  │              │  │
│  │ 맵 데이터     │  │ 맵 데이터     │  │ API 키       │  │
│  │ undo/redo    │  │ (비동기 백업)  │  │ 테마 설정     │  │
│  │              │  │              │  │ GitHub 설정   │  │
│  │ 수명: 탭 열림  │  │ 수명: 영구*   │  │ 수명: 영구*   │  │
│  └──────────────┘  └───────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↕ 인터넷
┌─────────────────────────────────────────────────────────┐
│                     GitHub Repository                    │
│                                                         │
│  data/maps/{mapId}.json  ← 맵 데이터 (유일한 원본)       │
│  data/maps-index.json    ← 맵 목록 + PIN 해시           │
│                                                         │
│  수명: 영구 (삭제하지 않는 한)                              │
└─────────────────────────────────────────────────────────┘

* "영구" = 브라우저 데이터 삭제 또는 브라우저 언인스톨 전까지
```

---

## 사용자 행동별 데이터 흐름

### 1. 앱을 열 때 (페이지 접속 / 새로고침)

```
1) IndexedDB에서 cache로 로드         ← 즉시 (0.01초), 화면에 먼저 표시
2) GitHub에서 최신 데이터 다운로드      ← 비동기 (0.5~2초)
3) GitHub 데이터로 cache + IndexedDB 덮어쓰기
4) React state 갱신 → 화면 업데이트
```

- GitHub 로드 실패 시 (인터넷 끊김 등) → IndexedDB 데이터로 유지
- GitHub 설정이 없으면 → IndexedDB 데이터만 사용

### 2. 편집할 때 (논문 추가, 다리 연결, 드래그 등)

```
1) undo 스택에 현재 상태 스냅샷 저장   ← 메모리 (50MB 버짓, 최대 20개)
2) 메모리 cache 즉시 반영              ← 동기, UI 안 끊김
3) IndexedDB에 비동기 저장             ← 백그라운드 (fire-and-forget)
4) React state 갱신 → 화면 업데이트
```

- 이 시점에서 GitHub에는 아직 반영 안 됨
- 브라우저를 닫아도 IndexedDB에 저장되어 있음
- 하지만 다른 기기에서는 보이지 않음

### 3. Save 버튼을 누를 때

```
1) 현재 메모리 cache의 맵 데이터를 GitHub에 업로드
   - 1MB 미만: Contents API PUT (단일 요청)
   - 1MB 이상: Git Data API (blob → tree → commit → ref)
2) GitHub에 저장 완료
```

- IndexedDB는 비우지 않음 (로컬 캐시로 유지)
- 이후 다른 기기에서 열면 GitHub에서 이 데이터를 받아감

### 4. 다른 기기/브라우저에서 접속할 때

```
1) 해당 브라우저의 IndexedDB 확인      ← 비어있거나 이전 버전
2) GitHub에서 최신 데이터 로드          ← Save한 시점의 데이터
3) cache + IndexedDB 갱신
```

- 각 브라우저/기기의 IndexedDB는 독립 → GitHub이 유일한 공유 저장소

### 5. Undo/Redo (Ctrl+Z / Ctrl+Y)

```
1) undo 스택에서 이전 스냅샷 꺼냄      ← 메모리
2) 현재 상태를 redo 스택에 저장
3) cache 교체 → IndexedDB 비동기 저장 → React 갱신
```

- undo 스택: 메모리에만 존재 (브라우저 닫으면 사라짐)
- 용량 제한: 50MB 총 버짓 + 최대 20개 스냅샷

---

## localStorage에 저장되는 설정값

| 키 | 내용 | 크기 |
|----|------|------|
| `github-config` | GitHub PAT, owner, repo | ~200B |
| `claude-api-config` | Claude API 키 | ~100B |
| `gemini-api-config` | Gemini API 키 | ~100B |
| `sheets-config` | Google Sheets 설정 | ~200B |
| `theme` | `'light'` 또는 `'dark'` | ~5B |

총 ~600B — localStorage 5MB 한도의 0.01%

---

## 배포 흐름

```
개발자가 코드 수정
  → /deploy (또는 git push)
    → GitHub에 push
      → Vercel GitHub webhook 감지
        → Vercel 빌드 (tsc + vite build)
          → Production 배포 (research-island.vercel.app)
```

- **Vercel 프로젝트**: `research-island` (prj_ADw8zOZwUgKW2EOv8eJ7smNeK5O6)
- **GitHub 레포**: `eulerNum/research-island`
- **vercel.json**: SPA rewrite만 설정 (ignoreCommand 없음)
- **빌드 명령**: `tsc -b && vite build`
- webhook 장애 시 백업: `npx vercel --prod` (로컬에서 직접 배포)

---

## 장애 시나리오

| 상황 | 영향 | 대응 |
|------|------|------|
| 인터넷 끊김 | GitHub Load/Save 실패 | IndexedDB 캐시로 작업 계속 가능. 인터넷 복구 후 Save |
| 브라우저 데이터 삭제 | IndexedDB + localStorage 전부 삭제 | GitHub에서 자동 Load (API 키는 재입력 필요) |
| 다른 브라우저로 접속 | IndexedDB 비어있음 | GitHub에서 자동 Load |
| GitHub 장애 | Save/Load 실패 | IndexedDB에 데이터 보존됨. 장애 복구 후 Save |
| 브라우저 탭 크래시 | 메모리 cache + undo 스택 소멸 | IndexedDB에 마지막 저장 상태 보존 |
| Vercel webhook 장애 | git push 후 자동 배포 안 됨 | `npx vercel --prod`로 수동 배포 |

---

## Save 버튼 vs /deploy — 완전히 다른 경로

```
[Save 버튼]  앱 안에서 클릭
  → GitHub API로 data/maps/{mapId}.json 업데이트 (REST API 직접 호출)
  → git commit이 아님 → Vercel 빌드 트리거 안 됨
  → 맵 데이터만 저장, 앱 코드는 변경 없음

[/deploy]  개발자가 코드 수정 후 실행
  → git commit + git push
  → GitHub webhook → Vercel 빌드 → 앱 재배포
  → 앱 코드가 변경됨
```

Save는 아무리 눌러도 Vercel 배포에 영향 없음.

---

## 핵심 원칙

1. **GitHub이 유일한 원본** — 다른 기기 동기화, 데이터 복구 모두 GitHub 의존
2. **IndexedDB는 로컬 캐시** — 빠른 로딩 + 오프라인 폴백 용도
3. **localStorage는 설정값 전용** — 절대 대량 데이터 저장 금지
4. **Save는 수동** — 사용자가 명시적으로 Save 버튼을 눌러야 GitHub 반영
