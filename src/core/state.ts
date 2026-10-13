// Ponte de estado entre o loop 3D (three.js, roda a cada frame) e o HUD
// (React Native). O loop escreve; o HUD lê por polling — sem re-render
// de componente a cada frame.

import type { WeaponId } from '../config/constants';

export const lookState = { yaw: 0, pitch: 0 };

export const inputState = {
  moveX: 0, // strafe -1..1 (esquerda/direita)
  moveZ: 0, // frente -1..1 (baixo/cima do joystick)
  firing: false, // botão de tiro pressionado (segurar = automático)
  reloadQueued: false, // HUD pede recarga; o loop consome
  plantHeld: false, // botão PLANTAR pressionado (canal de plantio)
  readyQueued: false, // HUD pede para encerrar a fase de compra
  restartQueued: false, // HUD pede reinício da partida (fim de jogo)
};

export const settings = {
  sensMultiplier: 1, // 1 | 1.5 | 2
};

// Estatísticas exibidas no HUD (escritas pelo loop, lidas por polling).
export const gameStats = {
  ammo: 12,
  reloading: false,
  reloadProgress: 0, // 0..1
  shots: 0,
  hits: 0,
  kills: 0,
  headshots: 0,
  enemiesAlive: 3, // operadores DIRAC em campo (Etapa 6)
};

// Vitais do jogador (Etapa 5 — ainda sem fontes de dano, estrutura pronta).
export const playerVitals = {
  hp: 100,
  shield: 0,
};

// Estado da partida (Etapa 5 — economia e rodadas). Escrito pelo
// RoundManager (loop), lido pelo HUD por polling.
export type Phase = 'buy' | 'live' | 'end' | 'over';

export const roundState = {
  phase: 'buy' as Phase,
  roundNum: 1,
  scoreCORO: 0,
  scoreDIRAC: 0,
  phaseEndsAt: 0, // timestamp (ms) de fim da fase atual
  dB: 800, // carteira
  weapon: 'STACCATO' as WeaponId,
  shield: 0, // 0 | 25 | 50
  carrying: true, // carregando o Diapasão
  planted: false, // Diapasão plantado
  plantProgress: 0, // 0..1 do canal de plantio
  inSite: null as 'A' | 'B' | null, // site em que o jogador está
  chargeEndsAt: 0, // timestamp de conclusão do PULSO
  outcome: null as 'pulse' | 'time' | 'elim' | null, // resultado da rodada em 'end'
  matchWinner: null as 'CORO' | 'DIRAC' | null,
};

// Gancho de automação/diagnóstico: expõe o estado vivo do jogo (usado nos
// testes de runtime do projeto e para debug remoto; inofensivo no jogo).
const g = globalThis as unknown as { __PULSO__?: object };
g.__PULSO__ = { lookState, inputState, roundState, gameStats, playerVitals, settings };

// Tipos de evento que o HUD pode receber do loop de jogo.
export type HudEvent =
  | { type: 'shot' }
  | { type: 'hit'; head: boolean }
  | { type: 'kill'; head: boolean }
  | { type: 'reload' }
  | { type: 'planted'; site: 'A' | 'B' }
  | { type: 'playerHit'; dmg: number; hp: number }
  | { type: 'roundEnd'; outcome: 'pulse' | 'time' | 'elim'; coro: number; dirac: number; dB: number }
  | { type: 'matchOver'; winner: 'CORO' | 'DIRAC' };

// Mini event-bus para efeitos do HUD (pulso da mira, hitmarker etc.)
export const hudEvents = (() => {
  const listeners = new Set<(e: HudEvent) => void>();
  return {
    emit(e: HudEvent) {
      listeners.forEach((fn) => fn(e));
    },
    subscribe(fn: (e: HudEvent) => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
})();
