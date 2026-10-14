// Padrões determinísticos de spray (graus, [x, y] por tiro).
//
// Filosofia Valorant: os primeiros tiros vão onde a mira aponta; sustentar
// o gatilho faz o padrão subir (recoil) e depois tecer para os lados.
// Aprender o padrão = domar a arma.

import type { WeaponId } from '../config/constants';

// LEGATO — 30 entradas (pente inteiro + margem)
export const SPRAY_LEGATO: Array<[number, number]> = [];
for (let i = 0; i < 30; i++) {
  let x = 0;
  let y = 0;
  if (i < 5) {
    // janela de precisão: quase perfeita
    x = i % 2 === 0 ? 0.05 : -0.05;
    y = i * 0.02;
  } else if (i < 11) {
    // subida do recuo
    y = 0.5 + (i - 5) * 0.32;
    x = i % 2 === 0 ? 0.08 : -0.08;
  } else {
    // platô: sobe pouco e tecer horizontalmente
    y = 2.4 + Math.sin((i - 11) * 0.9) * 0.25;
    x = Math.sin((i - 11) * 1.15) * 1.6;
  }
  SPRAY_LEGATO.push([x, y]);
}

// STACCATO — pistola: 3 primeiros quase retos, depois sobe com força
// (castiga segurar o gatilho; recompensa tiro cadenciado)
export const SPRAY_STACCATO: Array<[number, number]> = [];
for (let i = 0; i < 12; i++) {
  let x = 0;
  let y = 0;
  if (i < 3) {
    x = i === 1 ? 0.12 : 0;
    y = i * 0.06;
  } else {
    y = 0.7 + (i - 3) * 0.55;
    x = Math.sin(i * 1.9) * 0.7;
  }
  SPRAY_STACCATO.push([x, y]);
}

// GLISSANDO — escopeta de corredera (Etapa 16): o bombeamento é lento, então
// a arma volta quase à origem entre tiros; o que sobe é o “recuo de ombro” —
// cada tiro consecutivo empurra a mira um pouco mais para cima. O cone de
// balins vivo (dispersão) é sorteado no fire(), aqui é só a tendência central.
export const SPRAY_GLISSANDO: Array<[number, number]> = [];
for (let i = 0; i < 6; i++) {
  const x = Math.sin(i * 2.4) * 0.22; // vai-e-vem curto (o cano balança)
  const y = i * 0.55; // sobe firmemente a cada bombeamento apressado
  SPRAY_GLISSANDO.push([x, y]);
}

const TABLES: Record<WeaponId, Array<[number, number]>> = {
  LEGATO: SPRAY_LEGATO,
  STACCATO: SPRAY_STACCATO,
  GLISSANDO: SPRAY_GLISSANDO,
};

export const sprayAt = (index: number, weapon: WeaponId): [number, number] => {
  const table = TABLES[weapon];
  return table[Math.min(index, table.length - 1)];
};
