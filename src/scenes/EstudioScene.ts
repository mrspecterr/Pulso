import * as THREE from 'three';
import { COLORS } from '../config/constants';
import { MAPS } from '../config/maps';
import type { WeatherId } from '../config/maps';
import { PlantViz } from '../game/PlantViz';
import { StaticBuckets } from '../core/merge';
import {
  beamTexture,
  concreteTexture,
  foamTexture,
  gunmetalTexture,
  hazardTexture,
  letterTexture,
  metalPanelTexture,
  scaleBoxUV,
  woodPlanksTexture,
} from '../core/textures';
import type { AABB, SceneBundle } from './SubsoloScene';

// -------------------------------------------------------------- CLIMA (Etapa 18)
// ESTÚDIO nos três climas: PADRÃO é o estúdio de sempre (madeira quente,
// âmbar do console); NOITE é a sessão madrugada adentro — o console e o
// neon dos sites carregam a leitura, o resto apaga; NEBLINA é o vapor do
// encanamento antigo engolindo os corredores (curto alcance, tudo lavado).
const WX = {
  PADRAO: {
    bg: 0x121017,
    fog: 0.02,
    hemiSky: 0xd9c9b0,
    hemiGround: 0x2a2622,
    hemiInt: 1.25,
    dirColor: 0xffe2b8,
    dirInt: 3.0,
    beamOp: 0.3,
    console: 9,
    siteA: 11,
    siteB: 8,
    mid: 8,
  },
  NOITE: {
    bg: 0x050403,
    fog: 0.026,
    hemiSky: 0x2c3244,
    hemiGround: 0x131110,
    hemiInt: 0.36,
    dirColor: 0x8fb0ff, // luar frio pela grade do teto
    dirInt: 0.35,
    beamOp: 0.42,
    console: 13, // o console aceso carrega o CONTROLE
    siteA: 16,
    siteB: 12,
    mid: 6,
  },
  NEBLINA: {
    bg: 0x2a2d31,
    fog: 0.055,
    hemiSky: 0x9aa0a8,
    hemiGround: 0x2c2c2e,
    hemiInt: 0.9,
    dirColor: 0xd8e0e8,
    dirInt: 1.4,
    beamOp: 0.16, // o vapor dilui os feixes
    console: 8,
    siteA: 9,
    siteB: 7,
    mid: 6,
  },
} as const;

/**
 * ESTÚDIO — complexo de gravação desativado (Etapa 18). O mapa "fechado"
 * do PULSO: salas em vez de lanes, corredores curtos e portas de verdade.
 *
 * Layout (vista de cima, norte = -Z):
 *
 *   ┌──── SALA A ────┐┌── CONTROLE ──┐┌──── SALA B ────┐
 *   │  SITE A (teal) ││  caixa de    ││  SITE B (mag.) │
 *   │  drum riser    ││    VIDRO     ││  vocal corner  │
 *   └──┬─────────┬───┘└──┬──┬───┬──┬─┘└──┬─────────┬───┘
 *      │ porta A1│  oeste│  │vidro│  leste    │porta B1│
 *   ┌──┴─────────┴───┐   │  └─┬─┬─┘  │    ┌──┴────────┴───┐
 *   │   LOBBY A      │   │   │     │    │   LOBBY B     │
 *   │  (amplificad.) │   │porta│     │    │ (amplificad.)│
 *   └───────┬────────┘   │mid │      │    └────────┬─────┘
 *           │       ┌───┴────┴──────┴───┐         │
 *           │       │  MISTURA (console)│         │
 *           │       └───┬────────┬──────┘         │
 *   ┌───────┴───────────┴────────┴────────────────┴───────┐
 *   │              RECEPÇÃO (spawn · balcão · sofás)      │
 *   └──────────────────────────────────────────────────────┘
 *
 * O CONTROLE é uma CAIXA DE VIDRO entre os sites: vê-se os dois sites
 * através dos vidros temperados por ressonância — mas balas não cruzam
 * e os DIRACs não enxergam através deles. Quem toma o mid, toma o olho
 * da partida.
 */
