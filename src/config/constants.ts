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

// --- botões de gameplay (Etapa 10: posições ÚNICAS para visual e para o
// hit-test da camada de input — os dois nunca divergem) ---
// Âncoras right/bottom em px, iguais às das folhas de estilo dos botões.
export const BTN = {
  FIRE: { right: 34, bottom: 30, size: 92 },
  RELOAD: { right: 142, bottom: 38, size: 64 },
  // luneta da FERMATA (Etapa 24): acima da recarga — só existe com o rifle
  // em mãos; a zona de PLANTAR (que fica logo acima) é verificada antes
  SCOPE: { right: 142, bottom: 118, size: 56 },
  // dois Traços, empilhados acima da munição
  TRACO1: { right: 34, bottom: 208, w: 72, h: 72 },
  TRACO2: { right: 34, bottom: 290, w: 72, h: 72 },
  // terceiro Traço (Etapa 17): à esquerda do primeiro — o "L" do kit
  TRACO3: { right: 118, bottom: 208, w: 72, h: 72 },
  // canal de plantio (retângulo ~150×68)
  PLANT: { right: 150, bottom: 128, w: 150, h: 68 },
  // sensibilidade, qualidade e som — coluna ESQUERDA, abaixo das vitais do HUD
  // (verificadas antes da zona do joystick, que cobre toda a metade esquerda)
  SENS: { left: 22, top: 150, w: 104, h: 34 },
  GRAF: { left: 22, top: 192, w: 104, h: 34 },
  SND: { left: 22, top: 234, w: 104, h: 34 }, // Etapa 11: volume do áudio
} as const;

// folga extra ao redor do centro do botão para o hit-test (tolerância de
// dedo em tela — os círculos de toque ficam maiores que o desenho)
export const BTN_PAD = 14;

// --- joystick ---
export const JOY_BASE = 132; // diâmetro da base (px)
export const JOY_KNOB = 60; // diâmetro do knob (px)
export const JOY_RADIUS = 52; // deslocamento máximo do knob (px)

// --- feedback de tiro ---
export const TRACER_MS = 90; // tempo de vida do rastro
export const TRACER_LENGTH = 60; // alcance máximo do rastro (m)
export const MUZZLE_MS = 45; // clarão da boca
export const IMPACT_MS = 70; // faísca no ponto de impacto

// --- arsenal (Etapa 5: economia em dB · Etapa 16: GLISSANDO · Etapa 24: arsenal vivo) ---
export type WeaponId = 'STACCATO' | 'TREMOLANDO' | 'GLISSANDO' | 'LEGATO' | 'FERMATA';

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
  /** balins por disparo (1 = bala única). GLISSANDO: 8. */
  PELLETS: number;
  /** dispersão do cone de balins (graus de meia-ângulo). 0 = sem dispersão. */
  SPREAD_DEG: number;
  /** Etapa 24: FOV da luneta (apenas a FERMATA mira por ótica). 0 = sem luneta. */
  ZOOM_FOV: number;
  /** Etapa 24: cone de erro ao atirar SEM a luneta (graus). 0 = sempre precisa. */
  HIP_SPREAD_DEG: number;
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
    PELLETS: 1,
    SPREAD_DEG: 0,
    ZOOM_FOV: 0,
    HIP_SPREAD_DEG: 0,
  },
  TREMOLANDO: {
    name: 'TREMOLANDO',
    MAG: 32,
    CADENCE_MS: 75, // 800 rpm: a nota repetida
    RELOAD_MS: 1900,
    DMG_BODY: 20,
    DMG_HEAD: 52, // 2 na cabeça fecham — recompensa o tracking
    BURST_RESET_MS: 200,
    price: 1600,
    desc: 'submetralhadora',
    PELLETS: 1,
    SPREAD_DEG: 0,
    ZOOM_FOV: 0,
    HIP_SPREAD_DEG: 0,
  },
  GLISSANDO: {
    name: 'GLISSANDO',
    MAG: 6,
    CADENCE_MS: 850, // corredera: um tiro por bombeamento
    RELOAD_MS: 3000,
    DMG_BODY: 9, // por balim — 8 no corpo a queima-roupa = 72
    DMG_HEAD: 16, // 8 na cabeça = abate à queima-roupa
    BURST_RESET_MS: 700,
    price: 2100,
    desc: 'escopeta de corredera',
    PELLETS: 8,
    SPREAD_DEG: 2.8, // cone de dispersão (fecha a partir do 3º tiro)
    ZOOM_FOV: 0,
    HIP_SPREAD_DEG: 0,
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
    PELLETS: 1,
    SPREAD_DEG: 0,
    ZOOM_FOV: 0,
    HIP_SPREAD_DEG: 0,
  },
  FERMATA: {
    name: 'FERMATA',
    MAG: 3,
    CADENCE_MS: 1500, // ferrolho: uma nota longa por vez
    RELOAD_MS: 3800,
    DMG_BODY: 140, // mata sem traje e com traje parcial; INTEGRAL resiste com 10
    DMG_HEAD: 260, // na cabeça não há traje que segure
    BURST_RESET_MS: 1600, // cada tiro é um primeiro tiro
    price: 4500,
    desc: 'rifle de precisão',
    PELLETS: 1,
    SPREAD_DEG: 0,
    ZOOM_FOV: 32, // luneta: FOV 75 → 32
    HIP_SPREAD_DEG: 6.5, // no quadril, o cano cospra pra todo lado
  },
};

