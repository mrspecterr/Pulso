// Texturas procedurais do PULSO — geradas em JS puro (Uint8Array → DataTexture).
//
// Por quê: não existe <canvas> 2D no React Native e carregar PNGs exigiria
// pipeline de assets externo. DataTexture funciona em QUALQUER lugar (inclusive
// no WebGL1 do expo-gl nativo) e nos dá texturas de graça, determinísticas e
// sem peso no APK.
//
// Tudo aqui é power-of-two (256/512/64) para mipmaps funcionarem no WebGL1,
// e os ruídos são PERIÓDICOS (wrap) para o ladrilho não emendar visível.

import * as THREE from 'three';

// ---------------------------------------------------------------- rng/noise

/** hash 2D determinístico → [0, 1) */
function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177) | 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Value noise PERIÓDICO: u/v em células; o índice da cela é envolto em
 * `period` células — o padrão emenda perfeito nas bordas da textura.
 */
function vnoiseP(u: number, v: number, seed: number, period: number): number {
  const iu = Math.floor(u);
  const iv = Math.floor(v);
  const fu = u - iu;
  const fv = v - iv;
  const w = (i: number) => ((i % period) + period) % period;
  const iu0 = w(iu);
  const iu1 = w(iu + 1);
  const iv0 = w(iv);
  const iv1 = w(iv + 1);
  const a = hash2(iu0, iv0, seed);
  const b = hash2(iu1, iv0, seed);
  const c = hash2(iu0, iv1, seed);
  const d = hash2(iu1, iv1, seed);
  const su = smooth(fu);
  const sv = smooth(fv);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}

/** fBm periódico — `cells` = celas da textura na oitava base. */
function fbmP(u: number, v: number, seed: number, cells: number, oct = 4): number {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  let c = cells;
  for (let o = 0; o < oct; o++) {
    sum += vnoiseP(u * c, v * c, seed + o * 131, c) * amp;
    norm += amp;
    amp *= 0.5;
    c *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------- helpers

interface FillFn {
  (x: number, y: number, px: Uint8ClampedArray): void;
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

/**
 * Cria uma DataTexture RGBA quadrada com mipmaps/wrap/sRGB configurados.
 * `fill(x, y, px)` recebe coordenadas de PIXEL; px[3] começa em 255.
 */
function makeTex(size: number, fill: FillFn, wrap = true): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const px = new Uint8ClampedArray(4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      px[0] = 0;
      px[1] = 0;
      px[2] = 0;
      px[3] = 255;
      fill(x, y, px);
      const i = (y * size + x) * 4;
      data[i] = px[0];
      data[i + 1] = px[1];
      data[i + 2] = px[2];
      data[i + 3] = px[3];
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  if (wrap) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  } else {
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
  }
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Escala os UVs de uma BoxGeometry para que a textura tenha densidade
 * constante no mundo (1 ladrilho = `tile` metros) em cada face — todas as
 * paredes compartilham UMA textura sem clonar material.
 */
export function scaleBoxUV(
  geo: THREE.BoxGeometry,
  w: number,
  h: number,
  d: number,
  tile: number,
  ox = 0,
  oy = 0
): void {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const dims: Array<[number, number]> = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const su = Math.max(1, Math.round(dims[f][0] / tile));
    const sv = Math.max(1, Math.round(dims[f][1] / tile));
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * su + ox, uv.getY(i) * sv + oy);
    }
  }
  uv.needsUpdate = true;
}

// ---------------------------------------------------------------- texturas

