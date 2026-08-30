'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Gamepad2, HelpCircle, Sparkles, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { unlockGameAudio } from '@/lib/game/audio';
import type { GameResult } from '@/lib/game/types';
import { GameCanvas } from './game-canvas';

type Screen = 'home' | 'how' | 'characters' | 'playing' | 'gameover';

function formatTime(value: number) {
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
}

const EMPTY_RESULT: GameResult = { score: 0, elapsed: 0, accidents: 0, closeCalls: 0, missionDone: false };

export function GameApp() {
  const [screen, setScreen] = useState<Screen>('home');
  const [run, setRun] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [result, setResult] = useState<GameResult>(EMPTY_RESULT);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem('mom-is-coming-high-score') ?? 0);
      if (Number.isFinite(saved)) setHighScore(saved);
    } catch { /* Storage may be unavailable in restricted/private browser modes. */ }
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  const startGame = () => {
    unlockGameAudio();
    setRun((value) => value + 1);
    setScreen('playing');
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

  if (screen === 'playing') return <GameCanvas key={run} onGameOver={handleGameOver} />;

  return (
    <main className="menu-shell">
      <div className="menu-house" aria-hidden="true">
        <span className="room-block room-a" /><span className="room-block room-b" /><span className="room-block room-c" />
        <span className="comic-word word-one">후다닥!</span><span className="comic-word word-two">?!</span>
      </div>

      {screen === 'home' && (
        <section className="home-panel">
          <div className="title-copy">
            <div className="eyebrow"><Sparkles size={17} /> 우당탕탕 가족 추격전</div>
            <h1>엄마가<br /><em>온다!</em></h1>
            <p>사고는 크게, 도망은 빠르게.<br />잡히기 전까지 집 안을 누벼 보세요!</p>
          </div>
          <div className="hero-chase" aria-hidden="true">
            <div className="hero-mom"><span className="hero-alert">거기 서!</span><img src="/assets/characters/mom/idle.png" alt="" /></div>
            <span className="speed-lines">〽〽〽</span>
            <div className="hero-player"><img src="/assets/characters/player/idle.png" alt="" /></div>
          </div>
          <div className="menu-actions">
            <Button className="primary-cta" onClick={startGame}><Gamepad2 /> 게임 시작</Button>
            <div className="secondary-actions">
              <Button variant="secondary" onClick={() => setScreen('how')}><HelpCircle /> 게임 방법</Button>
              <Button variant="secondary" onClick={() => setScreen('characters')}><UsersRound /> 캐릭터 소개</Button>
            </div>
            <div className="best-score">🏆 최고 기록 <strong>{highScore.toLocaleString()}점</strong></div>
          </div>
          <div className="keyboard-hint"><kbd>WASD</kbd> / 방향키 이동 <kbd>Space</kbd> 대시 <kbd>E</kbd> 장난</div>
        </section>
      )}

      {screen === 'how' && (
        <section className="info-panel">
          <Button className="back-button" variant="ghost" onClick={() => setScreen('home')}><ArrowLeft /> 돌아가기</Button>
          <div className="info-heading"><span>게임 방법</span><h2>사고 치고, 튀어!</h2><p>위험한 장난일수록 점수도 크지만 엄마의 분노도 빨리 올라갑니다.</p></div>
          <div className="how-grid">
            <article><b>01</b><span className="how-icon">🏃</span><h3>집 안을 달려요</h3><p>WASD 또는 방향키로 가구 사이를 누비세요. 모바일은 화면 버튼으로 움직여요.</p></article>
            <article><b>02</b><span className="how-icon">💥</span><h3>E로 장난쳐요</h3><p>반짝이는 장소 근처에서 E를 누르면 점수와 분노도가 함께 올라갑니다.</p></article>
            <article><b>03</b><span className="how-icon">⚡</span><h3>Space로 대시!</h3><p>엄마 바로 앞에서 대시로 빠져나오면 NICE 보너스를 받아요.</p></article>
            <article><b>04</b><span className="how-icon">🎁</span><h3>가족을 만나요</h3><p>아빠는 아이템을 주고, 형은 도와줄 때도 배신할 때도 있어요.</p></article>
          </div>
          <Button className="primary-cta compact" onClick={startGame}>바로 시작!</Button>
        </section>
      )}

      {screen === 'characters' && (
        <section className="info-panel character-panel">
          <Button className="back-button" variant="ghost" onClick={() => setScreen('home')}><ArrowLeft /> 돌아가기</Button>
          <div className="info-heading"><span>우리 가족</span><h2>누가 내 편일까?</h2></div>
          <div className="character-grid">
            <article className="character-card mom-card"><div className="character-portrait"><img src="/assets/characters/mom/idle.png" alt="긴 머리의 엄마 캐릭터" /></div><div><span>추격자</span><h3>엄마</h3><p>“오늘도 사고 치는 아들들을 잡으러 간다.”</p></div></article>
            <article className="character-card brother-card"><div className="character-portrait"><img src="/assets/characters/brother/idle.png" alt="흰 토끼 인형을 든 형 캐릭터" /></div><div><span>랜덤 NPC</span><h3>형</h3><p>“같이 사고는 치지만 잡힐 때는 각자도생.”</p></div></article>
            <article className="character-card player-card"><div className="character-portrait"><img src="/assets/characters/player/idle.png" alt="플레이어 캐릭터" /></div><div><span>플레이어</span><h3>나</h3><p>“오늘도 살아남아야 한다.”</p></div></article>
            <article className="character-card dad-card"><div className="character-portrait"><img src="/assets/characters/dad/idle.png" alt="안경을 쓰고 선물 주머니를 든 아빠 캐릭터" /></div><div><span>지원 NPC</span><h3>아빠</h3><p>“난 아무것도 못 봤다.”</p></div></article>
          </div>
          <Button className="primary-cta compact" onClick={startGame}>가족 만나러 가기</Button>
        </section>
      )}

      {screen === 'gameover' && (
        <section className="gameover-panel">
          <div className="caught-stamp">결국!</div>
          <h2>엄마에게 잡혔다!</h2>
          <p>“자, 이제 누가 치울 건지 얘기해 볼까?”</p>
          <div className="result-grid">
            <div><span>생존시간</span><strong>{formatTime(result.elapsed)}</strong></div>
            <div><span>사고친 횟수</span><strong>{result.accidents}회</strong></div>
            <div className="result-score"><span>최종 점수</span><strong>{result.score.toLocaleString()}점</strong></div>
            <div><span>최고 기록</span><strong>{highScore.toLocaleString()}점</strong></div>
          </div>
          <div className="result-tags"><span>NICE {result.closeCalls}회</span><span>{result.missionDone ? '미션 성공 ✓' : '미션 다음 기회!'}</span></div>
          <Button className="primary-cta" onClick={startGame}>다시 하기</Button>
          <Button variant="ghost" onClick={() => setScreen('home')}>시작 화면으로</Button>
        </section>
      )}
    </main>
  );
}
