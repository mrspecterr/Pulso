import * as THREE from 'three';
import { COLORS } from '../config/constants';
import { MAPS } from '../config/maps';
import { PlantViz } from '../game/PlantViz';
import { StaticBuckets } from '../core/merge';
import {
  beamTexture,
  concreteTexture,
  curtainTexture,
  hazardTexture,
  letterTexture,
  metalPanelTexture,
  scaleBoxUV,
  woodPlanksTexture,
} from '../core/textures';
import type { AABB, SceneBundle } from './SubsoloScene';

/**
 * PALCO — casa de espetáculos desativada (mapa da Etapa 14).
 *
 * Layout tático (vista de cima, norte = -Z):
 *
 *   ┌─────────────┬──────────────────────┐
 *   │ CAMAROTE (A) ║      PALCO (B)       │
 *   │    teal     ║       magenta        │
 *   │             ╞═╡ mureta baixa 1,1m  │
 *   ├── muro C ───┘ vão ──╱──────────────┤
 *   │ CAMARINS   │   PLATEIA     │GALERIA│
 *   │ (salinha)  │ (poltronas)  │(colun.)│
 *   ├──divisória─┴── porta ─────┴───────┤
 *   │     FOYER — SPAWN CORO (sul)      │
 *   └───────────────────────────────────┘
 *
 * Assimetria é o jogo aqui: o foyer vira o mapa por TRÊS portas; a plateia
 * central é cortada por fileiras de poltronas (cobertura baixa); o site B
 * fica EM CIMA do palco, atrás de uma mureta de 1,1m — dá para atirar por
 * cima à distância, mas só se ATRAVESSA pelo vão entre o muro C e a
 * mureta (ou pelo fundo da galeria). Rotas, âncoras e caminhos vivem em
 * config/maps.ts; isto é só a direção de arte e a colisão.
 *
 * Direção de arte: madeira gasta, veludo carmim, dourado de camarim,
 * holofotes quentes — o oposto do concreto frio do SUBSOLO. Teto alto
 * (4,6m) com vigas e lustres; o mesmo pipeline de merge da Etapa 10.
 */
