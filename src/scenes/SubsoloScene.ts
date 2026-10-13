import * as THREE from 'three';
import { COLORS, SITES } from '../config/constants';

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
  /** posiciona o Diapasão plantado no site e inicia o anel de pulso */
  plant: (site: 'A' | 'B') => void;
  /** remove o Diapasão plantado (início de rodada) */
  clearPlant: () => void;
}

/**
 * SUBSOLO — estação de metrô desativada (mapa da etapa 3).
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
 */
export function buildSubsolo(scene: THREE.Scene): SceneBundle {
  const colliders: AABB[] = [];
  const solids: THREE.Object3D[] = [];

  scene.background = new THREE.Color(COLORS.BG);
  scene.fog = new THREE.FogExp2(COLORS.BG, 0.028);

  // --- materiais compartilhados ---
  const wallMat = new THREE.MeshStandardMaterial({
    color: COLORS.WALL,
    roughness: 0.92,
    metalness: 0.05,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: COLORS.FLOOR,
    roughness: 0.95,
    metalness: 0.02,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: COLORS.RAIL,
    roughness: 0.4,
    metalness: 0.75,
  });
  const crateMat = new THREE.MeshStandardMaterial({
    color: COLORS.CRATE,
    roughness: 0.85,
    metalness: 0.15,
  });
  const edgeTeal = new THREE.LineBasicMaterial({
    color: COLORS.TEAL,
    transparent: true,
    opacity: 0.75,
  });
  const edgeMagenta = new THREE.LineBasicMaterial({
    color: COLORS.MAGENTA,
    transparent: true,
    opacity: 0.75,
  });

  // --- piso e teto (entram no raycast das balas) ---
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 36), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  solids.push(floor);

  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 36),
    new THREE.MeshBasicMaterial({ color: COLORS.CEIL, side: THREE.DoubleSide })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 3.8;
  scene.add(ceil);
  solids.push(ceil);

  // --- construtor de parede (colisão + malha) ---
  const wall = (x: number, z: number, w: number, d: number, h: number, edge?: THREE.LineBasicMaterial) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, wallMat);
    m.position.set(x, h / 2, z);
    scene.add(m);
    solids.push(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    if (edge) {
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge);
      lines.position.copy(m.position);
      scene.add(lines);
    }
    return m;
  };

  // --- caixote (colisão + aresta neon) ---
  const crate = (x: number, z: number, s: number, ally: boolean) => {
    const geo = new THREE.BoxGeometry(s, s, s);
    const m = new THREE.Mesh(geo, crateMat);
    m.position.set(x, s / 2, z);
    m.rotation.y = (x * 13.7 + z * 7.3) % 0.5 - 0.25;
    scene.add(m);
    solids.push(m);
    const c = Math.cos(m.rotation.y);
    const sn = Math.sin(m.rotation.y);
    const ex = (s / 2) * (Math.abs(c) + Math.abs(sn));
    const ez = (s / 2) * (Math.abs(sn) + Math.abs(c));
    colliders.push({ minX: x - ex, maxX: x + ex, minZ: z - ez, maxZ: z + ez });
    const lines = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      ally ? edgeTeal : edgeMagenta
    );
    lines.position.copy(m.position);
    lines.rotation.copy(m.rotation);
    scene.add(lines);
  };

  // ================= MAPA =================
  // Perímetro (40 × 32 interno)
  wall(0, -16, 41, 1, 3.8);
  wall(0, 16, 41, 1, 3.8);
  wall(-20, 0, 1, 33, 3.8);
  wall(20, 0, 1, 33, 3.8);

  // Divisórias das lanes (do spawn ao fundo): A MAIN | MEIO | B MAIN
  wall(-7, 2, 1.2, 16, 3.2, edgeTeal); // muro L
  wall(7, 2, 1.2, 16, 3.2, edgeTeal); // muro R

  // Muro C — separa SITE A de SITE B e molda o Concurso
  wall(0, -11.5, 12, 1.2, 3.2, edgeTeal);

  // Colunas do Meio (cobertura)
  wall(-3.2, 6, 0.9, 0.9, 3.8);
  wall(3.2, 6, 0.9, 0.9, 3.8);
  wall(-3.2, -2, 0.9, 0.9, 3.8);
  wall(3.2, -2, 0.9, 0.9, 3.8);

  // Caixotes de cobertura
  crate(-14, 3, 1.4, true); // A MAIN
  crate(-15.5, 2, 1.1, true); // A MAIN empilhável
  crate(14, 0, 1.4, false); // B MAIN
  crate(15.5, 1, 1.1, false); // B MAIN
  crate(-16, -13, 1.3, true); // dentro SITE A
  crate(-10.5, -14, 1.1, true); // borda SITE A
  crate(16, -13, 1.3, false); // dentro SITE B
  crate(10.5, -14, 1.1, false); // borda SITE B
  crate(-4.5, -8.5, 1.2, true); // Concurso oeste
  crate(4.5, -8.5, 1.2, false); // Concurso leste

  // Trilhos no Meio (visuais — altura 12cm, não bloqueiam)
  for (const rx of [-1.1, 1.1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 15), railMat);
    rail.position.set(rx, 0.06, 2.2);
    scene.add(rail);
  }

  // --- marcação do SPAWN (faixa teal no chão) ---
  const spawnMark = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 1.6),
    new THREE.MeshBasicMaterial({ color: COLORS.TEAL, transparent: true, opacity: 0.22 })
  );
  spawnMark.rotation.x = -Math.PI / 2;
  spawnMark.position.set(0, 0.02, 13.5);
  scene.add(spawnMark);

  // --- SITE A (oeste, teal) + DIAPASÃO holográfico ---
  const siteA = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 3.6),
    new THREE.MeshBasicMaterial({ color: COLORS.TEAL, transparent: true, opacity: 0.4 })
  );
  siteA.rotation.x = -Math.PI / 2;
  siteA.position.set(-13, 0.03, -12.5);
  scene.add(siteA);

  const diapOuter = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.62, 0)),
    new THREE.LineBasicMaterial({ color: COLORS.TEAL, transparent: true, opacity: 0.9 })
  );
  const diapInner = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.3, 0)),
    new THREE.LineBasicMaterial({ color: COLORS.MAGENTA, transparent: true, opacity: 0.95 })
  );
  const diapCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.11, 1),
    new THREE.MeshBasicMaterial({ color: 0xd9fff4 })
  );
  const diapasao = new THREE.Group();
  diapasao.add(diapOuter, diapInner, diapCore);
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

  // --- SITE B (leste, magenta) + coluna-sinal ---
  const siteB = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 3.6),
    new THREE.MeshBasicMaterial({ color: COLORS.MAGENTA, transparent: true, opacity: 0.4 })
  );
  siteB.rotation.x = -Math.PI / 2;
  siteB.position.set(13, 0.03, -12.5);
  scene.add(siteB);

  const beacon = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 3.6, 0.5),
    new THREE.MeshBasicMaterial({
      color: COLORS.MAGENTA,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  beacon.position.set(13, 1.8, -12.5);
  scene.add(beacon);

  // --- iluminação (pouca, legível, barata) ---
  scene.add(new THREE.AmbientLight(0x303c48, 1.5));
  const dir = new THREE.DirectionalLight(0xcfe0ea, 0.55);
  dir.position.set(4, 10, 6);
  scene.add(dir);
  const siteALight = new THREE.PointLight(COLORS.TEAL, 9, 17, 1.6);
  siteALight.position.set(-13, 2.6, -12.5);
  scene.add(siteALight);
  const siteBLight = new THREE.PointLight(COLORS.MAGENTA, 8, 16, 1.6);
  siteBLight.position.set(13, 2.6, -12.5);
  scene.add(siteBLight);
  const midLight = new THREE.PointLight(0xfff4e0, 7, 13, 1.6);
  midLight.position.set(0, 2.9, -8);
  scene.add(midLight);

  const update = (dt: number, t: number) => {
    diapOuter.rotation.y += dt * 0.5;
    diapOuter.rotation.x += dt * 0.13;
    diapInner.rotation.y -= dt * 1.1;
    diapInner.rotation.x -= dt * 0.42;
    diapasao.position.y = 1.15 + Math.sin(t * 1.7) * 0.1;
    diapCore.scale.setScalar(0.9 + Math.sin(t * 3.4) * 0.28);
    siteALight.intensity = 9 + Math.sin(t * 3.4) * 3.5; // o pulso
    siteBLight.intensity = 8 + Math.sin(t * 3.4 + Math.PI) * 3;
    beacon.material.opacity = 0.16 + Math.abs(Math.sin(t * 2.2)) * 0.14;

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

  return { update, colliders, solids, plant, clearPlant };
}
