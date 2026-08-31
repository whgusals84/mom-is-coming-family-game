'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { unlockGameAudio } from '@/lib/game/audio';
import type { GameResult } from '@/lib/game/types';
import { GameCanvas } from './game-canvas';

type Screen = 'game' | 'how' | 'characters' | 'gameover';

function formatTime(value: number) {
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
}

const EMPTY_RESULT: GameResult = { score: 0, elapsed: 0, accidents: 0, closeCalls: 0, missionDone: false };

export function GameApp() {
  const [screen, setScreen] = useState<Screen>('game');
  const [run, setRun] = useState(0);
  const [startImmediately, setStartImmediately] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [result, setResult] = useState<GameResult>(EMPTY_RESULT);
  const gameOverTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem('mom-is-coming-high-score') ?? 0);
      if (Number.isFinite(saved)) setHighScore(saved);
    } catch { /* Storage may be unavailable in restricted/private browser modes. */ }
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('sw.js').catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (screen === 'gameover') gameOverTitleRef.current?.focus();
  }, [screen]);

  const showGame = (chaseImmediately: boolean) => {
    if (chaseImmediately) unlockGameAudio();
    setRun((value) => value + 1);
    setStartImmediately(chaseImmediately);
    setScreen('game');
  };
  const handleGameOver = useCallback((gameResult: GameResult) => {
    setResult(gameResult);
    setHighScore((previous) => {
      const next = Math.max(previous, gameResult.score);
      try { localStorage.setItem('mom-is-coming-high-score', String(next)); } catch { /* Keep the in-memory record. */ }
      return next;
    });
    setTimeout(() => setScreen('gameover'), 520);
  }, []);

  if (screen === 'game') {
    return (
      <GameCanvas
        key={run}
        highScore={highScore}
        initialPhase={startImmediately ? 'chase' : 'explore'}
        onGameOver={handleGameOver}
        onOpenHow={() => setScreen('how')}
        onOpenCharacters={() => setScreen('characters')}
      />
    );
  }

  return (
    <main className="menu-shell">
      <div className="menu-house" aria-hidden="true">
        <span className="room-block room-a" /><span className="room-block room-b" /><span className="room-block room-c" />
        <span className="comic-word word-one">후다닥!</span><span className="comic-word word-two">?!</span>
      </div>

      {screen === 'how' && (
        <section className="info-panel">
          <Button className="back-button" variant="ghost" onClick={() => showGame(false)}><ArrowLeft /> 집으로 돌아가기</Button>
          <div className="info-heading"><span>게임 방법</span><h2>사고 치고, 튀어!</h2><p>체력은 100! 엄마에게 닿으면 35가 줄고, 거리를 오래 벌리거나 세면대·아빠 아이템으로 회복할 수 있어요.</p></div>
          <div className="how-grid">
            <article><b>01</b><span className="how-icon">🏃</span><h3>방향키로 달려요</h3><p>키보드의 ↑ ↓ ← → 방향키로 가구 사이를 누비세요. 모바일은 화면 방향키로 움직여요.</p></article>
            <article><b>02</b><span className="how-icon">💥</span><h3>E로 장난쳐요</h3><p>반짝이는 장소 근처에서 E를 누르면 점수와 분노도가 함께 올라갑니다.</p></article>
            <article><b>03</b><span className="how-icon">⚡</span><h3>Space로 대시!</h3><p>엄마 바로 앞에서 대시로 빠져나오면 NICE 보너스를 받아요.</p></article>
            <article><b>04</b><span className="how-icon">💚</span><h3>체력을 회복해요</h3><p>엄마와 거리를 8초 유지하면 자동 회복! 세면대의 물과 아빠표 비타민 주스도 찾아보세요.</p></article>
          </div>
          <Button className="primary-cta compact" onClick={() => showGame(true)}>바로 시작!</Button>
        </section>
      )}

      {screen === 'characters' && (
        <section className="info-panel character-panel">
          <Button className="back-button" variant="ghost" onClick={() => showGame(false)}><ArrowLeft /> 집으로 돌아가기</Button>
          <div className="info-heading"><span>우리 가족</span><h2>누가 내 편일까?</h2></div>
          <div className="character-grid">
            <article className="character-card mom-card"><div className="character-portrait"><img src="assets/characters/mom/idle.png" alt="긴 머리의 엄마 캐릭터" /></div><div><span>추격자</span><h3>엄마</h3><p>“오늘도 사고 치는 아들들을 잡으러 간다.”</p></div></article>
            <article className="character-card brother-card"><div className="character-portrait"><img src="assets/characters/brother/idle.png" alt="흰 토끼 인형을 든 형 캐릭터" /></div><div><span>랜덤 NPC</span><h3>형</h3><p>“같이 사고는 치지만 잡힐 때는 각자도생.”</p></div></article>
            <article className="character-card player-card"><div className="character-portrait"><img src="assets/characters/player/idle.png" alt="플레이어 캐릭터" /></div><div><span>플레이어</span><h3>나</h3><p>“오늘도 살아남아야 한다.”</p></div></article>
            <article className="character-card dad-card"><div className="character-portrait"><img src="assets/characters/dad/idle.png" alt="안경을 쓰고 선물 주머니를 든 아빠 캐릭터" /></div><div><span>지원 NPC</span><h3>아빠</h3><p>“난 아무것도 못 봤다.”</p></div></article>
          </div>
          <Button className="primary-cta compact" onClick={() => showGame(true)}>가족 만나러 가기</Button>
        </section>
      )}

      {screen === 'gameover' && (
        <section className="gameover-panel" aria-labelledby="gameover-title">
          <div className="caught-stamp">체력 0!</div>
          <h2 id="gameover-title" ref={gameOverTitleRef} tabIndex={-1}>결국 엄마에게 잡혔다!</h2>
          <p>체력을 모두 써버렸다. 잠깐 쉬고 다시 도전!</p>
          <div className="result-grid">
            <div><span>생존시간</span><strong>{formatTime(result.elapsed)}</strong></div>
            <div><span>사고친 횟수</span><strong>{result.accidents}회</strong></div>
            <div className="result-score"><span>최종 점수</span><strong>{result.score.toLocaleString()}점</strong></div>
            <div><span>최고 기록</span><strong>{highScore.toLocaleString()}점</strong></div>
          </div>
          <div className="result-tags"><span>NICE {result.closeCalls}회</span><span>{result.missionDone ? '미션 성공 ✓' : '미션 다음 기회!'}</span></div>
          <Button className="primary-cta" onClick={() => showGame(true)}>다시 하기</Button>
          <Button variant="ghost" onClick={() => showGame(false)}>집을 다시 둘러보기</Button>
        </section>
      )}
    </main>
  );
}
