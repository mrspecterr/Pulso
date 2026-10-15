// OperatorModel (Etapa 23) — os esquadrões viram GENTE.
//
// Desde a Etapa 6 os combatentes eram cápsulas flutuantes com mochila e
// (nos DIRACs) um propulsor — liam-se como robôs. Este módulo constrói o
// OPERADOR HUMANOIDE: pernas com ciclo de caminhada, braços em pose de
// mira segurando o fuzil, capacete com óculos táticos e traje de operador.
//
// REGRAS DE OURO (por isso nada de gameplay muda):
// 1. Os hitboxes NÃO mudam — corpo continua a cápsula (0.26, 0.92) em
//    y=0.98 e cabeça a esfera (0.18) em y=1.66, exatamente como antes.
//    Armadura/braços/fuzil são filhos decorativos fora do raycast.
// 2. A economia de draw calls continua: tudo que não anda vira uma
//    única mesh fundida por material (StaticBuckets); as duas pernas
//    são os únicos pivots animados por personagem.
// 3. Os materiais POR PERSONAGEM (bodyMat/headMat/visorMat) seguem com
//    os mesmos nomes e comportamentos — flash de dano, cegueira etc.
import * as THREE from 'three';
import { COLORS } from '../config/constants';
import { StaticBuckets } from '../core/merge';

export type OperatorKind = 'CORO' | 'DIRAC';

export interface OperatorRig {
  group: THREE.Group;
  /** hitbox do tórax (o mesmo capsule de sempre — raycast de balas) */
  body: THREE.Mesh;
  /** hitbox da cabeça (a mesma esfera de sempre — headshot) */
  head: THREE.Mesh;
  bodyMat: THREE.MeshStandardMaterial; // emissivo animado no flash de dano
  headMat: THREE.MeshStandardMaterial; // idem
  visorMat: THREE.MeshBasicMaterial; // óculos: branco quando cego etc.
  legL: THREE.Group; // pivô do quadril esquerdo (animação de passo)
  legR: THREE.Group;
}

