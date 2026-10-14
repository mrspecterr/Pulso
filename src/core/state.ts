// Ponte de estado entre o loop 3D (three.js, roda a cada frame) e o HUD
// (React Native). O loop escreve; o HUD lê por polling — sem re-render
// de componente a cada frame.

import type { AgentId, QualityId, TracoKey, WeaponId } from '../config/constants';
import type { MapId, WeatherId } from '../config/maps';
import { Animated } from 'react-native';
import { TRACOS } from '../config/constants';

export const lookState = { yaw: 0, pitch: 0 };

export const inputState = {
  moveX: 0, // strafe -1..1 (esquerda/direita)
  moveZ: 0, // frente -1..1 (baixo/cima do joystick)
  firing: false, // botão de tiro pressionado (segurar = automático)
  reloadQueued: false, // HUD pede recarga; o loop consome
  plantHeld: false, // botão PLANTAR pressionado (canal de plantio)
  readyQueued: false, // HUD pede para encerrar a fase de compra
  restartQueued: false, // HUD pede reinício da partida (fim de jogo)
  tracoQueued: null as TracoKey | null, // Traço pedido pelo HUD
  agentSelectQueued: false, // HUD pede para voltar à seleção de agente
};

// Sessão (Etapa 8): o agente escolhido antes da partida; persiste entre
// rodadas e só muda passando pela tela de seleção. Etapa 14: o MAPA da
// sessão vive aqui também. Etapa 16: o MODO — 'partida' (5v5 por rodadas)
// ou 'treino' (campo de provas: dB infinito, arsenal aberto, sem rodadas).
// Etapa 17: o CLIMA — variante de mapa (arte + números de combate).
export type SessionMode = 'partida' | 'treino';

export const sessionState = {
  agent: 'MUDO' as AgentId,
  map: 'SUBSOLO' as MapId,
  mode: 'partida' as SessionMode,
  weather: 'PADRAO' as WeatherId,
};

// Estado de UI fora do loop (Etapa 16): painel ARSENAL do campo de provas.
// A camada de input não é dona disto — o HUD lê por polling como todo o resto.
export const uiState = {
  trainMenuOpen: false, // loja aberta no meio do treino
};

export const settings = {
  sensMultiplier: 1, // 0.7 | 1 | 1.5 | 2 (Etapa 15: BAIXA entra no ciclo)
  quality: 'MEDIO' as QualityId, // Etapa 10: pipeline de desempenho
  volume: 1, // Etapa 11: volume do áudio (1 | 0.5 | 0)
  haptics: true, // Etapa 15: vibração dos eventos (ligado por padrão)
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
  enemiesAlive: 5, // operadores DIRAC em campo (Etapa 6 · 5 na Etapa 12)
  alliesAlive: 4, // esquadrão CORO em campo (Etapa 12)
  allyMask: '1111', // quem está vivo: '1010' = 1º e 3º caídos
  defusing: false, // um DIRAC está silenciando o Diapasão (Etapa 7)
  defuseProgress: 0, // 0..1 do canal de silenciamento
  fps: 0, // média móvel do quadro (Etapa 10: diagnóstico de desempenho)
  drawCalls: 0, // draw calls do último frame (diagnóstico)
};

// Traços do agente (Etapa 7/8) — usos por rodada + recarga, por Traço.
// Apenas as chaves do kit do agente atual são relevantes; as outras
// ficam zeradas (sem efeito).
export const tracoState = {
  uses: {
    cenzura: TRACOS.CENZURA_USES,
    barreira: TRACOS.BARREIRA_USES,
    surdina: TRACOS.SURDINA_USES,
    impulso: TRACOS.IMPULSO_USES,
    sonar: TRACOS.SONAR_USES,
    marca: TRACOS.MARCA_USES,
    couraca: TRACOS.COURACA_USES,
    onda: TRACOS.ONDA_USES,
    postura: TRACOS.POSTURA_USES,
    cadencia: TRACOS.CADENCIA_USES,
    ritardando: TRACOS.RITARDANDO_USES,
    acorde: TRACOS.ACORDE_USES,
  } as Record<TracoKey, number>,
  readyAt: {
    cenzura: 0,
    barreira: 0,
    surdina: 0,
    impulso: 0,
    sonar: 0,
    marca: 0,
    couraca: 0,
    onda: 0,
    postura: 0,
    cadencia: 0,
    ritardando: 0,
    acorde: 0,
  } as Record<TracoKey, number>,
};

// Vitais do jogador (Etapa 5 — ainda sem fontes de dano, estrutura pronta).
export const playerVitals = {
  hp: 100,
  shield: 0, // escudo comprado (traje), dura a rodada
  shieldBonus: 0, // escudo temporal da COURAÇA (GRAVE)
  shieldBonusUntil: 0, // timestamp em que a COURAÇA expira
  regenUntil: 0, // CADÊNCIA (VIBRATO, Etapa 16): regenera até este timestamp
  regenPerSec: 0, // vida por segundo enquanto reafina
};

