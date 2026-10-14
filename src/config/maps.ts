// Definições de mapa do PULSO (Etapa 14 — conteúdo e longevidade).
//
// Tudo que é GEOMETRIA DE JOGO específica de um mapa vive aqui: limites do
// mundo, sites de plantio, spawn do CORO, alvos de aquecimento, rotas de
// patrulha dos DIRACs, âncoras de retake, postos de defesa dos aliados e os
// caminhos provados spawn → site. As CENAS (SubsoloScene, PalcoScene) só
// cuidam da direção de arte; a IA e o minimapa consomem estes dados.
//
// Convenção de orientação (vale para os dois mapas):
//   norte = -Z (sites) · sul = +Z (spawn CORO) · oeste = -X (site A) ·
//   leste = +X (site B). O retake decide o lado pelo sinal de x.
// Waypoints ficam SEMPRE em áreas abertas — as rotas não cruzam paredes
// (deslizes e "preso → próximo waypoint" cobrem os cantos).

export type MapId = 'SUBSOLO' | 'PALCO' | 'ESTUDIO';

// ------------------------------------------------------------------ CLIMA
// Etapa 17 — variantes de mapa. O clima NÃO é só cosmético: corta a
// percepção dos DIRACs (noite/neblina) e dilata a reação deles. A direção
// de arte por variante vive nas CENAS (fog/luzes por clima); os números de
// combate vivem aqui (o BotSquad consome via setWeather).
export type WeatherId = 'PADRAO' | 'NOITE' | 'NEBLINA';

export interface WeatherDef {
  id: WeatherId;
  nome: string;
  glyph: string;
  tagline: string;
  corCss: string;
  /** multiplicador do alcance de percepção dos DIRACs */
  perceiveMul: number;
  /** multiplicador do alcance de audição dos DIRACs */
  hearMul: number;
  /** reação extra (ms) somada à janela deles */
  reactAddMs: number;
}

export const WEATHERS: Record<WeatherId, WeatherDef> = {
  PADRAO: {
    id: 'PADRAO',
    nome: 'PADRÃO',
    glyph: '◦',
    tagline: 'operação limpa · visão cheia',
    corCss: '#CFE2EA',
    perceiveMul: 1,
    hearMul: 1,
    reactAddMs: 0,
  },
  NOITE: {
    id: 'NOITE',
    nome: 'NOITE',
    glyph: '☾',
    tagline: 'blecaute da estação · DIRACs enxergam menos',
    corCss: '#9FD8E8',
    perceiveMul: 0.8,
    hearMul: 0.9,
    reactAddMs: 90,
  },
  NEBLINA: {
    id: 'NEBLINA',
    nome: 'NEBLINA',
    glyph: '≋',
    tagline: 'vapor nos túneis · curto alcance para todos',
    corCss: '#8FB7C9',
    perceiveMul: 0.62,
    hearMul: 0.72,
    reactAddMs: 160,
  },
};

export const WEATHER_ORDER: WeatherId[] = ['PADRAO', 'NOITE', 'NEBLINA'];

export interface MapSite {
  x: number;
  z: number;
}

export interface MapDef {
  id: MapId;
  /** nome curto (HUD, seletor) */
  nome: string;
  /** uma linha de sabor para o seletor de mapa */
  tagline: string;
  bio: string;
  corCss: string;
  /** limites do mundo: x ∈ [-W/2, W/2], z ∈ [-H/2, H/2] (minimapa) */
  world: { W: number; H: number };
  /** sites de plantio (A = oeste/teal, B = leste/magenta) */
  sites: { A: MapSite; B: MapSite };
  /** spawn do CORO (jogador + formação do esquadrão) */
  spawn: [number, number];
  /** bonecos de treino (aquecimento perto do spawn) */
  targets: Array<[number, number]>;
  /** rotas de patrulha dos DIRACs — BOTS.COUNT rotas, waypoints abertos */
  botRoutes: Array<Array<[number, number]>>;
  /** âncoras do retake DIRAC (e do desvio de quem vem do lado oposto) */
  retake: {
    mid: [number, number];
    anchor: Record<'A' | 'B', [number, number]>;
  };
  /** postos de defesa dos aliados quando o Diapasão está plantado */
  holdSlots: Record<'A' | 'B', Array<[number, number]>>;
  /** caminho provado spawn → site (portador do Diapasão segue isto) */
  carry: Record<'A' | 'B', Array<[number, number]>>;
}

