'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { unlockGameAudio } from '@/lib/game/audio';
import type { GameResult, HouseEventKind, PlayerOutfit } from '@/lib/game/types';
import { GameCanvas } from './game-canvas';

type Screen = 'game' | 'how' | 'characters' | 'collection' | 'gameover';

function formatTime(value: number) {
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
}

const EMPTY_RESULT: GameResult = {
  score: 0, elapsed: 0, accidents: 0, closeCalls: 0, missionDone: false,
  maxCombo: 0, decoysUsed: 0, familyTitle: '발 빠른 집안 탐험가',
};
const OUTFITS: ReadonlyArray<{ id: PlayerOutfit; name: string; icon: string; requiredScore: number; description: string }> = [
  { id: 'basic', name: '기본 스타일', icon: '🙂', requiredScore: 0, description: '언제나 편한 기본 복장' },
  { id: 'cap', name: '파란 모자', icon: '🧢', requiredScore: 1000, description: '최고 기록 1,000점 달성' },
  { id: 'bunny', name: '토끼 머리띠', icon: '🐰', requiredScore: 3000, description: '최고 기록 3,000점 달성' },
  { id: 'cape', name: '번개 망토', icon: '⚡', requiredScore: 6000, description: '최고 기록 6,000점 달성' },
];
const EVENT_COLLECTION: ReadonlyArray<{ id: HouseEventKind; name: string; icon: string; hint: string }> = [
  { id: 'doorbell', name: '수상한 초인종', icon: '🔔', hint: '엄마가 현관을 확인해요' },
  { id: 'blackout', name: '갑작스런 정전', icon: '💡', hint: '엄마가 잠시 길을 잃어요' },
  { id: 'turtles', name: '거북이 대탈출', icon: '🐢', hint: '작은 거북이 둘이 산책해요' },
  { id: 'vacuum', name: '청소기 출동', icon: '🤖', hint: '로봇청소기가 거실을 누벼요' },
  { id: 'crumbs', name: '과자 부스러기', icon: '🍪', hint: '엄마 분노가 조금 올라가요' },
  { id: 'remote', name: '사라진 리모컨', icon: '📺', hint: '아빠가 다시 나타나요' },
];

export function GameApp() {
  const [screen, setScreen] = useState<Screen>('game');
  const [run, setRun] = useState(0);
  const [startImmediately, setStartImmediately] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [result, setResult] = useState<GameResult>(EMPTY_RESULT);
  const [playerOutfit, setPlayerOutfit] = useState<PlayerOutfit>('basic');
  const [discoveredEvents, setDiscoveredEvents] = useState<HouseEventKind[]>([]);
  const gameOverTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem('mom-is-coming-high-score') ?? 0);
      if (Number.isFinite(saved)) setHighScore(saved);
      const savedOutfit = localStorage.getItem('mom-is-coming-outfit') as PlayerOutfit | null;
      if (OUTFITS.some((outfit) => outfit.id === savedOutfit)) setPlayerOutfit(savedOutfit!);
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
  const openCollection = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('mom-is-coming-events') ?? '[]') as HouseEventKind[];
      setDiscoveredEvents(saved.filter((kind) => EVENT_COLLECTION.some((event) => event.id === kind)));
    } catch { setDiscoveredEvents([]); }
    setScreen('collection');
  };
  const chooseOutfit = (outfit: PlayerOutfit, requiredScore: number) => {
    if (highScore < requiredScore) return;
    setPlayerOutfit(outfit);
    try { localStorage.setItem('mom-is-coming-outfit', outfit); } catch { /* Keep the in-memory choice. */ }
  };

  if (screen === 'game') {
    return (
      <GameCanvas
        key={run}
        highScore={highScore}
        initialPhase={startImmediately ? 'chase' : 'explore'}
        playerOutfit={playerOutfit}
        onGameOver={handleGameOver}
        onOpenHow={() => setScreen('how')}
        onOpenCharacters={() => setScreen('characters')}
        onOpenCollection={openCollection}
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
            <article><b>02</b><span className="how-icon">💥</span><h3>E로 콤보 장난!</h3><p>7초 안에 장난을 이어가면 점수가 최대 3배! 3콤보마다 다음 대시에 가짜 발자국 미끼가 설치돼요.</p></article>
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

      {screen === 'collection' && (
        <section className="info-panel collection-panel">
          <Button className="back-button" variant="ghost" onClick={() => showGame(false)}><ArrowLeft /> 집으로 돌아가기</Button>
          <div className="info-heading"><span>나만의 수집함</span><h2>의상과 집안 사건</h2><p>최고 기록으로 의상을 열고, 게임 중 만난 랜덤 사건을 도감에 기록해요.</p></div>
          <div className="collection-section">
            <h3>내 의상</h3>
            <div className="outfit-grid">
              {OUTFITS.map((outfit) => {
                const unlocked = highScore >= outfit.requiredScore;
                const selected = playerOutfit === outfit.id;
                return (
                  <button key={outfit.id} type="button" className={`outfit-card ${selected ? 'is-selected' : ''}`} disabled={!unlocked} onClick={() => chooseOutfit(outfit.id, outfit.requiredScore)}>
                    <span className="outfit-icon">{unlocked ? outfit.icon : '🔒'}</span>
                    <strong>{outfit.name}</strong>
                    <small>{selected ? '착용 중' : unlocked ? '눌러서 착용' : outfit.description}</small>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="collection-section">
            <h3>집안 사건 도감 <small>{discoveredEvents.length}/{EVENT_COLLECTION.length}</small></h3>
            <div className="event-codex">
              {EVENT_COLLECTION.map((event) => {
                const discovered = discoveredEvents.includes(event.id);
                return (
                  <article key={event.id} className={discovered ? 'is-found' : 'is-hidden'}>
                    <span>{discovered ? event.icon : '❔'}</span>
                    <div><strong>{discovered ? event.name : '아직 못 만난 사건'}</strong><small>{discovered ? event.hint : '게임을 오래 플레이해 보세요'}</small></div>
                  </article>
                );
              })}
            </div>
          </div>
          <Button className="primary-cta compact" onClick={() => showGame(false)}>이 의상으로 집에 가기</Button>
        </section>
      )}

      {screen === 'gameover' && (
        <section className="gameover-panel" aria-labelledby="gameover-title">
          <div className="caught-stamp">체력 0!</div>
          <h2 id="gameover-title" ref={gameOverTitleRef} tabIndex={-1}>결국 엄마에게 잡혔다!</h2>
          <p>체력을 모두 써버렸다. 잠깐 쉬고 다시 도전!</p>
          <div className="family-title"><span>오늘 가족이 붙여준 칭호</span><strong>🏅 {result.familyTitle}</strong></div>
          <div className="result-grid">
            <div><span>생존시간</span><strong>{formatTime(result.elapsed)}</strong></div>
            <div><span>사고친 횟수</span><strong>{result.accidents}회</strong></div>
            <div className="result-score"><span>최종 점수</span><strong>{result.score.toLocaleString()}점</strong></div>
            <div><span>최고 기록</span><strong>{highScore.toLocaleString()}점</strong></div>
          </div>
          <div className="result-tags"><span>최대 콤보 {result.maxCombo}</span><span>미끼 성공 {result.decoysUsed}회</span><span>NICE {result.closeCalls}회</span><span>{result.missionDone ? '미션 성공 ✓' : '미션 다음 기회!'}</span></div>
          <Button className="primary-cta" onClick={() => showGame(true)}>다시 하기</Button>
          <Button variant="ghost" onClick={() => showGame(false)}>집을 다시 둘러보기</Button>
        </section>
      )}
    </main>
  );
}
