import * as THREE from 'three';
import { COLORS, SITES } from '../config/constants';
import { StaticBuckets } from '../core/merge';
import {
  beamTexture,
  concreteTexture,
  floorTilesTexture,
  hazardTexture,
  letterTexture,
  metalPanelTexture,
  scaleBoxUV,
} from '../core/textures';

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface SceneBundle {
  update: (dt: number, t: number) => void;
  colliders: AABB[]; // blocam o jogador
  solids: THREE.Object3D[]; // param balas (raycast)
  /** snapshot estático dos colisores (footprint do minimapa, Etapa 13) */
  walls: AABB[];
  /** posiciona o Diapasão plantado no site e inicia o anel de pulso */
  plant: (site: 'A' | 'B') => void;
  /** remove o Diapasão plantado (início de rodada) */
  clearPlant: () => void;
  /** redimensiona o mapa de sombra (qualidade, Etapa 10) */
  setShadowResolution: (px: number) => void;
}

/**
 * SUBSOLO — estação de metrô desativada (mapa da etapa 3, direção de arte da
 * etapa 9, desempenho da etapa 10).
 *
 * Layout tático (vista de cima, norte = -Z):
 *
 *   ┌──────────┬──────────────┬──────────┐
 *   │  SITE A  │    fundo      │  SITE B  │
 *   │ (teal)   │              │ (magenta)│
 *   └───┬──────┴── muro C ────┴────┬─────┘
 *   A MAIN │     ┌────────┐       │ B MAIN
 *   (oeste)│     │ CONCURSO│       │ (leste)
 *   muro L │     └───┬────┘       │ muro R
 *         └── MEIO (trilhos) ──┘
 *              SPAWN CORO (sul)
 *
 * Etapa 9: texturas procedurais, iluminação com sombras, vigas, luminárias,
 * canos, rodapés, placas de site, trilhos com dormentes e pedestal.
 * Etapa 10: toda a geometria ESTÁTICA é fundida por material (StaticBuckets)
 * — o cenário inteiro desenha em ~25 chamadas em vez de ~170. As COLISÕES
 * e os SÓLIDOS continuam exatamente os mesmos das etapas anteriores.
 */