export function buildPalco(scene: THREE.Scene): SceneBundle {
  const SITES = MAPS.PALCO.sites;
  const colliders: AABB[] = [];
  const solids: THREE.Object3D[] = [];

  const solidStatics = new StaticBuckets(scene);
  const decorStatics = new StaticBuckets(scene);

  scene.background = new THREE.Color(0x0f0c0a);
  scene.fog = new THREE.FogExp2(0x0f0c0a, 0.016);

  // --- texturas procedurais (geradas uma vez) ---
  const texConc = concreteTexture(0x6b6158, 9); // reboco quente
  const texWood = woodPlanksTexture(21);
  const texMetal = metalPanelTexture(5);
  const texCurtain = curtainTexture(31);

  // --- materiais compartilhados ---
  const floorMat = new THREE.MeshStandardMaterial({
    map: texWood,
    roughness: 0.68,
    metalness: 0.04,
  });
  floorMat.map!.repeat.set(6, 5); // tábua de ~1m
  const stageMat = new THREE.MeshStandardMaterial({
    map: texWood.clone(), // clone: mesmo desenho, densidade PRÓPRIA no palco
    color: 0x8f7a63, // madeira mais escura sob os holofotes
    roughness: 0.62,
    metalness: 0.05,
  });
  stageMat.map!.repeat.set(2.4, 1.25); // tábua do mesmo tamanho do piso
  stageMat.map!.needsUpdate = true;
  const wallMat = new THREE.MeshStandardMaterial({
    map: texConc,
    color: 0xd8c2ae, // rebate o cinza do concreto p/ o ocre de gesso
    roughness: 0.95,
    metalness: 0.02,
  });
  const ceilMat = new THREE.MeshStandardMaterial({
    map: texConc,
    color: 0x6a5a4c,
    roughness: 0.97,
    metalness: 0.02,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    map: texMetal,
    roughness: 0.55,
    metalness: 0.26,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x3a3230,
    roughness: 0.6,
    metalness: 0.2,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xc9a227,
    roughness: 0.42,
    metalness: 0.3, // SEM envmap no WebGL1: dourado "pintado"
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x33261e,
    roughness: 0.78,
    metalness: 0.1,
  });
  const curtainMat = new THREE.MeshStandardMaterial({
    map: texCurtain,
    roughness: 0.95,
    metalness: 0.0,
  });
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTexture(),
    roughness: 0.92,
    metalness: 0.04,
  });
  const crateMats = [
    new THREE.MeshStandardMaterial({
      map: texMetal,
      color: 0x9a5a62, // poltrona carmim
      roughness: 0.66,
      metalness: 0.12,
    }),
    new THREE.MeshStandardMaterial({
      map: texMetal,
      color: 0xb08a52, // latão envelhecido
      roughness: 0.64,
      metalness: 0.14,
    }),
    new THREE.MeshStandardMaterial({
      map: texMetal,
      color: 0x8a7a68, // couro gasto
      roughness: 0.68,
      metalness: 0.1,
    }),
  ];
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9c2 });
  const tealGlow = new THREE.MeshBasicMaterial({ color: COLORS.TEAL });
  const magentaGlow = new THREE.MeshBasicMaterial({ color: COLORS.MAGENTA });

  // feixes de luz fake sob os holofotes (mesmo truque do SUBSOLO)
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTexture(),
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const lightShaft = (x: number, z: number, w = 1.5) => {
    for (const ry of [0, Math.PI / 2]) {
      const shaft = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.6), beamMat);
      shaft.position.set(x, 2.3, z);
      shaft.rotation.y = ry;
      shaft.renderOrder = 20;
      decorStatics.add(shaft);
    }
  };

  // --- piso e teto (entram no raycast das balas) ---
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 38), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  solids.push(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(48, 38), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 4.6;
  scene.add(ceil);
  solids.push(ceil);

  // --- vigas do teto + lustres ---
  for (let bx = -18; bx <= 18; bx += 6) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 32.6), darkMetal);
    beam.position.set(bx, 4.38, 0);
    decorStatics.add(beam);
  }
  const chandelier = (x: number, z: number) => {
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6),
      darkMetal
    );
    cord.position.set(x, 4.25, z);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 0.22, 10), goldMat);
    bowl.position.set(x, 3.86, z);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lampMat);
    glow.position.set(x, 3.74, z);
    decorStatics.add(cord);
    decorStatics.add(bowl);
    decorStatics.add(glow);
  };
  chandelier(-6, 1.5);
  chandelier(6, 1.5);
  chandelier(0, -5);
  chandelier(0, 12.5); // foyer

  // --- construtor de parede (colisão + malha + rodapé + friso) ---
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

    const bb = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.24, d + 0.05), trimMat);
    bb.position.set(x, 0.12, z);
    bb.receiveShadow = true;
    decorStatics.add(bb);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.09, d + 0.04), trimMat);
    cap.position.set(x, h - 0.045, z);
    decorStatics.add(cap);
    return m;
  };

  // --- coluna (fuste + capitel dourado + base hazard) ---
  const column = (x: number, z: number) => {
    const s = 0.9;
    const geo = new THREE.BoxGeometry(s, 4.6, s);
    const [ox, oy] = uvOffset();
    scaleBoxUV(geo, s, 4.6, s, 1.5, ox, oy);
    const m = new THREE.Mesh(geo, metalMat);
    m.position.set(x, 2.3, z);
    m.castShadow = true;
    m.receiveShadow = true;
    solidStatics.add(m);
    colliders.push({ minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2 });

    const hz = new THREE.Mesh(new THREE.BoxGeometry(s + 0.05, 0.55, s + 0.05), hazardMat);
    hz.position.set(x, 0.275, z);
    decorStatics.add(hz);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(s + 0.08, 0.14, s + 0.08), goldMat);
    cap.position.set(x, 4.5, z);
    decorStatics.add(cap);
    return m;
  };

  // --- caixote/poltrona (colisão AABB rotacionada, como o SUBSOLO) ---
  let crateIdx = 0;
  const crate = (x: number, z: number, s: number) => {
    const geo = new THREE.BoxGeometry(s, s, s);
    const [ox, oy] = uvOffset();
    scaleBoxUV(geo, s, s, s, 1.5, ox, oy);
    const m = new THREE.Mesh(geo, crateMats[crateIdx % crateMats.length]);
    crateIdx++;
    m.position.set(x, s / 2, z);
    m.rotation.y = (x * 13.7 + z * 7.3) % 0.5 - 0.25;
    m.castShadow = true;
    m.receiveShadow = true;
    solidStatics.add(m);
    const c = Math.cos(m.rotation.y);
    const sn = Math.sin(m.rotation.y);
    const ex = (s / 2) * (Math.abs(c) + Math.abs(sn));
    const ez = (s / 2) * (Math.abs(sn) + Math.abs(c));
    colliders.push({ minX: x - ex, maxX: x + ex, minZ: z - ez, maxZ: z + ez });
    const strap = new THREE.Mesh(new THREE.BoxGeometry(s + 0.02, 0.14, s + 0.02), hazardMat);
    strap.position.copy(m.position);
    strap.position.y = s - 0.09;
    strap.rotation.y = m.rotation.y;
    decorStatics.add(strap);
    return m;
  };

  // ================= MAPA (44 × 34 interno) =================
  // Perímetro (teto de teatro, 4,6m)
  wall(0, -17, 45, 1, 4.6);
  wall(0, 17, 45, 1, 4.6);
  wall(-22, 0, 1, 35, 4.6);
  wall(22, 0, 1, 35, 4.6);

  // Divisória do FOYER (sul) — três portas: oeste, CENTRAL (alinhaba ao
  // spawn), leste. O CORO nasce no saguão e escolhe por onde entra.
  wall(-9, 10, 13, 1, 3.6); // x ∈ [-15.5, -2.5]
  wall(9, 10, 13, 1, 3.6); // x ∈ [2.5, 15.5]

  // Portalões das lanes (não fecham o corredor — marcam a travessia)
  wall(-14, 8.25, 1.2, 2.5, 3.2); // oeste: CAMARINS ↔ plateia
  wall(14, 8.25, 1.2, 2.5, 3.2); // leste: GALERIA ↔ plateia

  // Camarins: salinha sudoeste com porta
  wall(-19, 2, 4, 1, 3.2); // x ∈ [-21, -17]

  // Muro C: separa o CAMAROTE A da plateia (passagem a oeste, x ∈ [-14.6, -10])
  wall(-5, -7.5, 10, 1.2, 3.2); // x ∈ [-10, 0]

  // Separador A/B no norte (o "caminho de bastidores" entre os sites)
  wall(1.5, -12.5, 1.2, 7, 3.2); // z ∈ [-16, -9]

  // MURETA DO PALCO: 1,1m — bloqueia passagem, não a visão de longe
  wall(11.75, -7, 15.1, 1, 1.1); // x ∈ [4.2, 19.3]
  // friso dourado no topo da mureta (marca o palco)
  const muretaGold = new THREE.Mesh(new THREE.BoxGeometry(15.3, 0.08, 1.12), goldMat);
  muretaGold.position.set(11.75, 1.13, -7);
  decorStatics.add(muretaGold);

  // Colunas da galeria
  column(16.9, 2.5);
  column(16.9, -3.5);

  // Fileiras da PLATEIA (cobertura baixa; corredor central livre)
  const SEAT_ROWS: Array<[number, Array<number>]> = [
    [-3, [-9, -6, -3, 3, 6, 9]],
    [0, [-10.5, -7.5, -4.5, 4.5, 7.5, 10.5]],
    [3, [-9, -6, -3, 3, 6, 9]],
    [6, [-10.5, -7.5, -4.5, 4.5, 7.5, 10.5]],
  ];
  for (const [rz, xs] of SEAT_ROWS) {
    for (const rx of xs) crate(rx, rz, 1.15);
  }

  // Caixotes de cobertura avulsa
  crate(-20, -13, 1.3); // dentro do CAMAROTE A
  crate(-12, -15, 1.1); // borda norte do A
  crate(20, -14, 1.3); // fundo do palco B
  crate(-18, 6, 1.2); // camarins
  crate(-20.5, 0.5, 1.0); // camarins (porta)
  crate(20.5, 8.2, 1.2); // galeria sul
  crate(20.5, -14.5, 1.1); // galeria → bastidores do palco
  crate(-11.5, -1.5, 1.2); // plateia oeste (fora da linha do carry)
  crate(11.5, -5.5, 1.2); // plateia leste

  // --- PALCO: plataforma de madeira (12cm, visual — sem colisor) ---
  const stage = new THREE.Mesh(new THREE.BoxGeometry(18.5, 0.12, 9.3), stageMat);
  stage.position.set(12.25, 0.06, -12.25);
  stage.receiveShadow = true;
  decorStatics.add(stage);
  // faixa hazard na boca do palco (borda da mureta vista do público)
  const stageEdge = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.1, 0.24), hazardMat);
  stageEdge.position.set(12.2, 0.11, -7.55);
  decorStatics.add(stageEdge);

  // --- arco do proscênio sobre o vão do palco (passa POR BAIXO) ---
  const arch = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.6, 0.8), goldMat);
  arch.position.set(1.85, 3.7, -7);
  decorStatics.add(arch);
  const archLegL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.8, 0.6), goldMat);
  archLegL.position.set(-0.55, 1.9, -7); // colado no fim do muro C
  const archLegR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.8, 0.6), goldMat);
  archLegR.position.set(4.25, 1.9, -7); // colado na mureta
  decorStatics.add(archLegL);
  decorStatics.add(archLegR);

  // --- cortinas: pano de fundo do palco + pernas laterais ---
  const backCurtain = new THREE.Mesh(new THREE.BoxGeometry(16.4, 4.5, 0.3), curtainMat);
  backCurtain.position.set(12.2, 2.25, -16.6);
  backCurtain.receiveShadow = true;
  decorStatics.add(backCurtain);
  const legCurtain = (x: number, z: number, w: number, d: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 4.5, d), curtainMat);
    m.position.set(x, 2.25, z);
    decorStatics.add(m);
  };
  legCurtain(21.3, -13.5, 0.3, 5.5); // perna leste do palco (na parede)
  // sanefa (valance) sobre o arco
  const valance = new THREE.Mesh(new THREE.BoxGeometry(17, 0.9, 0.22), curtainMat);
  valance.position.set(12.2, 4.1, -7.15);
  decorStatics.add(valance);
  // cortina curta nas paredes do CAMAROTE A
  const camCurtain = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 7), curtainMat);
  camCurtain.position.set(-21.34, 1.8, -11.5);
  decorStatics.add(camCurtain);

  // --- apliques de parede (luz morna, só emissiva) ---
  const sconceAt = (x: number, y: number, z: number, ry: number) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.1), goldMat);
    base.position.set(x, y, z);
    base.rotation.y = ry;
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lampMat);
    cup.position.set(x, y + 0.32, z);
    decorStatics.add(base);
    decorStatics.add(cup);
  };
  for (const z of [-6, 2]) {
    sconceAt(-21.42, 2.4, z, Math.PI / 2);
    sconceAt(21.42, 2.4, z, -Math.PI / 2);
  }
  for (const x of [-14, -8, 8, 14]) {
    sconceAt(x, 2.4, 16.42, Math.PI);
  }

  // --- tapete vermelho do foyer (spawn → porta central) ---
  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 5.6),
    new THREE.MeshStandardMaterial({ color: 0x571c28, roughness: 0.96, metalness: 0.0 })
  );
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.012, 13.4);
  carpet.receiveShadow = true;
  decorStatics.add(carpet);
  const goldRun = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.015, 0.18),
    goldMat
  );
  goldRun.position.set(0, 0.02, 10.7);
  decorStatics.add(goldRun);

  // --- marcação do SPAWN (faixa teal no chão) ---
  const spawnMark = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 1.1),
    new THREE.MeshBasicMaterial({
      color: COLORS.TEAL,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  spawnMark.rotation.x = -Math.PI / 2;
  spawnMark.position.set(0, 0.02, 15.4);
  decorStatics.add(spawnMark);

  // --- bilheteria do foyer ---
  crate(10, 13, 1.3);
  crate(11.6, 14.2, 1.1);

  // ================= FUNDE A GEOMETRIA ESTÁTICA =================
  solids.push(...solidStatics.build());
  decorStatics.build();

  // --- DIAPASÃO plantado (visual compartilhado, Etapa 14) ---
  const viz = new PlantViz(scene);

  // --- pedestais de plantio (um por site, sempre visíveis) ---
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
  pedestalAt(SITES.A.x, SITES.A.z, tealGlow);
  pedestalAt(SITES.B.x, SITES.B.z, magentaGlow);

  // --- moldura pintada dos sites no chão (y por superfície: o site B é
  // pintado EM CIMA da plataforma do palco, não no piso) ---
  const siteFrame = (x: number, z: number, color: number, y: number) => {
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
    fill.position.set(x, y - 0.003, z);
    decorStatics.add(fill);
  };
  siteFrame(SITES.A.x, SITES.A.z, COLORS.TEAL, 0.02); // piso do camarote
  siteFrame(SITES.B.x, SITES.B.z, COLORS.MAGENTA, 0.135); // topo do palco

  // --- placas A / B (parede do fundo do palco e do camarote) ---
  const letterA = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 2.5),
    new THREE.MeshBasicMaterial({ map: letterTexture('A', COLORS.TEAL), transparent: true })
  );
  letterA.position.set(-15, 2.55, -16.44);
  decorStatics.add(letterA);
  const letterB = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 2.5),
    new THREE.MeshBasicMaterial({ map: letterTexture('B', COLORS.MAGENTA), transparent: true })
  );
  letterB.position.set(11, 3.0, -16.28); // pendurada à frente do pano de fundo
  decorStatics.add(letterB);

  // --- pilonas de sinal nos cantos dos sites (pulsam por material clonado) ---
  const pylonAt = (x: number, z: number, mat: THREE.MeshBasicMaterial) => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 0.3), darkMetal);
    col.position.set(x, 1.7, z);
    col.castShadow = true;
    decorStatics.add(col);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.3, 0.02), mat);
    strip.position.set(x, 1.62, z + 0.17);
    scene.add(strip);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.36), mat);
    top.position.set(x, 3.42, z);
    scene.add(top);
    return strip.material as THREE.MeshBasicMaterial;
  };
  const pylonA = pylonAt(-16.6, -14.6, tealGlow.clone());
  const pylonB = pylonAt(18.6, -15.2, magentaGlow.clone());

  // ================= ILUMINAÇÃO =================
  // teatro ao anoitecer: hemisfério morno + holofote principal quente
  const hemi = new THREE.HemisphereLight(0xc9b8a8, 0x2e2118, 1.3);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffe2b0, 3.0);
  dir.position.set(8, 17, -6);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.left = -26;
  dir.shadow.camera.right = 26;
  dir.shadow.camera.top = 22;
  dir.shadow.camera.bottom = -22;
  dir.shadow.camera.near = 4;
  dir.shadow.camera.far = 60;
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

  const siteALight = new THREE.PointLight(COLORS.TEAL, 11, 17, 1.6);
  siteALight.position.set(-15, 2.8, -11);
  scene.add(siteALight);
  const stageLight = new THREE.PointLight(COLORS.MAGENTA, 13, 19, 1.6);
  stageLight.position.set(11, 3.4, -11);
  scene.add(stageLight);
  const plateiaLight = new THREE.PointLight(0xffe8c8, 8, 15, 1.6);
  plateiaLight.position.set(0, 3.6, 1);
  scene.add(plateiaLight);
  const foyerLight = new THREE.PointLight(0xffd9a0, 7, 13, 1.6);
  foyerLight.position.set(0, 3.6, 13.5);
  scene.add(foyerLight);

  // feixes nos pontos dramáticos
  lightShaft(-15, -11, 1.9); // CAMAROTE A
  lightShaft(11, -11, 2.2); // palco B
  lightShaft(0, 1, 1.2); // plateia
  lightShaft(0, 13.5, 1.2); // foyer

  const update = (dt: number, t: number) => {
    viz.update(dt, t);
    siteALight.intensity = 11 + Math.sin(t * 3.4) * 3.5;
    stageLight.intensity = 13 + Math.sin(t * 3.4 + Math.PI) * 4;
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

  // footprint congelado dos colisores para o minimapa
  const walls = colliders.map((c) => ({ ...c }));

  return { update, colliders, solids, walls, plant, clearPlant, setShadowResolution };
}