// --- luneta da FERMATA (Etapa 24) ---
// Multiplicadores vigentes ENQUANTO a ótica está aberta: a mira por arrasto
// fica lenta (precisão fina), o passo encolhe (operador fincado) e a viewmodel
// some (o retículo da HUD é a mira de verdade).
export const SCOPE = {
  SENS_MUL: 0.42, // 75° → 32° de FOV: ~2,3× menos mundo, mesma manobra
  MOVE_MUL: 0.5, // andar de luneta aberta
} as const;

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

// (sites, limites do mundo, spawn e rotas por mapa: ver config/maps.ts — Etapa 14)

// --- jogador ---
export const PLAYER_HP = 100;

// --- alvos de treino ---
export const TARGET_HP = 100;
export const TARGET_RESPAWN_MS = 3000;

// --- operadores DIRAC (Etapa 6: bots · Etapa 12: 5v5) ---
export const BOTS = {
  COUNT: 5,
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

// --- esquadrão CORO (Etapa 12: aliados IA 5v5) ---
export const ALLIES = {
  COUNT: 4,
  HP: 100,
  SPEED: 5.2, // m/s seguindo a formação
  CATCHUP_SPEED: 6.4, // m/s quando ficou para trás
  HOLD_SPEED: 4.4, // m/s indo defender o site
  ENGAGE_DIST: 26, // enxerga um DIRAC até aqui (m)
  REACT_MIN_MS: 300, // reação após avistar
  REACT_MAX_MS: 560,
  BURST_MIN: 3,
  BURST_MAX: 5,
  SHOT_MS: 130, // cadência dentro da rajada
  PAUSE_MIN_MS: 750,
  PAUSE_MAX_MS: 1300,
  DMG: 20, // por acerto em um DIRAC
  ACC_BASE: 0.55, // precisão a queima-roupa
  ACC_PER_M: 0.014, // queda por metro
  ACC_MOVE_PENALTY: 0.12, // alvo em movimento
  LOS_EVERY_MS: 200,
  LOSE_MS: 1000,
  STRAFE_SPEED: 2.0, // m/s de strafe em combate
  TELEPORT_DIST: 15, // ficou tão atrás do líder → reposiciona na formação
  PING_MS: 2600, // intervalo do "pressentimento" do líder caído
} as const;

// --- Traços (Etapa 7/8) — números por kit ---
export const TRACOS = {
  // MUDO — tático
  CENZURA_USES: 2, // usos por rodada
  CENZURA_BLIND_MS: 2600, // duração da cegueira
  CENZURA_RANGE: 14, // alcance em operadores com linha de visão
  CENZURA_CD_MS: 8000, // intervalo entre usos
  BARREIRA_USES: 1, // usos por rodada
  BARREIRA_LIFE_MS: 5000, // duração do muro de ressonância
  BARREIRA_WIDTH: 4, // m
  BARREIRA_HEIGHT: 2.6, // m
  BARREIRA_DIST: 3.2, // distância erguida à frente do jogador
  SURDINA_USES: 1,
  SURDINA_RANGE: 13, // raio ensurdecido (m)
  SURDINA_MS: 6000, // duração da surdez
  // ECO — batedora
  IMPULSO_USES: 2,
  IMPULSO_DIST: 8.5, // alcance total do arremesso (m)
  IMPULSO_MS: 260, // duração do impulso
  IMPULSO_CD_MS: 9000,
  SONAR_USES: 1,
  SONAR_RANGE: 22, // raio revelado (m)
  SONAR_MS: 5000, // duração da revelação
  MARCA_USES: 2,
  MARCA_MS: 8000, // duração da marcação
  MARCA_FOV_DOT: 0.78, // cosseno do cone de mira da marca (~39°)
  MARCA_RANGE: 34, // alcance do dardo rastreador (m)
  // GRAVE — vanguarda
  COURACA_USES: 1,
  COURACA_SHIELD: 50, // escudo temporal
  COURACA_MS: 10000, // duração do escudo temporal
  ONDA_USES: 1,
  ONDA_RANGE: 6.5, // raio da onda de choque (m)
  ONDA_DMG: 55,
  ONDA_PUSH: 3.5, // empurrão nos operadores (m)
  POSTURA_USES: 1,
  POSTURA_MS: 4500, // duração do cotovelo fincado
  POSTURA_MOVE_MUL: 0.55, // andar devagar é o preço da mira morta
  // VIBRATO — regente (Etapa 16)
  CADENCIA_USES: 1,
  CADENCIA_HEAL: 40, // vida devolvida ao longo do canal
  CADENCIA_MS: 3500, // duração da reafinação (jogador regenera)
  CADENCIA_REGEN: 11.5, // vida por segundo no jogador (≈40 em 3,5s)
  CADENCIA_ALLY_RANGE: 9, // aliados neste raio também são reafinados
  RITARDANDO_USES: 1,
  RITARDANDO_RANGE: 9, // raio do campo de lentidão (m)
  RITARDANDO_MS: 4500, // duração da lentidão
  RITARDANDO_MUL: 0.45, // multiplicador de velocidade dos DIRACs
  RITARDANDO_REACT_MS: 350, // reação extra enquanto o campo segura
  ACORDE_USES: 1,
  ACORDE_MS: 6000, // duração do escudo harmônico
  ACORDE_MUL: 0.65, // multiplicador do dano recebido (esquadrão inteiro)
} as const;

// --- agentes jogáveis (Etapa 8 · VIBRADO Etapa 16 · 3º Traço Etapa 17) ---
export type TracoKey =
  | 'cenzura'
  | 'barreira'
  | 'surdina'
  | 'impulso'
  | 'sonar'
  | 'marca'
  | 'couraca'
  | 'onda'
  | 'postura'
  | 'cadencia'
  | 'ritardando'
  | 'acorde';

export interface TracoSpec {
  key: TracoKey;
  label: string;
  glyph: string; // glifo mostrado no botão e na loja de agentes
  uses: number;
  cdMs: number; // 0 = sem recarga entre usos
  desc: string; // uma linha, linguagem de campo
}

export type AgentId = 'MUDO' | 'ECO' | 'GRAVE' | 'VIBRATO';

export interface AgentSpec {
  nome: AgentId;
  funcao: string; // papel tático no CORO
  cor: number; // cor 3D de destaque
  corCss: string; // mesma cor para o HUD
  bio: string;
  speedMul: number; // multiplicador de MOVE_SPEED (1 = padrão)
  tracos: TracoSpec[]; // 3 Traços por kit (Etapa 17: o terceiro chegou)
}

export const AGENTS: Record<AgentId, AgentSpec> = {
  MUDO: {
    nome: 'MUDO',
    funcao: 'TÁTICO',
    cor: 0x9fd8e8,
    corCss: '#9FD8E8',
    bio: 'engenheiro de acústica que apagou a própria voz; controla o que se ouve no subsolo',
    speedMul: 1,
    tracos: [
      {
        key: 'cenzura',
        label: 'CENZURA',
        glyph: '◈',
        uses: TRACOS.CENZURA_USES,
        cdMs: TRACOS.CENZURA_CD_MS,
        desc: 'cega operadores com linha de visão e interrompe silenciamentos',
      },
      {
        key: 'barreira',
        label: 'BARREIRA',
        glyph: '▤',
        uses: TRACOS.BARREIRA_USES,
        cdMs: 0,
        desc: 'muro de ressonância que bloqueia visão, balas e passagem',
      },
      {
        key: 'surdina',
        label: 'SURDINA',
        glyph: '⌾',
        uses: TRACOS.SURDINA_USES,
        cdMs: 0,
        desc: 'campo que ensurdece DIRACs próximos: tiros não os alertam',
      },
    ],
  },
  ECO: {
    nome: 'ECO',
    funcao: 'BATEDORA',
    cor: COLORS.TEAL,
    corCss: CSS.TEAL,
    bio: 'ex-mensageira dos túneis; ninguém chega antes, ninguém escapa sem ser notada',
    speedMul: 1.1,
    tracos: [
      {
        key: 'impulso',
        label: 'IMPULSO',
        glyph: '⇢',
        uses: TRACOS.IMPULSO_USES,
        cdMs: TRACOS.IMPULSO_CD_MS,
        desc: 'arremesso de ressonância na direção do movimento',
      },
      {
        key: 'sonar',
        label: 'SONAR',
        glyph: '◎',
        uses: TRACOS.SONAR_USES,
        cdMs: 0,
        desc: 'revela operadores próximos através das paredes',
      },
      {
        key: 'marca',
        label: 'MARCA',
        glyph: '◉',
        uses: TRACOS.MARCA_USES,
        cdMs: 0,
        desc: 'dardo rastreador: marca o alvo na mira no minimapa',
      },
    ],
  },
  GRAVE: {
    nome: 'GRAVE',
    funcao: 'VANGUARDA',
    cor: 0xffb454,
    corCss: '#FFB454',
    bio: 'sonoplasta de obras pesadas; entra primeiro, de escudo erguido, e abre caminho',
    speedMul: 0.94,
    tracos: [
      {
        key: 'couraca',
        label: 'COURAÇA',
        glyph: '⛨',
        uses: TRACOS.COURACA_USES,
        cdMs: 0,
        desc: 'escudo temporal de 50 que absorve dano por 10s',
      },
      {
        key: 'onda',
        label: 'ONDA',
        glyph: '✸',
        uses: TRACOS.ONDA_USES,
        cdMs: 0,
        desc: 'detonação que fere e arremessa operadores ao redor',
      },
      {
        key: 'postura',
        label: 'POSTURA',
        glyph: '◫',
        uses: TRACOS.POSTURA_USES,
        cdMs: 0,
        desc: 'finca o cotovelo: zero dispersão por 4,5s — mas anda devagar',
      },
    ],
  },
  VIBRATO: {
    nome: 'VIBRATO',
    funcao: 'REGENTE',
    cor: 0xb48cff,
    corCss: '#B48CFF',
    bio: 'regente de campo do CORO; reafina vozes gastas e desacelera o que vem pesado',
    speedMul: 1.02,
    tracos: [
      {
        key: 'cadencia',
        label: 'CADÊNCIA',
        glyph: '♪',
        uses: TRACOS.CADENCIA_USES,
        cdMs: 0,
        desc: 'reafina o esquadrão: +40 de vida ao longo de 3,5s',
      },
      {
        key: 'ritardando',
        label: 'RITARDANDO',
        glyph: '◐',
        uses: TRACOS.RITARDANDO_USES,
        cdMs: 0,
        desc: 'campo que desacelera DIRACs próximos por 4,5s',
      },
      {
        key: 'acorde',
        label: 'ACORDE',
        glyph: '❖',
        uses: TRACOS.ACORDE_USES,
        cdMs: 0,
        desc: 'escudo harmônico: −35% de dano em você e no esquadrão',
      },
    ],
  },
};

// --- silenciar o Diapasão (retake DIRAC, Etapa 7) ---
export const DEFUSE = {
  MS: 7000, // canal de silenciamento (interrompível por dano)
  RADIUS: 1.4, // distância do Diapasão para silenciar
  RETAKE_SPEED: 2.1, // m/s correndo de volta ao site
} as const;

// --- dificuldade escalonada dos DIRACs (Etapa 13) ---
// Os DIRACs se adaptam: cada ponto DIRAC no placar deixa o esquadrão
// inimigo um nível mais afiado (precisão, reação, dano, percepção e
// retake). A partida se equilibra sozinha — abrir vantagem exige mais
// do CORO a cada rodada.
export const DIFFICULTY = {
  MAX_LEVEL: 6, // teto de ameaça (pontos DIRAC acima disto não somam)
  ACC_PER_LEVEL: 0.028, // +precisão base
  REACT_MS_PER_LEVEL: 45, // -tempo de reação
  DMG_PER_LEVEL: 0.5, // +dano por bala
  PERCEIVE_PER_LEVEL: 0.6, // +alcance de percepção (m)
  RETAKE_PER_LEVEL: 0.12, // +velocidade do retake (m/s)
} as const;

// --- qualidade de render (Etapa 10: desempenho) ---
// O mundo 3D é desenhado num alvo de resolução reduzido e esticado para a
// tela — o HUD nativo continua nítido. Sombras: mapa menor e atualizado a
// 20 Hz (imperceptível) em vez de todo frame.
export type QualityId = 'FLUIDO' | 'MEDIO' | 'NITIDO';

export interface QualitySpec {
  id: QualityId;
  label: string; // mostrado no botão GRAF do HUD
  scale: number; // escala do alvo de render (0..1)
  shadows: boolean; // sombras dinâmicas ligadas?
  shadowSize: number; // lado do mapa de sombra (px)
}

export const QUALITY: Record<QualityId, QualitySpec> = {
  FLUIDO: { id: 'FLUIDO', label: 'FLUIDO', scale: 0.55, shadows: false, shadowSize: 512 },
  MEDIO: { id: 'MEDIO', label: 'MÉDIO', scale: 0.72, shadows: true, shadowSize: 1024 },
  NITIDO: { id: 'NITIDO', label: 'NÍTIDO', scale: 1, shadows: true, shadowSize: 2048 },
} as const;

export const QUALITY_ORDER: QualityId[] = ['FLUIDO', 'MEDIO', 'NITIDO'];

// --- CAMPO DE PROVAS (Etapa 16 — modo treino) ---
export const TRAINING = {
  RESPAWN_MS: 1500, // caído → volta ao spawn com kit recarregado
} as const;

// --- botão do 3º Traço (Etapa 17) ---
// A pilha à direita (TRACO1/TRACO2, de baixo para cima) não cabe um terceiro
// degrau em telas 390px — o terceiro botão abre para a ESQUERDA na base da
// pilha, formando um "L" com o primeiro. O hit-test da camada de input usa
// as mesmas âncoras (nunca divergem).
