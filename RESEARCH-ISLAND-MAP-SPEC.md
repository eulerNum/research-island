# Research Island Map

## 프로젝트 개요
식품과학 연구를 섬-다리-도시-도로 메타포로 시각화하는 인터랙티브 웹앱.

## 아키텍처 원칙
- **데이터/UI 레이어 분리**: UI는 services/만 호출, 데이터 소스를 직접 참조하지 않음
- **n8n 연동 대비**: Data Service Layer의 인터페이스를 명확히 유지
- **방향성 2가지만**: forward(→, 초록) / backward(←, 주황). 양방향 다리 없음
- **논문 다중 배치**: 하나의 논문이 여러 bridge/road에 배치 가능

## 코드 컨벤션
- 언어: TypeScript (strict mode)
- 컴포넌트: 함수형 컴포넌트 + hooks
- 파일명: PascalCase (컴포넌트), camelCase (서비스/유틸)
- 커밋 메시지: 한국어 허용, conventional commits 형식

## 기술 스택
- React + TypeScript + Vite
- D3.js (시각화)
- Semantic Scholar API (논문 수집)
- JSON 파일 기반 저장 (초기)

## 주요 타입
- Paper, ResearchGap, Island, Bridge, City, Road (src/services/types.ts 참조)

## 개발 시 주의사항
- Semantic Scholar API rate limit: 인증 없이 100 req / 5 min
- 논문 중복 체크: semanticScholarId 또는 title+year 조합으로 판별
- 연구 갭은 auto_detected와 manual 두 소스를 구분하여 저장