/** Concreto de subsolo: manchas, agregado, veios de sujeira e juntas de fôrma. */
export function concreteTexture(baseHex = 0x5a6169, seed = 7): THREE.DataTexture {
  const [r0, g0, b0] = hexToRgb(baseHex);
  const S = 256;
  return makeTex(S, (x, y, px) => {
    // manchas grandes (4 celas na textura → emenda periódica) + grão fino
    let k = 0.7 + fbmP(x / S, y / S, seed, 4, 5) * 0.55;
    // veios verticais de infiltração
    k *= 0.88 + fbmP(x / S, y / S, seed + 31, 16, 2) * 0.2;
    // agregado (pontinhos)
    const sp = hash2(x, y, seed + 77);
    if (sp > 0.99) k *= 0.6;
    else if (sp < 0.005) k *= 1.3;
    // juntas de fôrma horizontais (duas por textura)
    if (y % 128 < 2) k *= 0.7;
    px[0] = r0 * k;
    px[1] = g0 * k;
    px[2] = b0 * k;
  });
}

/** Piso industrial: lajes com junta, variação por placa, sujeira e riscos. */
export function floorTilesTexture(): THREE.DataTexture {
  const S = 1024;
  const T = 4; // 4×4 placas por textura
  const C = S / T; // 256px por placa → placa de 1m com repeat 4m
  const grout = hexToRgb(0x14171d);
  const plate = hexToRgb(0x4a525e);
  return makeTex(S, (x, y, px) => {
    const g = x % C < 4 || y % C < 4; // junta
    if (g) {
      px[0] = grout[0];
      px[1] = grout[1];
      px[2] = grout[2];
      return;
    }
    const ix = Math.floor(x / C);
    const iy = Math.floor(y / C);
    // variação por placa (forte: quebra a repetição)
    const tv = 0.76 + hash2(ix, iy, 5) * 0.44;
    // sujeira + desgaste
    const dirt = 0.68 + fbmP(x / S, y / S, 11, 8, 4) * 0.42;
    // tráfego: miolo da placa levemente mais claro
    const lx = Math.abs((x % C) - C / 2) / (C / 2);
    const ly = Math.abs((y % C) - C / 2) / (C / 2);
    const wear = 1 - (1 - Math.min(lx, ly)) * 0.1;
    // riscos finos esparsos
    const sc = hash2(x, y, 47);
    const scratch = sc > 0.9975 ? 1.25 : 1;
    const k = tv * dirt * wear * scratch;
    px[0] = plate[0] * k;
    px[1] = plate[1] * k;
    px[2] = plate[2] * k;
  });
}

/** Painel metálico escovado com moldura rebaixada e rebites — ladrilha numa grade. */
export function metalPanelTexture(seed = 3): THREE.DataTexture {
  const S = 256;
  const base = hexToRgb(0x6d747f);
  const B = 18; // borda
  return makeTex(S, (x, y, px) => {
    // escovado horizontal
    let k = 0.84 + fbmP(x / S, y / S, seed, 32, 2) * 0.32;
    // moldura rebaixada
    const onEdge = x < B || y < B || x >= S - B || y >= S - B;
    if (onEdge) k *= 0.58;
    else if (x < B + 3 || y < B + 3 || x >= S - B - 3 || y >= S - B - 3) k *= 1.35;
    // rebites (cantos e meios)
    const rivets: Array<[number, number]> = [
      [B / 2, B / 2],
      [S - B / 2, B / 2],
      [B / 2, S - B / 2],
      [S - B / 2, S - B / 2],
      [S / 2, B / 2],
      [S / 2, S - B / 2],
    ];
    for (const [rx, ry] of rivets) {
      const d = Math.hypot(x - rx, y - ry);
      if (d < 5) k *= 0.45;
      else if (d < 7) k *= 1.45;
    }
    // riscos esparsos
    const sc = hash2(x, y, seed + 91);
    if (sc > 0.9985) k *= 1.5;
    px[0] = base[0] * k;
    px[1] = base[1] * k;
    px[2] = base[2] * k;
  });
}

