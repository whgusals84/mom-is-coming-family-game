# 캐릭터 스프라이트 교체 안내

게임 로직과 캐릭터 렌더링은 분리되어 있습니다. 아래 경로에 투명 배경 PNG를 넣으면 Canvas 도형 대신 자동으로 사용합니다.

- `player/idle.png` (현재 달리기에도 같은 파일을 재사용하며 `sprites.ts`에서 분리 가능)
- `mom/idle.png` (현재 추격/분노 상태에도 같은 파일을 재사용하며 `sprites.ts`에서 분리 가능)
- `brother/idle.png` (현재 달리기에도 같은 파일을 재사용하며 `sprites.ts`에서 분리 가능)
- `dad/idle.png`
- `brother_doll/doll.png`

권장 비율은 정사각형 또는 세로형이며, 캐릭터가 이미지 중앙 아래쪽에 오도록 제작하세요. 파일이 없거나 로딩에 실패하면 기본 SD 스타일 Canvas 캐릭터가 표시됩니다.