// ---------------------------------------------------------- geometrias
// Criadas uma vez por processo e compartilhadas por todos os personagens
// (o StaticBuckets clona antes de fundir — o mesmo padrão dos cenários).
let GEO: ReturnType<typeof makeGeos> | null = null;
function makeGeos() {
  return {
    torso: new THREE.CapsuleGeometry(0.26, 0.92, 6, 12), // hitbox — intocada
    head: new THREE.SphereGeometry(0.18, 16, 12), // hitbox — intocada
    neck: new THREE.CylinderGeometry(0.075, 0.088, 0.12, 8),
    chest: new THREE.BoxGeometry(0.34, 0.36, 0.14),
    pack: new THREE.BoxGeometry(0.24, 0.3, 0.12),
    shoulder: new THREE.BoxGeometry(0.15, 0.12, 0.22),
    belt: new THREE.BoxGeometry(0.3, 0.13, 0.21),
    led: new THREE.BoxGeometry(0.14, 0.022, 0.05),
    armUp: new THREE.CapsuleGeometry(0.055, 0.2, 4, 8),
    armLo: new THREE.CapsuleGeometry(0.048, 0.18, 4, 8),
    hand: new THREE.BoxGeometry(0.06, 0.07, 0.09),
    gunBody: new THREE.BoxGeometry(0.05, 0.1, 0.34),
    gunBarrel: new THREE.BoxGeometry(0.032, 0.04, 0.3),
    gunStock: new THREE.BoxGeometry(0.042, 0.085, 0.16),
    gunMag: new THREE.BoxGeometry(0.038, 0.13, 0.06),
    gunSight: new THREE.BoxGeometry(0.034, 0.05, 0.1),
    helmet: new THREE.SphereGeometry(0.205, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    helmetBack: new THREE.BoxGeometry(0.15, 0.11, 0.07),
    goggles: new THREE.BoxGeometry(0.25, 0.055, 0.05),
    thigh: new THREE.CapsuleGeometry(0.085, 0.24, 4, 8),
    shin: new THREE.CapsuleGeometry(0.068, 0.22, 4, 8),
    boot: new THREE.BoxGeometry(0.11, 0.1, 0.2),
  };
}

// ---------------------------------------------------------- paletas
// CORO (aliados): verde-petróleo escuro + teal. DIRAC (hostis):
// ameixa-preto + magenta. O traje de cada time lê de longe.
interface Palette {
  suit: number; // traje (pernas/braços/mochila — não pisca)
  torso: number; // corpo (hitbox visível — pisca no flash)
  balaclava: number; // cabeça (hitbox visível)
  armor: number; // placas/ombros/capacete
  gun: number; // fuzil
  accent: number; // LEDs/óculos — cor do time
}

const PALETTES: Record<OperatorKind, Palette> = {
  CORO: {
    suit: 0x21332e,
    torso: 0x21332e,
    balaclava: 0x273a35,
    armor: 0x2f4a44,
    gun: 0x22282e,
    accent: COLORS.TEAL,
  },
  DIRAC: {
    suit: 0x2a2536,
    torso: 0x232c38,
    balaclava: 0x2b3542,
    armor: 0x3a3448,
    gun: 0x26242e,
    accent: COLORS.MAGENTA,
  },
};

// materiais COMPARTILHADOS por time (as peças nunca mudam de cor) —
// 3 buckets no corpo + 1 por perna: o humanoid fica em ~10 meshes
const SHARED = new Map<OperatorKind, ReturnType<typeof makeShared>>();
function makeShared(p: Palette) {
  return {
    suit: new THREE.MeshStandardMaterial({ color: p.suit, roughness: 0.75, metalness: 0.15 }),
    armor: new THREE.MeshStandardMaterial({ color: p.armor, roughness: 0.5, metalness: 0.3 }),
    gun: new THREE.MeshStandardMaterial({ color: p.gun, roughness: 0.4, metalness: 0.5 }),
    led: new THREE.MeshBasicMaterial({ color: p.accent }),
  };
}

/**
 * Monta um operador humanoide. Um por personagem (bots DIRAC e aliados
 * CORO). O grupo anda no chão (pés em y=0) e encara +Z, como sempre.
 */
export function createOperatorRig(kind: OperatorKind): OperatorRig {
  if (!GEO) GEO = makeGeos();
  const p = PALETTES[kind];
  let shared = SHARED.get(kind);
  if (!shared) {
    shared = makeShared(p);
    SHARED.set(kind, shared);
  }
  const g = GEO;

  // --- materiais por personagem (flash de dano / cegueira) ---
  const bodyMat = new THREE.MeshStandardMaterial({
    color: p.torso,
    roughness: 0.7,
    metalness: 0.2,
    emissive: p.accent,
    emissiveIntensity: 0.1,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: p.balaclava,
    roughness: 0.6,
    metalness: 0.25,
    emissive: p.accent,
    emissiveIntensity: 0.2,
  });
  const visorMat = new THREE.MeshBasicMaterial({ color: p.accent });

  const group = new THREE.Group();

  // --- tórax (hitbox) + tudo que é estático fundido nele ---
  const body = new THREE.Mesh(g.torso, bodyMat);
  body.position.y = 0.98;
  body.castShadow = true;

  const armor = new StaticBuckets(body);
  // coordenadas em ESPAÇO-CORPO (o corpo está em y=0.98 do grupo)
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    armor.add(m);
  };
  // pescoço + placa peitoral + ombreiras + cinto (armadura)
  add(g.neck, shared.armor, 0, 0.54, 0);
  add(g.chest, shared.armor, 0, 0.22, 0.135, -0.1);
  add(g.shoulder, shared.armor, -0.32, 0.42, 0, 0, 0, 0.2);
  add(g.shoulder, shared.armor, 0.32, 0.42, 0, 0, 0, -0.2);
  // mochila de rádio (pano do traje)
  add(g.pack, shared.suit, 0, 0.22, -0.185);
  add(g.belt, shared.suit, 0, -0.32, 0);
  // LEDs do time: ombro esquerdo (frente) e mochila (costas — lê de
  // longe mesmo vendo o operador ir embora)
  add(g.led, shared.led, -0.32, 0.42, 0.115);
  add(g.led, shared.led, 0, 0.26, -0.25);
  // braços em pose de mira (estáticos — o tronco vira junto com o corpo)
  add(g.armUp, shared.suit, 0.34, 0.38, 0.05, 0.5, 0, -0.15);
  add(g.armLo, shared.suit, 0.3, 0.3, 0.24, 1.05);
  add(g.hand, shared.suit, 0.24, 0.26, 0.28);
  add(g.armUp, shared.suit, -0.33, 0.37, 0.02, 0.55, -0.3, 0.25);
  add(g.armLo, shared.suit, -0.17, 0.26, 0.3, 1.1, 0.35);
  add(g.hand, shared.suit, -0.06, 0.24, 0.38);
  // o fuzil — receiver, cano, coronha, pente e alça
  add(g.gunBody, shared.gun, 0.16, 0.28, 0.34);
  add(g.gunBarrel, shared.gun, 0.16, 0.29, 0.56);
  add(g.gunStock, shared.gun, 0.16, 0.26, 0.16);
  add(g.gunMag, shared.gun, 0.16, 0.2, 0.34, 0.3);
  add(g.gunSight, shared.gun, 0.16, 0.35, 0.3);
  armor.build();

  // --- cabeça (hitbox) + capacete e óculos ---
  const head = new THREE.Mesh(g.head, headMat);
  head.position.y = 1.66;
  head.castShadow = true;
  // capacete + nuque FUNDIDOS na cabeça (filhos não entram no raycast —
  // só as meshes body/head são testadas pelas balas)
  const headgear = new StaticBuckets(head);
  const helmet = new THREE.Mesh(g.helmet, shared.armor);
  helmet.position.set(0, 0.015, -0.01);
  helmet.castShadow = true;
  headgear.add(helmet);
  const back = new THREE.Mesh(g.helmetBack, shared.armor);
  back.position.set(0, -0.01, -0.155);
  back.rotation.x = 0.15;
  back.castShadow = true;
  headgear.add(back);
  headgear.build();
  const goggles = new THREE.Mesh(g.goggles, visorMat);
  goggles.position.set(0, 0.035, 0.155);
  head.add(goggles);

  // --- pernas: pivôs animados no quadril, coxa+canela+bota fundidas ---
  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(0.115 * side, 0.52, 0);
    const bucket = new StaticBuckets(hip);
    const thigh = new THREE.Mesh(g.thigh, shared.suit);
    thigh.position.set(0, -0.16, 0);
    const shin = new THREE.Mesh(g.shin, shared.suit);
    shin.position.set(0, -0.36, 0.008);
    const boot = new THREE.Mesh(g.boot, shared.suit);
    boot.position.set(0, -0.47, 0.045);
    for (const piece of [thigh, shin, boot]) {
      piece.castShadow = true;
      bucket.add(piece);
    }
    bucket.build();
    hip.rotation.z = 0.07 * -side; // leve A-pose — pés abertos
    return hip;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  group.add(body, head, legL, legR);
  return { group, body, head, bodyMat, headMat, visorMat, legL, legR };
}

/**
 * Ciclo de caminhada — chamado todo frame por personagem. `walkT` avança
 * enquanto o dono se move; parar deixa as pernas assentarem em zero
 * (interpolado, sem tropeço seco). Balanço de ±0.62 rad nas coxas.
 */
export function animateOperatorWalk(
  rig: Pick<OperatorRig, 'legL' | 'legR'>,
  walkT: number,
  moving: boolean,
  dt: number
) {
  const target = moving ? Math.sin(walkT) * 0.62 : 0;
  const k = Math.min(1, dt * 12);
  rig.legL.rotation.x += (target - rig.legL.rotation.x) * k;
  rig.legR.rotation.x += (-target - rig.legR.rotation.x) * k;
}
