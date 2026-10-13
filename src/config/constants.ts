// Paleta e tuning central do PULSO — mude aqui, afeta o jogo inteiro.

export const COLORS = {
  BG: 0x0b0f14, // quase-preto azulado (fundo do mundo)
  TEAL: 0x2de2c6, // sinal aliado
  MAGENTA: 0xff3d8e, // sinal hostil
  CRATE: 0x1a2634, // caixotes do cenário
  WALL: 0x1c242e, // concreto do subsolo
  FLOOR: 0x141b23, // piso da estação
  CEIL: 0x0d1218, // teto
  RAIL: 0x3a4652, // trilhos
  TRACER: 0xeafffb, // rastro do tiro
  MUZZLE: 0xbfffe9, // clarão da boca da arma
  IMPACT: 0xffe9c9, // faísca de impacto
} as const;

export const CSS = {
  BG: '#0B0F14',
  TEAL: '#2DE2C6',
  MAGENTA: '#FF3D8E',
  TEXT_DIM: '#7A8B99',
} as const;

// --- mira ---
export const LOOK_SENSITIVITY = 0.0045; // rad por pixel arrastado (base)
export const PITCH_LIMIT = 1.35;

// --- movimento ---
export const MOVE_SPEED = 5.5; // m/s
export const EYE_HEIGHT = 1.7;
export const PLAYER_RADIUS = 0.32; // colisão círculo-vs-parede

// --- zonas de toque ---
export const LEFT_ZONE = 0.4; // 40% da largura da tela = joystick

// --- joystick ---
export const JOY_BASE = 132; // diâmetro da base (px)
export const JOY_KNOB = 60; // diâmetro do knob (px)
export const JOY_RADIUS = 52; // deslocamento máximo do knob (px)

// --- feedback de tiro ---
export const TRACER_MS = 90; // tempo de vida do rastro
export const TRACER_LENGTH = 60; // alcance máximo do rastro (m)
export const MUZZLE_MS = 45; // clarão da boca
export const IMPACT_MS = 70; // faísca no ponto de impacto

// --- arsenal (Etapa 5: economia em dB) ---
export type WeaponId = 'STACCATO' | 'LEGATO';

export interface WeaponSpec {
  name: string;
  MAG: number;
  CADENCE_MS: number;
  RELOAD_MS: number;
  DMG_BODY: number;
  DMG_HEAD: number;
  BURST_RESET_MS: number;
  price: number; // em dB (0 = grátis)
  desc: string;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  STACCATO: {
    name: 'STACCATO',
    MAG: 12,
    CADENCE_MS: 165, // semi (tocar o gatilho), tolerante
    RELOAD_MS: 1500,
    DMG_BODY: 26,
    DMG_HEAD: 78, // 1 tiro na cabeça + 1 no corpo = abate
    BURST_RESET_MS: 220,
    price: 0,
    desc: 'pistola de serviço',
  },
  LEGATO: {
    name: 'LEGATO',
    MAG: 25,
    CADENCE_MS: 100, // 600 rpm automático
    RELOAD_MS: 2200,
    DMG_BODY: 30,
    DMG_HEAD: 120, // headshot = morte instantânea
    BURST_RESET_MS: 250,
    price: 2900,
    desc: 'fuzil de assalto',
  },
};

// --- trajes reforçados (absorvem dano) ---
export const SHIELDS = [
  { id: 0, name: 'SEM TRAJE', price: 0 },
  { id: 25, name: 'TRAJE PARCIAL', price: 400 },
  { id: 50, name: 'TRAJE INTEGRAL', price: 1000 },
] as const;

// --- economia em dB (decibéis de Ressonância) ---
export const ECONOMY = {
  START_DB: 800,
  KILL_DB: 200, // por abate na fase de ação
  WIN_DB: 2900, // rodada vencida
  LOSS_DB: 1900, // rodada perdida
  MAX_DB: 9000,
} as const;

// --- rodadas e o Diapasão ---
export const ROUND = {
  BUY_MS: 10000, // fase de compra
  LIVE_MS: 75000, // fase de ação (sem plant = derrota no tempo)
  END_MS: 5000, // banner de fim de rodada
  CHARGE_MS: 40000, // carga do PULSO após plantar
  PLANT_MS: 3500, // canal de plantação
  ROUNDS_TO_WIN: 7, // primeiro a 7 vence a partida
  SITE_RADIUS: 2.2, // raio da zona de plant (m)
} as const;

export const SITES = {
  A: { x: -13, z: -12.5 }, // teal
  B: { x: 13, z: -12.5 }, // magenta
} as const;

// --- jogador ---
export const PLAYER_HP = 100;

// --- alvos de treino ---
export const TARGET_HP = 100;
export const TARGET_RESPAWN_MS = 3000;

// --- operadores DIRAC (Etapa 6: bots) ---
export const BOTS = {
  COUNT: 3,
  HP: 100,
  PATROL_SPEED: 1.5, // m/s entre waypoints
  STRAFE_SPEED: 1.9, // m/s deslocando em combate
  PERCEIVE_RANGE: 16, // enxerga o jogador até aqui (m)
  FOV_DOT: 0.35, // cosseno do meio-ângulo do cone de visão (~70°)
  HEAR_RANGE: 13, // ouve tiros do jogador até aqui (m)
  REACT_MIN_MS: 420, // reação após te ver
  REACT_MAX_MS: 760,
  BURST_MIN: 3, // tiros por rajada
  BURST_MAX: 6,
  SHOT_MS: 150, // cadência dentro da rajada
  PAUSE_MIN_MS: 800, // pausa entre rajadas
  PAUSE_MAX_MS: 1400,
  DMG: 11, // por acerto (o escudo absorve antes)
  ACC_BASE: 0.52, // precisão a queima-roupa
  ACC_PER_M: 0.015, // queda de precisão por metro
  ACC_MOVE_PENALTY: 0.14, // jogador em movimento
  LOS_EVERY_MS: 180, // intervalo entre checagens de visão
  LOSE_MS: 900, // sem te ver por isto → desiste
} as const;

// --- Traços do agente (Etapa 7) ---
export const TRACOS = {
  CENZURA_USES: 2, // usos por rodada
  CENZURA_BLIND_MS: 2600, // duração da cegueira
  CENZURA_RANGE: 14, // alcance em operadores com linha de visão
  CENZURA_CD_MS: 8000, // intervalo entre usos
  BARREIRA_USES: 1, // usos por rodada
  BARREIRA_LIFE_MS: 5000, // duração do muro de ressonância
  BARREIRA_WIDTH: 4, // m
  BARREIRA_HEIGHT: 2.6, // m
  BARREIRA_DIST: 3.2, // distância erguida à frente do jogador
} as const;

// --- silenciar o Diapasão (retake DIRAC, Etapa 7) ---
export const DEFUSE = {
  MS: 7000, // canal de silenciamento (interrompível por dano)
  RADIUS: 1.4, // distância do Diapasão para silenciar
  RETAKE_SPEED: 2.1, // m/s correndo de volta ao site
} as const;