export function buildEstudio(scene: THREE.Scene, weather: WeatherId = 'PADRAO'): SceneBundle {
  const SITES = MAPS.ESTUDIO.sites;
  const wx = WX[weather];
  const colliders: AABB[] = [];
  const solids: THREE.Object3D[] = [];

  const solidStatics = new StaticBuckets(scene);
  const decorStatics = new StaticBuckets(scene);

  scene.background = new THREE.Color(wx.bg);
  scene.fog = new THREE.FogExp2(wx.bg, wx.fog);

  // --- texturas procedurais (geradas uma vez) ---
  const texPlaster = concreteTexture(0x9a8f7c, 13);
  const texWood = woodPlanksTexture(23);
  const texMetal = metalPanelTexture(5);

  // --- materiais compartilhados ---
  // parede: reboco marfim — o oposto do concreto cinza do SUBSOLO
  const wallMat = new THREE.MeshStandardMaterial({
    map: texPlaster,
    color: 0xd4c5a8,
    roughness: 0.92,
    metalness: 0.02,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    map: texWood,
    color: 0x6b4a32, // nogueira escura
    roughness: 0.5,
    metalness: 0.05,
  });
  floorMat.map!.repeat.set(7, 5);
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0x181a1e,
    roughness: 0.95,
    metalness: 0.02,
  });
  const foamMat = new THREE.MeshStandardMaterial({
    map: foamTexture(),
    roughness: 0.96,
    metalness: 0.01,
  });
  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0x8a6a3a,
    roughness: 0.42,
    metalness: 0.45,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x2b2f36,
    roughness: 0.58,
    metalness: 0.2,
  });
  const consoleMat = new THREE.MeshStandardMaterial({
    map: gunmetalTexture(17),
    roughness: 0.48,
    metalness: 0.35,
  });
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTexture(),
    roughness: 0.92,
    metalness: 0.04,
  });
  const ampMats = [
    new THREE.MeshStandardMaterial({ map: texMetal, color: 0x3d4148, roughness: 0.6, metalness: 0.22 }),
    new THREE.MeshStandardMaterial({ map: texMetal, color: 0x4a3f34, roughness: 0.64, metalness: 0.16 }),
  ];
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9c8 });
  const tealGlow = new THREE.MeshBasicMaterial({ color: COLORS.TEAL });
  const magentaGlow = new THREE.MeshBasicMaterial({ color: COLORS.MAGENTA });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd9a441,
    roughness: 0.32,
    metalness: 0.55,
  });
  const rugMat = new THREE.MeshStandardMaterial({
    color: 0x2e3238,
    roughness: 0.98,
    metalness: 0.0,
  });

  // o VIDRO do CONTROLE — temperado por ressonância: deixa VER, corta
  // bala e passagem (e o raycast de visão dos DIRACs). Fora do merge:
  // transparente com depthWrite off se funde com nada.
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9fd8e8,
    transparent: true,
    opacity: 0.16,
    roughness: 0.06,
    metalness: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTexture(),
    transparent: true,
    opacity: wx.beamOp,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const lightShaft = (x: number, z: number, w = 1.5) => {
    for (const ry of [0, Math.PI / 2]) {
      const shaft = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.1), beamMat);
      shaft.position.set(x, 1.95, z);
      shaft.rotation.y = ry;
      shaft.renderOrder = 20;
      decorStatics.add(shaft);
    }
  };

  // --- piso e teto (entram no raycast das balas) ---
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(38, 30), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  solids.push(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(38, 30), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 3.6;
  scene.add(ceil);
  solids.push(ceil);

  // --- baffles acústicos pendurados (teto vivo) ---
  const baffleGeo = new THREE.BoxGeometry(4, 0.14, 0.8);
  for (const x of [-15, -9, -3, 3, 9, 15]) {
    const b = new THREE.Mesh(baffleGeo, foamMat);
    b.position.set(x, 3.22, -3);
    decorStatics.add(b);
  }
  for (const x of [-12, -4, 4, 12]) {
    const b = new THREE.Mesh(baffleGeo, foamMat);
    b.position.set(x, 3.22, 8);
    decorStatics.add(b);
  }

  // --- spots de trilho (lata escura + tubo quente) ---
  const lampHouseGeo = new THREE.BoxGeometry(0.9, 0.08, 0.24);
  const lampTubeGeo = new THREE.BoxGeometry(0.76, 0.045, 0.16);
  const lampAt = (x: number, z: number) => {
    const house = new THREE.Mesh(lampHouseGeo, darkMetal);
    house.position.set(x, 3.44, z);
    const tube = new THREE.Mesh(lampTubeGeo, lampMat);
    tube.position.set(x, 3.38, z);
    decorStatics.add(house);
    decorStatics.add(tube);
  };
  lampAt(0, -3); // MISTURA
  lampAt(-12, -3.5); // porta A
  lampAt(12, -3.5); // porta B
  lampAt(-12.5, -10.5); // SALA A
  lampAt(12.5, -10.5); // SALA B
  lampAt(0, 8); // RECEPÇÃO

  lightShaft(0, -3, 1.6);
  lightShaft(-12.5, -10.5, 1.9);
  lightShaft(12.5, -10.5, 1.9);
  lightShaft(0, 8, 1.4);

  // --- construtor de parede (colisão + malha + rodapé bronze) ---
  let wallCount = 0;
  const uvOffset = () => {
    wallCount++;
    return [((wallCount * 0.618) % 1) * 4, ((wallCount * 0.381) % 1) * 4] as const;
  };
  const wall = (x: number, z: number, w: number, d: number, h: number) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const [ox, oy] = uvOffset();
    scaleBoxUV(geo, w, h, d, 2.2, ox, oy);
    const m = new THREE.Mesh(geo, wallMat);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    solidStatics.add(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

    const bb = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.22, d + 0.05), bronzeMat);
    bb.position.set(x, 0.11, z);
    bb.receiveShadow = true;
    decorStatics.add(bb);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.08, d + 0.04), bronzeMat);
    cap.position.set(x, h - 0.04, z);
    decorStatics.add(cap);
    return m;
  };

  // --- VIDRO (parede transparente: colide, corta bala, deixa VER) ---
  const glass = (x: number, z: number, w: number, d: number, h = 3.2) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMat);
    m.position.set(x, h / 2, z);
    m.renderOrder = 10;
    scene.add(m); // fora do merge (transparente)
    solids.push(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

    // moldura: soleira, verga e montantes bronze
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.12, d + 0.06), bronzeMat);
    sill.position.set(x, 0.06, z);
    decorStatics.add(sill);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.12, d + 0.06), bronzeMat);
    top.position.set(x, h - 0.06, z);
    decorStatics.add(top);
    // filete neon que acende a borda do vidro
    const neon = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.02, 0.04, d + 0.02),
      tealGlow
    );
    neon.position.set(x, h - 0.14, z);
    decorStatics.add(neon);
  };

  // --- coluna estrutural (envolta em espuma acústica) ---
  const column = (x: number, z: number) => {
    const s = 0.9;
    const geo = new THREE.BoxGeometry(s, 3.6, s);
    const [ox, oy] = uvOffset();
    scaleBoxUV(geo, s, 3.6, s, 1.5, ox, oy);
    const m = new THREE.Mesh(geo, foamMat);
    m.position.set(x, 1.8, z);
    m.castShadow = true;
    m.receiveShadow = true;
    solidStatics.add(m);
    colliders.push({ minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2 });

    const cap = new THREE.Mesh(new THREE.BoxGeometry(s + 0.06, 0.1, s + 0.06), bronzeMat);
    cap.position.set(x, 3.55, z);
    decorStatics.add(cap);
    return m;
  };

  // --- pilha de amplificadores (o caixote do ESTÚDIO) ---
  let ampIdx = 0;
  const crate = (x: number, z: number, s: number) => {
    const geo = new THREE.BoxGeometry(s, s, s);
    const [ox, oy] = uvOffset();
    scaleBoxUV(geo, s, s, s, 1.5, ox, oy);
    const m = new THREE.Mesh(geo, ampMats[ampIdx % ampMats.length]);
    ampIdx++;
    m.position.set(x, s / 2, z);
    m.rotation.y = (x * 11.3 + z * 8.9) % 0.4 - 0.2;
    m.castShadow = true;
    m.receiveShadow = true;
    solidStatics.add(m);
    const c = Math.cos(m.rotation.y);
    const sn = Math.sin(m.rotation.y);
    const ex = (s / 2) * (Math.abs(c) + Math.abs(sn));
    const ez = (s / 2) * (Math.abs(sn) + Math.abs(c));
    colliders.push({ minX: x - ex, maxX: x + ex, minZ: z - ez, maxZ: z + ez });
    // grade do alto-falante no topo (identidade do abrigo)
    const grille = new THREE.Mesh(new THREE.BoxGeometry(s + 0.02, 0.12, s + 0.02), darkMetal);
    grille.position.copy(m.position);
    grille.position.y = s - 0.07;
    grille.rotation.y = m.rotation.y;
    decorStatics.add(grille);
    return m;
  };

  // --- bloco maciço (balcões/console: cobertura alta, atira-se por cima) ---
  const block = (x: number, z: number, w: number, d: number, h: number, mat: THREE.Material) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const [ox, oy] = uvOffset();
    scaleBoxUV(geo, w, h, d, 1.8, ox, oy);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    solidStatics.add(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  };

  // ================= MAPA =================
  // Perímetro (36 × 28 interno)
  wall(0, -14, 37, 1, 3.6);
  wall(0, 14, 37, 1, 3.6);
  wall(-18, 0, 1, 29, 3.6);
  wall(18, 0, 1, 29, 3.6);

  // Face sul da faixa norte (z = -6): três portas — A (2,8m), MID (3,2m), B (2,8m)
  wall(-15.7, -6, 4.6, 1, 3.2); // oeste da porta A
  wall(-6.1, -6, 9, 1, 3.2); // entre porta A e MID
  wall(6.1, -6, 9, 1, 3.2); // entre MID e porta B
  wall(15.7, -6, 4.6, 1, 3.2); // leste da porta B

  // CONTROLE ⇄ SALAS: separadores de VIDRO com porta central (vão z∈[-10.6,-7.8])
  glass(-6, -12.05, 1, 2.9, 3.2); // oeste, norte da porta
  glass(-6, -7.15, 1, 1.3, 3.2); // oeste, sul da porta
  glass(6, -12.05, 1, 2.9, 3.2); // leste, norte da porta
  glass(6, -7.15, 1, 1.3, 3.2); // leste, sul da porta

  // Partições da MISTURA (quebram a linha de visão leste-oeste)
  wall(-8.5, -3.2, 1, 4.6, 3.2);
  wall(8.5, -3.2, 1, 4.6, 3.2);

  // Colunas de espuma da RECEPÇÃO
  column(-3.2, 2.5);
  column(3.2, 2.5);

  // Pilhas de amplificadores (cobertura)
  crate(-15.5, -3.6, 1.4); // LOBBY A
  crate(-16.8, -2.4, 1.1); // LOBBY A
  crate(15.5, -3.6, 1.4); // LOBBY B
  crate(16.8, -2.4, 1.1); // LOBBY B
  crate(-6.8, -1.6, 1.2); // flanco oeste da MISTURA
  crate(6.8, -1.6, 1.2); // flanco leste
  crate(-16.5, -12, 1.3); // dentro SALA A
  crate(-8.5, -13, 1.1); // borda SALA A
  crate(-8, -8.5, 1.2); // SALA A, perto da porta do CONTROLE
  crate(16.5, -12, 1.3); // dentro SALA B
  crate(8.5, -13, 1.1); // borda SALA B
  crate(8, -8.5, 1.2); // SALA B, perto da porta do CONTROLE

  // Sofás da RECEPÇÃO
  crate(-11, 8, 1.4);
  crate(11, 8, 1.4);
  crate(-14, 6, 1.1);
  crate(14, 6, 1.1);

  // Balcão da recepção (cobre, dá pra atirar por cima)
  block(0, 5.5, 7, 1.2, 1.15, consoleMat);
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.06, 1.5), bronzeMat);
  counterTop.position.set(0, 1.18, 5.5);
  counterTop.receiveShadow = true;
  decorStatics.add(counterTop);

  // Console da MISTURA (a ilha central — coração do mid)
  block(0, -3, 6.4, 1.4, 1.15, consoleMat);
  // mesa de som: fileiras de faders + fio âmbar vivo
  const faderRow = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.03, 0.2), darkMetal);
  faderRow.position.set(0, 1.17, -3.25);
  decorStatics.add(faderRow);
  const faderRow2 = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.03, 0.2), darkMetal);
  faderRow2.position.set(0, 1.17, -2.75);
  decorStatics.add(faderRow2);
  const amberStrip = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 0.02, 0.03),
    new THREE.MeshBasicMaterial({ color: 0xffb45c })
  );
  amberStrip.position.set(0, 1.19, -3);
  decorStatics.add(amberStrip);

  // Mesa do CONTROLE (encostada na parede norte, de frente pro vidro)
  block(0, -12.95, 7, 1.1, 1.1, consoleMat);
  // monitores de estúdio sobre a mesa
  for (const mx of [-2.4, 2.4]) {
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.34), darkMetal);
    mon.position.set(mx, 1.32, -12.95);
    mon.castShadow = true;
    decorStatics.add(mon);
    const cone = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), bronzeMat);
    cone.position.set(mx, 1.32, -12.76);
    decorStatics.add(cone);
  }
  // rack de equipamentos no canto do CONTROLE
  crate(4.8, -12.6, 1.1);

  // LED do CONTROLE — filete teal na parede norte (o estúdio "vivo")
  const ledStrip = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.06, 0.03),
    tealGlow
  );
  ledStrip.position.set(0, 2.5, -13.46);
  decorStatics.add(ledStrip);

  // Drum riser da SALA A + tapetes (visuais — 12cm, não bloqueiam)
  const riser = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 3.4), darkMetal);
  riser.position.set(SITES.A.x, 0.06, SITES.A.z);
  riser.receiveShadow = true;
  decorStatics.add(riser);
  const rugAt = (x: number, z: number, w: number, d: number) => {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(w, d), rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(x, 0.012, z);
    rug.receiveShadow = true;
    decorStatics.add(rug);
  };
  rugAt(0, 8.5, 9, 6); // recepção
  rugAt(0, -3, 8, 5); // mistura (sob o console)
  rugAt(SITES.A.x, SITES.A.z, 5, 4); // sala A
  rugAt(SITES.B.x, SITES.B.z, 5, 4); // sala B

  // pés de microfone nas salas (visuais, finos)
  const micAt = (x: number, z: number) => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.04, 10), darkMetal);
    base.position.set(x, 0.02, z);
    decorStatics.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.55, 6), bronzeMat);
    pole.position.set(x, 0.78, z);
    decorStatics.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), darkMetal);
    head.position.set(x, 1.58, z);
    decorStatics.add(head);
  };
  micAt(-10.5, -9.2);
  micAt(-15, -8.5);
  micAt(10.5, -9.2);
  micAt(15, -8.5);

  // difusores nas paredes norte das salas (visuais)
  const diffuser = (x: number) => {
    const d = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, 0.08), foamMat);
    d.position.set(x, 2.2, -13.44);
    decorStatics.add(d);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.14, 1.54, 0.04), bronzeMat);
    frame.position.set(x, 2.2, -13.47);
    decorStatics.add(frame);
  };
  diffuser(-12.5);
  diffuser(-9);
  diffuser(9);
  diffuser(12.5);

  // discos de ouro na recepção (parede sul — a parede de discos)
  const disc = (x: number) => {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 20), goldMat);
    plate.rotation.x = Math.PI / 2;
    plate.position.set(x, 2.2, 13.44);
    decorStatics.add(plate);
  };
  for (const x of [-6, -4.5, -3, 3, 4.5, 6]) disc(x);

  // faixas de ressonância nas partições da MISTURA
  const stripAlongZ = (x: number, z: number, len: number, mat: THREE.Material) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, len), mat);
    s.position.set(x, 2.35, z);
    decorStatics.add(s);
  };
  stripAlongZ(-9.03, -3.2, 4.4, tealGlow); // partição oeste, face do lobby A
  stripAlongZ(9.03, -3.2, 4.4, magentaGlow); // partição leste, face do lobby B

  // marcação do SPAWN (faixa teal no chão)
  const spawnMark = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 1.1),
    new THREE.MeshBasicMaterial({
      color: COLORS.TEAL,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  spawnMark.rotation.x = -Math.PI / 2;
  spawnMark.position.set(0, 0.02, 12);
  decorStatics.add(spawnMark);

  // pedestais de plantio (um por site, sempre visíveis)
  const pedestalAt = (x: number, z: number, mat: THREE.Material) => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.62, 0.16, 22), darkMetal);
    base.position.set(x, 0.08, z);
    base.castShadow = true;
    decorStatics.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.028, 8, 32), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.17, z);
    decorStatics.add(ring);
  };
  // o pedestal da SALA A sobe 12cm — sobre o riser
  const baseA = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.62, 0.16, 22), darkMetal);
  baseA.position.set(SITES.A.x, 0.08 + 0.12, SITES.A.z);
  baseA.castShadow = true;
  decorStatics.add(baseA);
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.028, 8, 32), tealGlow);
  ringA.rotation.x = -Math.PI / 2;
  ringA.position.set(SITES.A.x, 0.17 + 0.12, SITES.A.z);
  decorStatics.add(ringA);
  pedestalAt(SITES.B.x, SITES.B.z, magentaGlow);

  // molduras pintadas dos sites no chão (a da SALA A sobre o riser)
  const siteFrame = (x: number, z: number, y: number, color: number) => {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const S = 4.4;
    const strip = (w: number, d: number, sx: number, sz: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x + sx, y, z + sz);
      decorStatics.add(m);
    };
    strip(S, 0.16, 0, -S / 2);
    strip(S, 0.16, 0, S / 2);
    strip(0.16, S, -S / 2, 0);
    strip(0.16, S, S / 2, 0);
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(S, S),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(x, y - 0.006, z);
    decorStatics.add(fill);
  };
  siteFrame(SITES.A.x, SITES.A.z, 0.135, COLORS.TEAL); // sobre o riser
  siteFrame(SITES.B.x, SITES.B.z, 0.021, COLORS.MAGENTA);

  // placas A / B na parede norte de cada sala
  const letterA = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2),
    new THREE.MeshBasicMaterial({ map: letterTexture('A', COLORS.TEAL), transparent: true })
  );
  letterA.position.set(-12.5, 2.3, -13.42);
  decorStatics.add(letterA);
  const letterB = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2),
    new THREE.MeshBasicMaterial({ map: letterTexture('B', COLORS.MAGENTA), transparent: true })
  );
  letterB.position.set(12.5, 2.3, -13.42);
  decorStatics.add(letterB);

  // pilonas de sinal nos cantos dos sites
  const pylonAt = (x: number, z: number, mat: THREE.MeshBasicMaterial) => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 0.3), darkMetal);
    col.position.set(x, 1.6, z);
    col.castShadow = true;
    decorStatics.add(col);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.3, 0.02), mat);
    strip.position.set(x, 1.52, z + 0.17);
    scene.add(strip);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.36), mat);
    top.position.set(x, 3.22, z);
    scene.add(top);
    return strip.material as THREE.MeshBasicMaterial;
  };
  const pylonA = pylonAt(-16.6, -13.2, tealGlow.clone());
  const pylonB = pylonAt(16.6, -13.2, magentaGlow.clone());

  // ================= FUNDE A GEOMETRIA ESTÁTICA =================
  solids.push(...solidStatics.build());
  decorStatics.build();

  // --- DIAPASÃO plantado — visual compartilhado entre os mapas ---
  const viz = new PlantViz(scene);

  // ================= ILUMINAÇÃO =================
  // madeira quente + âmbar do console; o clima reescreve o humor.
  const hemi = new THREE.HemisphereLight(wx.hemiSky, wx.hemiGround, wx.hemiInt);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(wx.dirColor, wx.dirInt);
  dir.position.set(7, 15, 9);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.left = -22;
  dir.shadow.camera.right = 22;
  dir.shadow.camera.top = 18;
  dir.shadow.camera.bottom = -18;
  dir.shadow.camera.near = 4;
  dir.shadow.camera.far = 50;
  dir.shadow.bias = -0.0005;
  dir.shadow.normalBias = 0.03;
  scene.add(dir);

  const setShadowResolution = (px: number) => {
    dir.shadow.mapSize.set(px, px);
    if (dir.shadow.map) {
      dir.shadow.map.dispose();
      (dir.shadow as unknown as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
  };

  const consoleLight = new THREE.PointLight(0xffb45c, wx.console, 14, 1.6);
  consoleLight.position.set(0, 2.4, -11.5);
  scene.add(consoleLight);
  const siteALight = new THREE.PointLight(COLORS.TEAL, wx.siteA, 17, 1.6);
  siteALight.position.set(-12.5, 2.6, -10.5);
  scene.add(siteALight);
  const siteBLight = new THREE.PointLight(COLORS.MAGENTA, wx.siteB, 15, 1.6);
  siteBLight.position.set(12.5, 2.6, -10.5);
  scene.add(siteBLight);
  const midLight = new THREE.PointLight(0xfff4e0, wx.mid, 15, 1.6);
  midLight.position.set(0, 3.0, -3);
  scene.add(midLight);

  const update = (dt: number, t: number) => {
    viz.update(dt, t);
    siteALight.intensity = wx.siteA + Math.sin(t * 3.4) * 4; // o pulso
    siteBLight.intensity = wx.siteB + Math.sin(t * 3.4 + Math.PI) * 2.5;
    consoleLight.intensity = wx.console + Math.sin(t * 5.2) * 1.2; // VU do console
    pylonA.opacity = 0.75 + Math.abs(Math.sin(t * 2.2)) * 0.25;
    pylonB.opacity = 0.75 + Math.abs(Math.sin(t * 2.2 + 0.8)) * 0.25;
  };

  const plant = (site: 'A' | 'B') => {
    const s = site === 'A' ? SITES.A : SITES.B;
    viz.plant(s.x, s.z);
  };

  const clearPlant = () => {
    viz.clearPlant();
  };

  // footprint congelado dos colisores para o minimapa (antes da BARREIRA)
  const walls = colliders.map((c) => ({ ...c }));

  return { update, colliders, solids, walls, plant, clearPlant, setShadowResolution };
}
