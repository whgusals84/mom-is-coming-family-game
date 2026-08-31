# 엄마가 온다!

가족을 모티브로 한 귀엽고 코믹한 2D 탑다운 추격 게임입니다. 브라우저 Canvas에서 실행되며 별도의 백엔드나 사운드 파일이 필요하지 않습니다.

현재 맵은 제공된 실제 평면도를 바탕으로 현관, 거실, 주방·식당, 욕실 2곳, 침실 3곳과 양쪽 발코니를 연결했습니다. 현관 옆 형 방에는 오리지널 봉제인형이 가득하고, 왼쪽 아래 침실은 아빠 방입니다.

## 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 배포용 결과 확인은 `npm run build`로 할 수 있습니다.

## 조작

- 처음에는 안전한 자유 탐험 상태로 시작하며, 집 안을 둘러본 뒤 `게임 시작`을 누르면 현재 위치에서 추격이 시작됩니다.
- 화살표 방향키(↑ ↓ ← →): 이동
- Space: 짧은 대시
- E: 주변 장난 또는 숨기 상호작용
- 모바일: 화면 왼쪽 방향 패드와 오른쪽 DASH/E 버튼
- 민트색 문턱과 방 바닥은 통과할 수 있고, 갈색 벽과 점선으로 표시된 가구 면적은 통과할 수 없습니다.

맵 수정 뒤에는 `npm run check:map`으로 플레이어와 엄마가 모든 방·문턱·NPC 위치에 접근 가능한지 검사할 수 있습니다.

## 주요 구조

- `components/game/game-app.tsx`: 자유 탐험 진입, 도움말, 캐릭터 소개, 게임 오버 화면
- `components/game/game-canvas.tsx`: 게임 루프, 입력, 추격 AI, NPC, 점수와 미션
- `lib/game/data.ts`: 맵, 가구, 장난, 대사, 아이템 데이터
- `lib/game/map.ts`: 충돌 판정과 엄마의 격자 경로 탐색
- `lib/game/renderer.ts`: 맵과 SD 캐릭터 Canvas 렌더링
- `lib/game/sprites.ts`: 교체 가능한 캐릭터 스프라이트 경로와 fallback
- `public/assets/characters/`: 캐릭터 이미지

## 캐릭터 이미지 교체

`public/assets/characters/README.md`에 적힌 파일명으로 투명 PNG를 교체하면 게임 로직을 수정하지 않고 외형만 바꿀 수 있습니다. 이미지가 없거나 로드에 실패하면 Canvas로 그린 기본 SD 캐릭터가 자동 표시됩니다.