/** Piso de tábuas (PALCO): veio alongado, tom por tábua, juntas escuras. */
export function woodPlanksTexture(seed = 21): THREE.DataTexture {
  const S = 256;
  const PLANKS = 7; // tábuas por textura
  const base = hexToRgb(0x7d5a3a);
  return makeTex(S, (x, y, px) => {
    const py = Math.floor((y / S) * PLANKS);
    const ty = (y / S) * PLANKS - py;
    // tom da tábua (madeira é heterogênea)
    const tone = 0.78 + hash2(py, 4, seed) * 0.4;
    // veio: fibra longa ao longo da tábua — ruído SÓ em x (v congelado),
    // então a textura emenda perfeita no eixo y
    const grain = 0.84 + vnoiseP((x / S) * 56, 0.5, seed + 3, 56) * 0.26;
    // ruído fino (pontilhado — emenda invisível por ser aleatório)
    const fiber = 0.94 + hash2(x, y, seed + 17) * 0.1;
    let k = tone * grain * fiber;
    // junta entre tábuas (escura)
    if (ty < 0.028) k *= 0.42;
    // nós ocasionais
    const knot = hash2(py, Math.floor(x / 26), seed + 9);
    if (knot > 0.988) k *= 0.68;
    // poeira dos anos
    k *= 0.86 + fbmP(x / S, y / S, seed + 40, 4, 3) * 0.24;
    px[0] = base[0] * k;
    px[1] = base[1] * k;
    px[2] = base[2] * k;
  });
}

/** Veludo da cortina (PALCO): dobras verticais com profundidade senoidal. */
export function curtainTexture(seed = 31): THREE.DataTexture {
  const S = 256;
  const FOLDS = 8; // dobras por textura
  const base = hexToRgb(0x7a2136);
  return makeTex(S, (x, y, px) => {
    const u = x / S;
    const v = y / S;
    // profundidade da dobra: cristas claras, vales escuros
    const s = Math.sin(u * Math.PI * 2 * FOLDS);
    const fold = 0.5 + 0.5 * s * s * (s > 0 ? 1 : 0.55) - 0.25;
    // barbatana: cada dobra tem um realce fino
    const rib = Math.abs(Math.sin(u * Math.PI * 2 * FOLDS + 0.6)) > 0.94 ? 1.18 : 1;
    // pano: ruído suave (18 celas em v = 3 períodos → emenda invisível)
    const cloth = 0.9 + fbmP(u, v * 3, seed, 6, 3) * 0.2;
    const k = (0.52 + fold * 0.72) * rib * cloth;
    px[0] = base[0] * k;
    px[1] = base[1] * k;
    px[2] = base[2] * k;
  });
}

/** Espuma acústica (ESTÚDIO): grade de cunhas diagonais carvão sobre base escura. */
export function foamTexture(seed = 41): THREE.DataTexture {
  const S = 128;
  const P = 32; // período da cunha (divide S → emenda)
  const base = hexToRgb(0x1f2226);
  const wedge = hexToRgb(0x33383f);
  return makeTex(S, (x, y, px) => {
    const u = x / S;
    const v = y / S;
    // dente de serra diagonal 0..1 — cunhas de 45°
    const tri = Math.abs((((x + y) % (2 * P)) + (2 * P)) % (2 * P) - P) / P;
    const wear = 0.8 + fbmP(u, v, seed, 24, 2) * 0.24;
    const k = tri < 0.5 ? 0.85 * wear : 1.08 * wear;
    const src = tri < 0.5 ? base : wedge;
    px[0] = src[0] * k;
    px[1] = src[1] * k;
    px[2] = src[2] * k;
  });
}

/** Faixa de segurança diagonal (amarelo queimado / quase-preto), gasta. */
export function hazardTexture(): THREE.DataTexture {
  const S = 128;
  const P = 64; // período diagonal (divide S → emenda)
  const amber = hexToRgb(0xb98a2f);
  const dark = hexToRgb(0x17191d);
  return makeTex(S, (x, y, px) => {
    const stripe = ((x + y) % P) < P / 2;
    const wear = 0.72 + fbmP(x / S, y / S, 23, 8, 3) * 0.28;
    const src = stripe ? amber : dark;
    px[0] = src[0] * wear;
    px[1] = src[1] * wear;
    px[2] = src[2] * wear;
  });
}

