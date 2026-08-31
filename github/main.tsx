import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../app/globals.css';
import { GameApp } from '../components/game/game-app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameApp />
  </StrictMode>,
);