// ACORDE (VIBRATO, Etapa 17): escudo harmônico — enquanto ativo, o dano que
// chega ao jogador E aos aliados é multiplicado (combatModifiers.guardMul).
// O Allies.damage lê isto no canal de dano; a expiração rola no loop do Game.
export const combatModifiers = {
  guardUntil: 0, // ACORDE ativo até este timestamp
  guardMul: TRACOS.ACORDE_MUL, // multiplicador do dano recebido
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
  plantSite: null as 'A' | 'B' | null, // site do Diapasão plantado
  plantProgress: 0, // 0..1 do canal de plantio
  inSite: null as 'A' | 'B' | null, // site em que o jogador está
  chargeEndsAt: 0, // timestamp de conclusão do PULSO
  outcome: null as 'pulse' | 'time' | 'elim' | 'silenced' | 'sweep' | null, // resultado em 'end'
  matchWinner: null as 'CORO' | 'DIRAC' | null,
  spectating: false, // jogador caído, o esquadrão luta por ele (Etapa 12)
  diracLevel: 0, // nível de ameaça DIRAC desta rodada (Etapa 13)
  carrierAlly: null as number | null, // aliado com o Diapasão (Etapa 13)
};

// Minimapa tático (Etapa 13) — escrito pelo loop a cada quadro (números
// simples e slots fixos, sem alocação), lido pelo componente por polling.
// Inimigo aparece só quando "acende" (atirou, levou dano ou foi revelado
// pelo SONAR) — não é wallhack.
export interface MiniBlip {
  x: number;
  z: number;
  alive: boolean;
  show: boolean; // inimigos: visível no minimapa agora
}

export const minimapState = {
  px: 0,
  pz: 12.5,
  yaw: 0,
  // geometria do mapa da sessão (Etapa 14) — o Game preenche ao montar
  worldW: 40,
  worldH: 32,
  siteA: { x: -13, z: -12.5 },
  siteB: { x: 13, z: -12.5 },
  allies: [
    { x: 0, z: 0, alive: true, show: true },
    { x: 0, z: 0, alive: true, show: true },
    { x: 0, z: 0, alive: true, show: true },
    { x: 0, z: 0, alive: true, show: true },
  ] as MiniBlip[],
  enemies: [
    { x: 0, z: 0, alive: true, show: false },
    { x: 0, z: 0, alive: true, show: false },
    { x: 0, z: 0, alive: true, show: false },
    { x: 0, z: 0, alive: true, show: false },
    { x: 0, z: 0, alive: true, show: false },
  ] as MiniBlip[],
  planted: null as 'A' | 'B' | null,
  carrierIdx: -1, // aliado com o Diapasão (-1 = ninguém)
  walls: [] as Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>,
};

// Placar de combate da rodada (Etapa 13) — abates por nome de operador,
// alimentado pelo kill feed e zerado no início de cada rodada.
export const scoreboard = {
  kills: {} as Record<string, number>,
};

// Estatísticas da PARTIDA além do tiro (Etapa 17): plantios do jogador e
// quedas — o que a carreira, as missões diárias e as conquistas consomem.
// Zerado no início de cada partida (junto com gameStats) e lido no fim.
export const matchStats = {
  plants: 0, // vezes que ESTE jogador plantou o Diapasão
  deaths: 0, // vezes que caiu
};

// Visual do joystick (Etapa 10): valores Animated module-level — a camada
// de input escreve, o componente visual apenas lê. Nenhum re-render.
export const joyVisual = {
  base: new Animated.ValueXY({ x: 0, y: 0 }), // canto sup. esq. da base (px)
  knob: new Animated.ValueXY({ x: 0, y: 0 }), // offset do knob
  opacity: new Animated.Value(0),
  active: false, // há dedo no joystick (leitura imperativa)
};

// Gancho de automação/diagnóstico: expõe o estado vivo do jogo (usado nos
// testes de runtime do projeto e para debug remoto; inofensivo no jogo).
const g = globalThis as unknown as { __PULSO__?: object };
g.__PULSO__ = { lookState, inputState, roundState, gameStats, matchStats, playerVitals, settings, tracoState };

// Tipos de evento que o HUD pode receber do loop de jogo.
export type HudEvent =
  | { type: 'shot' }
  | { type: 'hit'; head: boolean }
  | { type: 'kill'; head: boolean }
  | { type: 'reload' }
  | { type: 'planted'; site: 'A' | 'B'; by: 'player' | 'ally' }
  | { type: 'playerHit'; dmg: number; hp: number }
  | { type: 'traco'; kind: TracoKey } // Traço executado (Etapa 7/8)
  | { type: 'roundEnd'; outcome: 'pulse' | 'time' | 'elim' | 'silenced' | 'sweep'; coro: number; dirac: number; dB: number }
  | { type: 'matchOver'; winner: 'CORO' | 'DIRAC' }
  | { type: 'backToSelect' } // partida encerrada → seleção de agente (Etapa 8)
  | { type: 'plantTick' } // canal de plantio em andamento (Etapa 11)
  | { type: 'botShot'; dist: number } // um DIRAC/aliado disparou a esta distância (Etapa 11/12)
  | { type: 'dry' } // gatilho no vazio (Etapa 11)
  | { type: 'reloadDone' } // recarga concluída (Etapa 11)
  | { type: 'feed'; killer: string; victim: string } // kill feed 5v5 (Etapa 12);

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