export const MAPS: Record<MapId, MapDef> = {
  // ------------------------------------------------------------------
  SUBSOLO: {
    id: 'SUBSOLO',
    nome: 'SUBSOLO',
    tagline: 'estação desativada · 40×32',
    bio: 'túneis simétricos de concreto, três lanes claras e corredores curtos — o clássico',
    corCss: '#2DE2C6',
    world: { W: 40, H: 32 },
    sites: {
      A: { x: -13, z: -12.5 },
      B: { x: 13, z: -12.5 },
    },
    spawn: [0, 12.5],
    targets: [
      [3, 10.5],
      [-3.5, 11.5],
    ],
    botRoutes: [
      [
        [-13, -10.6],
        [-11.4, -13],
        [-14.6, -12.6],
      ],
      [
        [13, -10.6],
        [11.4, -13],
        [14.6, -12.6],
      ],
      [
        [0, -4.2],
        [-4.4, -5.6],
        [0, -8.6],
        [4.4, -5.6],
      ],
      [
        [-12.5, 6],
        [-12.5, -2],
        [-12, -8],
      ],
      [
        [12.5, 6],
        [12.5, -2],
        [12, -8],
      ],
    ],
    retake: {
      mid: [0, -8.6],
      anchor: {
        A: [-10.5, -9.5],
        B: [10.5, -9.5],
      },
    },
    holdSlots: {
      A: [
        [-15.6, -10.3],
        [-10.4, -10.3],
        [-13, -9.3],
        [-17.6, -11.5],
      ],
      B: [
        [15.6, -10.3],
        [10.4, -10.3],
        [13, -9.3],
        [17.6, -11.5],
      ],
    },
    carry: {
      A: [[-10.5, -9.5]],
      B: [[10.5, -9.5]],
    },
  },

  // ------------------------------------------------------------------
  // PALCO — casa de espetáculos desativada (44×34). Assimétrico:
  // o FOYER ao sul vira o mapa por três portas; a PLATEIA central é
  // atravessada por fileiras de poltronas; a oeste ficam os CAMARINS
  // (salinha com porta) e o CAMAROTE A; a leste a GALERIA; e o site B
  // fica EM CIMA do palco, protegido por uma mureta baixa de 1,1m — dá
  // pra atirar por cima à distância, mas só se passa pelo vão lateral.
  PALCO: {
    id: 'PALCO',
    nome: 'PALCO',
    tagline: 'casa de espetáculos · 44×34',
    bio: 'plateia coberta de poltronas, camarins a oeste e o site B em cima do palco atrás de uma mureta baixa',
    corCss: '#FFB454',
    world: { W: 44, H: 34 },
    sites: {
      A: { x: -15, z: -11 }, // CAMAROTE (oeste)
      B: { x: 11, z: -11 }, // em cima do PALCO (leste)
    },
    spawn: [0, 13.5], // foyer, de frente pra porta central
    targets: [
      [5, 13],
      [-5, 13],
    ],
    // 1: triângulo no CAMAROTE A · 2: triângulo no palco B · 3: volta
    // pela plateia (corredor central) · 4: camarins · 5: galeria.
    botRoutes: [
      [
        [-15, -9.5],
        [-12.5, -12.5],
        [-17.5, -12],
      ],
      [
        [12, -9.5],
        [9, -12.5],
        [15, -12],
      ],
      [
        [0, -5],
        [-11, 2],
        [0, 6.5],
        [10, 4],
      ],
      [
        [-16, 7],
        [-16, 3],
        [-15.5, -0.5],
        [-17, -4],
      ],
      [
        [20.5, 6.5],
        [20.5, 0],
        [17.2, -4.8],
      ],
    ],
    // âncora A: sul da entrada oeste do CAMAROTE (muro C termina em
    // x = -10) · âncora B: alinhada com o vão do palco para a linha reta
    // até a carga atravessar entre o muro C e a mureta.
    retake: {
      mid: [0, 1],
      anchor: {
        A: [-13, -5.5],
        B: [0.2, -6],
      },
    },
    holdSlots: {
      A: [
        [-18.5, -9],
        [-11.5, -9],
        [-15, -8.2],
        [-19, -13],
      ],
      B: [
        [14.5, -9],
        [7.5, -9],
        [11, -8.5],
        [18, -13],
      ],
    },
    // caminho provado: porta central do foyer → plateia → site.
    // (o B desce pelo vão entre o muro C e a mureta do palco)
    carry: {
      A: [
        [-1.5, 12],
        [-1.5, 7],
        [-13, -5.5],
      ],
      B: [
        [1.5, 12],
        [1.5, 7],
        [2, -5],
        [2, -10],
      ],
    },
  },

  // ------------------------------------------------------------------
  // ESTÚDIO — complexo de gravação desativado (36×28, Etapa 18).
  // O mapa "fechado": salas em vez de lanes. A RECEPÇÃO ao sul abre para
  // a MISTURA (console no centro); a oeste e a leste ficam os LOBBIES
  // com as portas das SALAS DE GRAVAÇÃO (sites); e no centro-norte,
  // entre os dois sites, fica o CONTROLE — uma CAIXA DE VIDRO: vê-se
  // os dois sites através dos vidros, mas balas e DIRACs não passam.
  ESTUDIO: {
    id: 'ESTUDIO',
    nome: 'ESTÚDIO',
    tagline: 'complexo de gravação · 36×28',
    bio: 'salas tratadas com espuma, console na mistura e o CONTROLE: uma caixa de vidro entre os sites que enxerga tudo',
    corCss: '#F2C94C',
    world: { W: 36, H: 28 },
    sites: {
      A: { x: -12.5, z: -10.5 }, // SALA A (oeste)
      B: { x: 12.5, z: -10.5 }, // SALA B (leste)
    },
    spawn: [0, 11.5], // recepção, de frente para o console
    targets: [
      [-3.5, 12.5],
      [4, 12],
    ],
    // 1: triângulo na SALA A · 2: triângulo na SALA B · 3: CONTROLE ⇄
    // MISTURA pela porta central · 4: lobby oeste → recepção · 5: leste.
    botRoutes: [
      [
        [-12.5, -11.8],
        [-15.8, -8.2],
        [-9.2, -8.2],
      ],
      [
        [12.5, -11.8],
        [15.8, -8.2],
        [9.2, -8.2],
      ],
      [
        [0, -10],
        [0, -3],
      ],
      [
        [-13, -3.2],
        [-13, 4],
        [-8, 10],
      ],
      [
        [13, -3.2],
        [13, 4],
        [8, 10],
      ],
    ],
    // âncora A/B: em frente à porta de cada sala (no lobby), linha reta
    // até o site atravessando o vão da porta; mid: entre o console e a
    // porta do CONTROLE.
    retake: {
      mid: [0, -4.8],
      anchor: {
        A: [-12, -3.5],
        B: [12, -3.5],
      },
    },
    holdSlots: {
      A: [
        [-16.2, -11],
        [-8.8, -11],
        [-12.5, -8],
        [-16.8, -13.2],
      ],
      B: [
        [16.2, -11],
        [8.8, -11],
        [12.5, -8],
        [16.8, -13.2],
      ],
    },
    // caminho provado: recepção → lateral → lobby → porta da sala → site.
    carry: {
      A: [
        [-9, 7],
        [-12.5, -2.5],
        [-12, -7.5],
      ],
      B: [
        [9, 7],
        [12.5, -2.5],
        [12, -7.5],
      ],
    },
  },
};