export function buildSubsolo(scene: THREE.Scene): SceneBundle {
  const colliders: AABB[] = [];
  const solids: THREE.Object3D[] = [];

  // geometria estática: sólida (para balas) e decorativa
  const solidStatics = new StaticBuckets(scene);
  const decorStatics = new StaticBuckets(scene);

  scene.background = new THREE.Color(0x0a0d12);
  scene.fog = new THREE.FogExp2(0x0a0d12, 0.018);

  // --- texturas procedurais (geradas uma vez) ---
  const texConc = concreteTexture(0x5a6169, 7);
  const texFloor = floorTilesTexture();
  const texMetal = metalPanelTexture(3);

  // --- materiais compartilhados ---
  const wallMat = new THREE.MeshStandardMaterial({
    map: texConc,
    roughness: 0.94,
    metalness: 0.03,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    map: texFloor,
    roughness: 0.76,
    metalness: 0.06,
  });
  floorMat.map!.repeat.set(11, 9); // 4m por ladrilho → placa de 1m
  const ceilMat = new THREE.MeshStandardMaterial({
    map: texConc,
    color: 0x8a9098, // escurece o concreto p/ laje de teto
    roughness: 0.96,
    metalness: 0.02,
  });
  // SEM envmap no WebGL1 do expo-gl: metalness alto = preto. Valores baixos
  // e cor clara dão o "metal pintado" legível.
  const metalMat = new THREE.MeshStandardMaterial({
    map: texMetal,
    roughness: 0.52,
    metalness: 0.28,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x343a43,
    roughness: 0.6,
    metalness: 0.18,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x272c33,
    roughness: 0.72,
    metalness: 0.12,
  });
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTexture(),
    roughness: 0.92,
    metalness: 0.04,
  });
  const crateMats = [
    new THREE.MeshStandardMaterial({
      map: texMetal,
      color: 0xaec3d6,
      roughness: 0.62,
      metalness: 0.15,
    }),
    new THREE.MeshStandardMaterial({
      map: texMetal,
      color: 0xd8c6a8,
      roughness: 0.66,
      metalness: 0.14,
    }),
    new THREE.MeshStandardMaterial({
      map: texMetal,
      color: 0x9aa3ae,
      roughness: 0.64,
      metalness: 0.15,
    }),
  ];
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2d4 });
  const tealGlow = new THREE.MeshBasicMaterial({ color: COLORS.TEAL });
  const magentaGlow = new THREE.MeshBasicMaterial({ color: COLORS.MAGENTA });

  // feixes de luz fake (quads aditivos cruzados sob as luzes-chave) — dão
  // volume de "luz volumétrica" barato e estável em WebGL1
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTexture(),
    transparent: true,
    opacity: 0.34,
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
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 36), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  solids.push(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(44, 36), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 3.8;
  // teto NÃO projeta sombra — deixa a "luz-chave" atravessar e desenhar as
  // sombras de paredes/colunas/caixotes no chão (padrão Valorant)
  scene.add(ceil);
  solids.push(ceil);

  // --- vigas do teto ---
  for (let bx = -18; bx <= 18; bx += 6) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 30.6), darkMetal);
    beam.position.set(bx, 3.6, 0);
    decorStatics.add(beam);
  }

  // --- luminárias penduradas (casa escura + tubo emissivo) ---
  const lampHouseGeo = new THREE.BoxGeometry(1.02, 0.09, 0.27);
  const lampTubeGeo = new THREE.BoxGeometry(0.88, 0.05, 0.19);
  const lampAt = (x: number, z: number) => {
    const house = new THREE.Mesh(lampHouseGeo, darkMetal);
    house.position.set(x, 3.55, z);
    const tube = new THREE.Mesh(lampTubeGeo, lampMat);
    tube.position.set(x, 3.49, z);
    decorStatics.add(house);
    decorStatics.add(tube);
  };
  for (const z of [-9, -3, 3, 9]) {
    lampAt(-13, z);
    lampAt(13, z);
  }
  for (const z of [-8.5, -2, 5, 11]) {
    lampAt(0, z);
  }
  lampAt(-13, -12.5); // sobre o SITE A
  lampAt(13, -12.5); // sobre o SITE B

  // feixes nos pontos de luz dramáticos
  lightShaft(0, -8); // Concurso
  lightShaft(0, 11, 1.2); // MEIO/spawn
  lightShaft(-13, -12.5, 1.9); // SITE A
  lightShaft(13, -12.5, 1.9); // SITE B

  // --- canos nas paredes do perímetro ---
  const pipeAlongX = new THREE.CylinderGeometry(0.055, 0.055, 39, 8);
  for (const z of [-15.34, 15.34]) {
    for (const y of [3.28, 3.44]) {
      const pipe = new THREE.Mesh(pipeAlongX, darkMetal);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, y, z);
      decorStatics.add(pipe);
    }
  }
  const pipeAlongZ = new THREE.CylinderGeometry(0.055, 0.055, 30.6, 8);
  for (const x of [-19.34, 19.34]) {
    const pipe = new THREE.Mesh(pipeAlongZ, darkMetal);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, 3.36, 0);
    decorStatics.add(pipe);
  }

  // --- grades de ventilação nos muros (quebram a monotonia do concreto) ---
  const ventFrameGeo = new THREE.BoxGeometry(1.0, 0.62, 0.08);
  const ventCoreGeo = new THREE.BoxGeometry(0.84, 0.46, 0.06);
  const ventCoreMat = new THREE.MeshStandardMaterial({
    color: 0x14171c,
    roughness: 0.9,
    metalness: 0.1,
  });
  const ventAt = (x: number, y: number, z: number, ry: number) => {
    const frame = new THREE.Mesh(ventFrameGeo, metalMat);
    frame.position.set(x, y, z);
    frame.rotation.y = ry;
    const core = new THREE.Mesh(ventCoreGeo, ventCoreMat);
    core.position.set(x, y, z);
    core.rotation.y = ry;
    core.translateZ(0.02);
    decorStatics.add(frame);
    decorStatics.add(core);
  };
  ventAt(-19.44, 2.05, -4, Math.PI / 2); // parede oeste
  ventAt(-19.44, 2.05, 6, Math.PI / 2);
  ventAt(19.44, 2.05, 4, -Math.PI / 2); // parede leste
  ventAt(19.44, 2.05, -6, -Math.PI / 2);
  ventAt(-6, 2.05, -15.44, 0); // parede norte (fundo)
  ventAt(6, 2.05, -15.44, 0);
  ventAt(-7.62, 1.5, 6, Math.PI / 2); // muro L (face A MAIN)
  ventAt(7.62, 1.5, -3, -Math.PI / 2); // muro R (face B MAIN)

  // --- construtor de parede (colisão + malha + rodapé + friso) ---
  // deslocamento de UV por parede (razões áureas) desalinha o padrão do
  // concreto entre superfícies — mata a sensação de "textura repetida"
  let wallCount = 0;
  const uvOffset = () => {
    wallCount++;
    return [((wallCount * 0.618) % 1) * 4, ((wallCount * 0.381) % 1) * 4] as const;
  };
  const wall = (x: number, z: number, w: number, d: number, h: number) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const [ox, oy] = uvOffset();
    scaleBoxUV(geo, w, h, d, 2.2, ox, oy); // densidade constante de concreto
    const m = new THREE.Mesh(geo, wallMat);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    solidStatics.add(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

    // rodapé escuro
    const bb = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.24, d + 0.05), trimMat);
    bb.position.set(x, 0.12, z);
    bb.receiveShadow = true;
    decorStatics.add(bb);
    // friso superior
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.09, d + 0.04), trimMat);
    cap.position.set(x, h - 0.045, z);
    decorStatics.add(cap);
    return m;
  };

  // --- coluna estrutural (painel metálico + faixa hazard na base) ---
  const column = (x: number, z: number) => {
    const s = 0.9;
    const geo = new THREE.BoxGeometry(s, 3.8, s);
    const [ox, oy] = uvOffset();
    scaleBoxUV(geo, s, 3.8, s, 1.5, ox, oy);
    const m = new THREE.Mesh(geo, metalMat);
    m.position.set(x, 1.9, z);
    m.castShadow = true;
    m.receiveShadow = true;
    solidStatics.add(m);
    colliders.push({ minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2 });

    const hz = new THREE.Mesh(new THREE.BoxGeometry(s + 0.05, 0.55, s + 0.05), hazardMat);
    hz.position.set(x, 0.275, z);
    decorStatics.add(hz);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(s + 0.06, 0.1, s + 0.06), trimMat);
    cap.position.set(x, 3.75, z);
    decorStatics.add(cap);
    return m;
  };

  // --- caixote (colisão igual às etapas anteriores; painel metálico tingido) ---
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
    // cinta hazard no topo (identidade visual dos abrigos)
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(s + 0.02, 0.14, s + 0.02),
      hazardMat
    );
    strap.position.copy(m.position);
    strap.position.y = s - 0.09;
    strap.rotation.y = m.rotation.y;
    decorStatics.add(strap);
    return m;
  };

  // ================= MAPA =================
  // Perímetro (40 × 32 interno)
  wall(0, -16, 41, 1, 3.8);
  wall(0, 16, 41, 1, 3.8);
  wall(-20, 0, 1, 33, 3.8);
  wall(20, 0, 1, 33, 3.8);

  // Divisórias das lanes (do spawn ao fundo): A MAIN | MEIO | B MAIN
  wall(-7, 2, 1.2, 16, 3.2); // muro L
  wall(7, 2, 1.2, 16, 3.2); // muro R

  // Muro C — separa SITE A de SITE B e molda o Concurso
  wall(0, -11.5, 12, 1.2, 3.2);

  // Colunas do Meio (cobertura)
  column(-3.2, 6);
  column(3.2, 6);
  column(-3.2, -2);
  column(3.2, -2);

  // Caixotes de cobertura
  crate(-14, 3, 1.4); // A MAIN
  crate(-15.5, 2, 1.1); // A MAIN empilhável
  crate(14, 0, 1.4); // B MAIN
  crate(15.5, 1, 1.1); // B MAIN
  crate(-16, -13, 1.3); // dentro SITE A
  crate(-10.5, -14, 1.1); // borda SITE A
  crate(16, -13, 1.3); // dentro SITE B
  crate(10.5, -14, 1.1); // borda SITE B
  crate(-4.5, -8.5, 1.2); // Concurso oeste
  crate(4.5, -8.5, 1.2); // Concurso leste

  // Trilhos no Meio + dormentes (visuais — 10cm, não bloqueiam)
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x5a626c,
    roughness: 0.42,
    metalness: 0.4,
  });
  for (const rx of [-1.1, 1.1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 15), railMat);
    rail.position.set(rx, 0.06, 2.2);
    rail.castShadow = true;
    decorStatics.add(rail);
  }
  const tieGeo = new THREE.BoxGeometry(2.7, 0.09, 0.26);
  const tieMat = new THREE.MeshStandardMaterial({
    map: texConc,
    color: 0x8a6a45, // madeira gasta tingida sobre o concreto
    roughness: 0.92,
    metalness: 0.02,
  });
  for (let i = 0; i < 11; i++) {
    const tie = new THREE.Mesh(tieGeo, tieMat);
    tie.position.set(0, 0.045, -4.8 + i * 1.4);
    tie.receiveShadow = true;
    decorStatics.add(tie);
  }

  // --- faixas de ressonância (accent emissivo nas divisórias) ---
  const stripAlongZ = (x: number, z: number, len: number, mat: THREE.Material) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, len), mat);
    s.position.set(x, 2.55, z);
    decorStatics.add(s);
  };
  stripAlongZ(-7.63, 2, 15.6, tealGlow); // muro L, face oeste (A MAIN)
  stripAlongZ(7.63, 2, 15.6, magentaGlow); // muro R, face leste (B MAIN)
  const stripA = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.1, 0.02), tealGlow);
  stripA.position.set(-3.2, 2.55, -10.93);
  decorStatics.add(stripA);
  const stripB = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.1, 0.02), magentaGlow);
  stripB.position.set(3.2, 2.55, -10.93);
  decorStatics.add(stripB);

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
  spawnMark.position.set(0, 0.02, 13.5);
  decorStatics.add(spawnMark);

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

  // --- moldura pintada dos sites no chão ---
  const siteFrame = (x: number, z: number, color: number) => {
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
      m.position.set(x + sx, 0.021, z + sz);
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
    fill.position.set(x, 0.015, z);
    decorStatics.add(fill);
  };
  siteFrame(SITES.A.x, SITES.A.z, COLORS.TEAL);
  siteFrame(SITES.B.x, SITES.B.z, COLORS.MAGENTA);

  // --- placas A / B na parede do fundo ---
  const letterA = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 2.5),
    new THREE.MeshBasicMaterial({ map: letterTexture('A', COLORS.TEAL), transparent: true })
  );
  letterA.position.set(-13, 2.35, -15.44);
  decorStatics.add(letterA);
  const letterB = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 2.5),
    new THREE.MeshBasicMaterial({ map: letterTexture('B', COLORS.MAGENTA), transparent: true })
  );
  letterB.position.set(13, 2.35, -15.44);
  decorStatics.add(letterB);

  // --- pilonas de sinal nos cantos dos sites ---
  // (tiras/top PULSAM por material clonado — ficam fora do merge)
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
  const pylonA = pylonAt(-14.7, -14.5, tealGlow.clone());
  const pylonB = pylonAt(14.7, -14.5, magentaGlow.clone());

  // ================= FUNDE A GEOMETRIA ESTÁTICA =================
  // paredes/colunas/caixotes fundidos param balas; o resto é decoração
  solids.push(...solidStatics.build());
  decorStatics.build();

  // --- DIAPASÃO (núcleo que viaja com o jogador e é plantado) ---
  const diapOuter = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.62, 0)),
    new THREE.LineBasicMaterial({ color: COLORS.TEAL, transparent: true, opacity: 0.85 })
  );
  const diapRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.02, 8, 40),
    new THREE.MeshBasicMaterial({ color: COLORS.MAGENTA })
  );
  const diapCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.15, 0),
    new THREE.MeshBasicMaterial({ color: 0xd9fff4 })
  );
  const diapasao = new THREE.Group();
  diapasao.add(diapOuter, diapRing, diapCore);
  diapasao.visible = false; // o Diapasão viaja com o jogador (Etapa 5)
  scene.add(diapasao);

  // anel de pulso que expande do Diapasão plantado
  const pulseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.82, 48),
    new THREE.MeshBasicMaterial({
      color: COLORS.TEAL,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  pulseRing.rotation.x = -Math.PI / 2;
  pulseRing.visible = false;
  scene.add(pulseRing);
  let pulseT = 0;

  // ================= ILUMINAÇÃO =================
  // luz-chave quente atravessando o teto (propositadamente) — desenha as
  // sombras no chão e modela os volumes; hemisfério gelado como preenchimento
  const hemi = new THREE.HemisphereLight(0x9db1c7, 0x3a352e, 1.35);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffe7c4, 3.2);
  dir.position.set(9, 17, 7);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.left = -24;
  dir.shadow.camera.right = 24;
  dir.shadow.camera.top = 20;
  dir.shadow.camera.bottom = -20;
  dir.shadow.camera.near = 4;
  dir.shadow.camera.far = 55;
  dir.shadow.bias = -0.0005;
  dir.shadow.normalBias = 0.03;
  scene.add(dir);

  const setShadowResolution = (px: number) => {
    dir.shadow.mapSize.set(px, px);
    // força recriação do mapa na próxima passada
    if (dir.shadow.map) {
      dir.shadow.map.dispose();
      (dir.shadow as unknown as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
  };

  const siteALight = new THREE.PointLight(COLORS.TEAL, 12, 17, 1.6);
  siteALight.position.set(-13, 2.6, -12.5);
  scene.add(siteALight);
  const siteBLight = new THREE.PointLight(COLORS.MAGENTA, 8.5, 15, 1.6);
  siteBLight.position.set(13, 2.6, -12.5);
  scene.add(siteBLight);
  const midLight = new THREE.PointLight(0xfff4e0, 9, 15, 1.6);
  midLight.position.set(0, 3.1, -8);
  scene.add(midLight);

  const update = (dt: number, t: number) => {
    diapOuter.rotation.y += dt * 0.5;
    diapOuter.rotation.x += dt * 0.13;
    diapRing.rotation.x += dt * 1.1;
    diapRing.rotation.y -= dt * 0.7;
    diapasao.position.y = 1.15 + Math.sin(t * 1.7) * 0.1;
    diapCore.scale.setScalar(0.9 + Math.sin(t * 3.4) * 0.28);
    diapCore.rotation.y += dt * 2.2;
    siteALight.intensity = 12 + Math.sin(t * 3.4) * 4; // o pulso
    siteBLight.intensity = 8.5 + Math.sin(t * 3.4 + Math.PI) * 2.5;
    pylonA.opacity = 0.75 + Math.abs(Math.sin(t * 2.2)) * 0.25;
    pylonB.opacity = 0.75 + Math.abs(Math.sin(t * 2.2 + 0.8)) * 0.25;

    // anel do Diapasão plantado: expande em loop
    if (pulseRing.visible) {
      pulseT += dt * 0.55;
      if (pulseT > 1) pulseT -= 1;
      pulseRing.scale.setScalar(0.6 + pulseT * 3.2);
      (pulseRing.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - pulseT);
    }
  };

  const plant = (site: 'A' | 'B') => {
    const s = site === 'A' ? SITES.A : SITES.B;
    diapasao.visible = true;
    diapasao.position.set(s.x, 1.15, s.z);
    pulseRing.visible = true;
    pulseRing.position.set(s.x, 0.05, s.z);
    pulseT = 0;
  };

  const clearPlant = () => {
    diapasao.visible = false;
    pulseRing.visible = false;
  };

  // footprint congelado dos colisores para o minimapa (antes da BARREIRA,
  // que liga/desliga colisores em tempo de jogo, existir aqui)
  const walls = colliders.map((c) => ({ ...c }));

  return { update, colliders, solids, walls, plant, clearPlant, setShadowResolution };
}