/** Metal escuro de arma: escovado fino com riscos de uso. */
export function gunmetalTexture(seed = 13): THREE.DataTexture {
  const S = 128;
  const base = hexToRgb(0x424852);
  return makeTex(S, (x, y, px) => {
    let k = 0.8 + fbmP(x / S, y / S, seed, 64, 2) * 0.4;
    const sc = hash2(x, y, seed + 5);
    if (sc > 0.996) k *= 1.65; // risco claro
    else if (sc < 0.008) k *= 0.62; // batida
    px[0] = base[0] * k;
    px[1] = base[1] * k;
    px[2] = base[2] * k;
  });
}

/** Feixe de luz vertical (topo claro → base transparente) para shafts fake. */
export function beamTexture(): THREE.DataTexture {
  const W = 32;
  const H = 128;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1); // 0 = base do feixe
    const fade = Math.pow(v, 1.6); // clareia em direção ao topo (v=1)
    for (let x = 0; x < W; x++) {
      // suave nas bordas horizontais
      const ex = 1 - Math.abs(x - (W - 1) / 2) / ((W - 1) / 2);
      const a = fade * Math.pow(ex, 1.4) * 0.5;
      const i = (y * W + x) * 4;
      data[i] = 255;
      data[i + 1] = 252;
      data[i + 2] = 240;
      data[i + 3] = 255 * Math.min(1, Math.max(0, a));
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// fonte 5×7 para as letras dos sites (linhas de cima pra baixo)
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
};

/**
 * Placa de site: letra + moldura em `colorHex` sobre fundo TRANSPARENTE.
 * (row 0 do buffer = v=0 = base da placa; a fonte é desenhada invertida.)
 */
export function letterTexture(ch: 'A' | 'B', colorHex: number): THREE.DataTexture {
  const S = 256;
  const [r, g, b] = hexToRgb(colorHex);
  const cell = 26; // px por célula da fonte → 130×182
  const gw = 5 * cell;
  const gh = 7 * cell;
  const ox = (S - gw) / 2;
  const oy = (S - gh) / 2;
  const M = 22; // margem da moldura
  const T = 10; // espessura da moldura
  const rows = FONT[ch];
  return makeTex(
    S,
    (x, y, px) => {
      // y do "screen space" (row 0 = topo) → row do buffer = S-1-y
      const sy = S - 1 - y;
      let on = false;
      // moldura arredondada
      const bx = x >= M && x < S - M;
      const by = sy >= M && sy < S - M;
      const edge =
        (bx && (sy < M + T || sy >= S - M - T)) ||
        (by && (x < M + T || x >= S - M - T));
      if (edge) on = true;
      // letra
      const gx = Math.floor((x - ox) / cell);
      const gy = Math.floor((sy - oy) / cell);
      if (gx >= 0 && gx < 5 && gy >= 0 && gy < 7 && rows[gy][gx] === '1') on = true;
      if (on) {
        px[0] = r;
        px[1] = g;
        px[2] = b;
        px[3] = 235;
      } else {
        px[3] = 0;
      }
    },
    false
  );
}

/** Glow radial branco→transparente (clarão de boca, faíscas grandes). */
export function glowTexture(): THREE.DataTexture {
  const S = 64;
  const R = S / 2;
  return makeTex(
    S,
    (x, y, px) => {
      const d = Math.hypot(x - (R - 0.5), y - (R - 0.5)) / R;
      const a = Math.max(0, 1 - d);
      const k = Math.pow(a, 2.1);
      px[0] = 255;
      px[1] = 250;
      px[2] = 240;
      px[3] = 255 * k;
    },
    false
  );
}
