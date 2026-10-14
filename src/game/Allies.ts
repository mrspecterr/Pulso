// Esquadrão CORO (Etapa 12) — aliados IA que lutam 5v5 ao seu lado.
//
// Quatro operadores (TENOR, ALTO, BAIXO, CONTRA — vozes do coro) seguem
// a formação ao redor do líder (o jogador) e engajam qualquer DIRAC à
// vista. Máquina de estados por aliado:
//   escort → segue o ponto de formação do líder (catch-up se ficou atrás)
//   engage → DIRAC visível: reação humana, strafe e rajadas de 3–5 tiros
//   hold   → Diapasão plantado: caminha ao site e monta a defesa em
//            posições fixas cobrindo as entradas
//   seek   → líder caído sem plantio: "pressentimento" periódico do DIRAC
//            mais próximo e caça — o jogador assiste o esquadrão lutar
//   carry  → Etapa 13: líder caído com o Diapasão → este aliado pega a
//            carga e leva ao site mais próximo (não se distrai)
//   planting → canal de plantio do aliado (3,5s parado no site)
//   dying  → tomba como os DIRACs; volta na próxima rodada
//
// Balé de squad: os aliados atiram nos DIRACs (ctx.targets), os tiros
// ecoam (alertam inimigos) e cada abate alimenta o kill feed.

import * as THREE from 'three';
import { ALLIES, COLORS, ROUND } from '../config/constants';
import type { MapDef } from '../config/maps';
import { StaticBuckets } from '../core/merge';
import { hudEvents, roundState } from '../core/state';
import type { Combatant } from './Bots';

export const ALLY_NAMES = ['TENOR', 'ALTO', 'BAIXO', 'CONTRA'] as const;

type AllyPhase =
  | 'escort'
  | 'engage'
  | 'hold'
  | 'seek'
  | 'carry'
  | 'planting'
  | 'dying'
  | 'dead';

interface Ally {
  id: number;
  name: string;
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  bar: THREE.Mesh;
  barMat: THREE.MeshBasicMaterial;
  bodyMat: THREE.MeshStandardMaterial;
  headMat: THREE.MeshStandardMaterial;
  hp: number;
  phase: AllyPhase;
  phaseT: number;
  slot: number; // ponto de formação/defesa designado
  losT: number; // throttle da percepção
  lastSeen: number;
  reactAt: number;
  shooting: boolean;
  burstLeft: number;
  shotT: number;
  strafeDir: 1 | -1;
  strafeT: number;
  flash: number;
  stuckMs: number;
  farSince: number; // desde quando está longe do líder (p/ reposicionar)
  pingAt: number; // próximo "pressentimento" (líder caído)
  chain: Array<[number, number]>;
  chainWp: number;
  chainSite: 'A' | 'B'; // a qual site a cadeia atual se destina (Etapa 14)
  walking: boolean; // animação de passo
  walkT: number;
  plantK: number; // progresso do plantio do aliado (Etapa 13)
  carrySite: 'A' | 'B'; // site de destino da carga (Etapa 13)
}

export interface AllyCtx {
  camera: THREE.Camera; // billboard da barra
  /** posição do jogador (líder do esquadrão) */
  playerPos: THREE.Vector3;
  playerYaw: number; // direção de marcha do líder (formação)
  playerAlive: boolean;
  active: boolean; // fase de ação
  /** alvos DIRAC em campo (Combatants vivos construídos pelo Game) */
  targets: Combatant[];
  blocked: (x: number, z: number) => boolean;
  tracer: (from: THREE.Vector3, to: THREE.Vector3) => void;
  muzzle: (pos: THREE.Vector3) => void;
  plantPos: THREE.Vector3 | null;
  /** o tiro do aliado ecoa: alerta os DIRACs e soa distante p/ o jogador */
  onAllyShot: (pos: THREE.Vector3, distToPlayer: number) => void;
  /** um aliado completou o plantio do Diapasão (Etapa 13) */
  onAllyPlant: (site: 'A' | 'B') => void;
}

export interface AllyInfo {
  name: string;
  alive: boolean;
  hp: number;
  x: number;
  z: number;
  walking: boolean;
}

// formação de comboio ao redor do líder (offsets fixos no mundo)
const FORMATION: Array<[number, number]> = [
  [-1.8, 1.3],
  [1.8, 1.3],
  [-3.0, 2.6],
  [3.0, 2.6],
];

// Postos de defesa, âncoras e o spawn vieram do MAPA (Etapa 14): ver
// config/maps.ts — holdSlots por site, retake (âncora + vão central) e
// spawn do CORO.

const DEATH_MS = 450;

/** Interpolação angular pelo caminho curto (-π..π). */
function angLerp(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class AllySquad {
  /** leitura ao vivo para o HUD (polling) */
  readonly info: { alive: number; list: AllyInfo[] } = { alive: 0, list: [] };

  private allies: Ally[] = [];
  private ray = new THREE.Raycaster();
  private solids: THREE.Object3D[];
  private map: MapDef;
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpDir = new THREE.Vector3();
  /** índice do portador do Diapasão (Etapa 13; -1 = ninguém) */
  private carrier = -1;
  private lastPlantTick = 0; // cadência dos pings do plantio do aliado

  /**
   * Etapa 13: o líder caiu com o Diapasão — este aliado pega a carga.
   * Escolhe o site mais próximo de si e não se distrai com combates no
   * caminho (os outros continuam lutando por ele).
   */
  assignCarrier(idx: number) {
    const a = this.allies[idx];
    if (!a || a.phase === 'dying' || a.phase === 'dead') return;
    this.carrier = idx;
    roundState.carrierAlly = idx;
    a.plantK = 0;
    a.phase = 'carry';
    a.phaseT = performance.now();
    a.shooting = false;
    a.burstLeft = 0;
    const dA = Math.hypot(a.group.position.x - this.map.sites.A.x, a.group.position.z - this.map.sites.A.z);
    const dB = Math.hypot(a.group.position.x - this.map.sites.B.x, a.group.position.z - this.map.sites.B.z);
    a.carrySite = dA <= dB ? 'A' : 'B';
    this.chainTo(a, this.map.sites[a.carrySite].x, this.map.sites[a.carrySite].z);
    hudEvents.emit({ type: 'feed', killer: a.name, victim: 'PEGOU O DIAPASÃO' });
  }

  /** Ninguém carrega mais (rodada nova ou plantio concluído). */
  private clearCarrier() {
    this.carrier = -1;
    roundState.carrierAlly = null;
  }

  constructor(scene: THREE.Scene, solids: THREE.Object3D[], map: MapDef) {
    this.solids = solids;
    this.map = map;

    const bodyGeo = new THREE.CapsuleGeometry(0.26, 0.92, 6, 12);
    const headGeo = new THREE.SphereGeometry(0.18, 16, 12);
    const barGeo = new THREE.PlaneGeometry(0.72, 0.075);
    const visorGeo = new THREE.BoxGeometry(0.2, 0.06, 0.05);

    // armadura CORO (teal, mais leve que a DIRAC)
    const armorGeo = new THREE.BoxGeometry(0.36, 0.44, 0.2);
    const packGeo = new THREE.BoxGeometry(0.32, 0.42, 0.15);
    const shoulderGeo = new THREE.BoxGeometry(0.15, 0.1, 0.24);
    const gunGeo = new THREE.BoxGeometry(0.06, 0.1, 0.46);
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1f3a38,
      roughness: 0.55,
      metalness: 0.22,
    });
    const packMat = new THREE.MeshStandardMaterial({
      color: 0x1a3231,
      roughness: 0.65,
      metalness: 0.14,
    });
    const visorMat = new THREE.MeshBasicMaterial({ color: COLORS.TEAL });

    ALLY_NAMES.forEach((name, id) => {
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x21332e,
        roughness: 0.7,
        metalness: 0.2,
        emissive: COLORS.TEAL,
        emissiveIntensity: 0.1,
      });
      const headMat = new THREE.MeshStandardMaterial({
        color: 0x273a35,
        roughness: 0.6,
        metalness: 0.25,
        emissive: COLORS.TEAL,
        emissiveIntensity: 0.2,
      });
      const barMat = new THREE.MeshBasicMaterial({
        color: COLORS.TEAL,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });

      const group = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.98;
      body.castShadow = true;

      // peças fundidas por material (mesma economia dos DIRACs)
      const armor = new StaticBuckets(body);
      const chest = new THREE.Mesh(armorGeo, armorMat);
      chest.position.set(0, 0.14, 0.13);
      const pack = new THREE.Mesh(packGeo, packMat);
      pack.position.set(0, 0.12, -0.21);
      const shL = new THREE.Mesh(shoulderGeo, armorMat);
      shL.position.set(-0.3, 0.36, 0);
      const shR = new THREE.Mesh(shoulderGeo, armorMat);
      shR.position.set(0.3, 0.36, 0);
      const gun = new THREE.Mesh(gunGeo, packMat);
      gun.position.set(0.26, 0.02, 0.16);
      gun.rotation.x = 0.06;
      for (const piece of [chest, pack, shL, shR, gun]) {
        piece.castShadow = true;
        armor.add(piece);
      }
      armor.build();

      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.66;
      head.castShadow = true;
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.position.set(0, 0.02, 0.17);
      head.add(visor);
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.y = 2.0;

      group.add(body, head, bar);
      const [fx, fz] = FORMATION[id];
      group.position.set(this.map.spawn[0] + fx, 0, this.map.spawn[1] + fz);
      scene.add(group);

      this.allies.push({
        id,
        name,
        group,
        body,
        head,
        bar,
        barMat,
        bodyMat,
        headMat,
        hp: ALLIES.HP,
        phase: 'escort',
        phaseT: 0,
        slot: id,
        losT: 0,
        lastSeen: -1e9,
        reactAt: 0,
        shooting: false,
        burstLeft: 0,
        shotT: 0,
        strafeDir: 1,
        strafeT: 0,
        flash: 0,
        stuckMs: 0,
        farSince: 0,
        pingAt: 0,
        chain: [],
        chainWp: 0,
        chainSite: 'A',
        walking: false,
        walkT: 0,
        plantK: 0,
        carrySite: 'A',
      });
    });

    this.syncInfo();
  }

  /** Rodada nova: todos de pé na formação do spawn. */
  reset() {
    const now = performance.now();
    this.allies.forEach((a, i) => {
      a.hp = ALLIES.HP;
      a.phase = 'escort';
      a.phaseT = now;
      a.slot = i;
      a.losT = 0;
      a.lastSeen = -1e9;
      a.shooting = false;
      a.burstLeft = 0;
      a.shotT = 0;
      a.strafeDir = 1;
      a.strafeT = 0;
      a.flash = 0;
      a.stuckMs = 0;
      a.farSince = 0;
      a.pingAt = 0;
      a.chain = [];
      a.chainWp = 0;
      a.chainSite = 'A';
      a.walking = false;
      a.walkT = 0;
      a.plantK = 0;
      a.group.visible = true;
      a.group.rotation.set(0, 0, 0);
      const [fx, fz] = FORMATION[i];
      a.group.position.set(this.map.spawn[0] + fx, 0, this.map.spawn[1] + fz);
      a.group.scale.setScalar(1);
      a.bar.visible = true;
      a.bodyMat.emissiveIntensity = 0.1;
      a.headMat.emissiveIntensity = 0.2;
      this.updateBar(a);
    });
    this.clearCarrier();
    this.lastPlantTick = 0;
    this.syncInfo();
  }

  /** Posição viva do aliado (referência — Etapa 12: alvo dos DIRACs). */
  posOf(id: number): THREE.Vector3 {
    return this.allies[id].group.position;
  }

  /** Aliado pelo índice (canal de dano dos DIRACs). */
  byIndex(id: number) {
    return this.allies[id];
  }

  /** Dano de DIRAC num aliado. killer vira o feed se for o abate. */
  damage(a: Ally, amount: number, killer: string): { killed: boolean } {
    if (a.phase === 'dying' || a.phase === 'dead') return { killed: false };
    a.hp -= amount;
    a.flash = 1;
    if (a.hp <= 0) {
      a.hp = 0;
      a.phase = 'dying';
      a.phaseT = performance.now();
      a.bar.visible = false;
      hudEvents.emit({ type: 'feed', killer, victim: a.name });
      return { killed: true };
    }
    this.updateBar(a);
    return { killed: false };
  }

  /** Um passo com deslize de parede (eixo a eixo). Retorna true se moveu. */
  private step(a: Ally, tx: number, tz: number, speed: number, dt: number, ctx: AllyCtx): boolean {
    const dx = tx - a.group.position.x;
    const dz = tz - a.group.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.04) return false;
    const step = Math.min(speed * dt, d);
    const nx = a.group.position.x + (dx / d) * step;
    const nz = a.group.position.z + (dz / d) * step;
    let moved = false;
    if (!ctx.blocked(nx, a.group.position.z)) {
      a.group.position.x = nx;
      moved = true;
    }
    if (!ctx.blocked(a.group.position.x, nz)) {
      a.group.position.z = nz;
      moved = true;
    }
    if (moved) {
      a.group.rotation.y = angLerp(
        a.group.rotation.y,
        Math.atan2(dx, dz),
        Math.min(1, dt * 7)
      );
      a.walkT += dt * 11;
      a.walking = true;
    }
    return moved;
  }

  /**
   * Cadeia de waypoints até um ponto do mapa (Etapa 14: caminho provado do
   * MAPA — spawn/porta → site — em vez de âncora única). Waypoints que já
   * estão "atrás" do aliado (mais longe do alvo do que ele) caem fora;
   * se mesmo assim travar, followChain reinjeta a rota inteira.
   */
  private chainTo(a: Ally, tx: number, tz: number) {
    const site: 'A' | 'B' = tx < 0 ? 'A' : 'B';
    a.chainSite = site;
    const ax = a.group.position.x;
    const az = a.group.position.z;
    const dHere = Math.hypot(tx - ax, tz - az);
    const path = this.map.carry[site].filter(
      (w) => Math.hypot(tx - w[0], tz - w[1]) <= dHere + 2
    );
    const oppositeSide =
      (site === 'A' && ax > 2) ||
      (site === 'B' && ax < -2);
    a.chain = (
      oppositeSide ? [this.map.retake.mid] : []
    ).concat(path, [[tx, tz] as [number, number]]);
    a.chainWp = 0;
    a.stuckMs = 0;
  }

  /** Segue a cadeia; retorna true quando chegou ao destino final. */
  private followChain(a: Ally, dt: number, speed: number, ctx: AllyCtx): boolean {
    while (a.chainWp < a.chain.length) {
      const [tx, tz] = a.chain[a.chainWp];
      const d = Math.hypot(tx - a.group.position.x, tz - a.group.position.z);
      if (d < 0.6 && a.chainWp < a.chain.length - 1) {
        a.chainWp++;
        a.stuckMs = 0;
        continue;
      }
      const moved = this.step(a, tx, tz, speed, dt, ctx);
      if (!moved) {
        a.stuckMs += dt * 1000;
        if (a.stuckMs > 1100) {
          a.stuckMs = 0;
          if (a.chainWp >= a.chain.length - 1) {
            // travou no ÚLTIMO trecho (encalhou numa quina/geometria):
            // reinjeta o caminho provado do mapa até o alvo
            const target = a.chain[a.chain.length - 1];
            a.chain = [...this.map.carry[a.chainSite], target];
            a.chainWp = 0;
          } else {
            a.chainWp++; // pula o waypoint preso
          }
        }
      } else {
        a.stuckMs = 0;
      }
      return false;
    }
    return true;
  }

  /** DIRAC mais próximo com linha de visão (ou null). */
  private spot(a: Ally, now: number, ctx: AllyCtx): Combatant | null {
    if (now - a.losT < ALLIES.LOS_EVERY_MS) return null;
    a.losT = now;
    let best: Combatant | null = null;
    let bestD = Infinity;
    for (const t of ctx.targets) {
      if (!t.alive) continue;
      const d = Math.hypot(
        t.pos.x - a.group.position.x,
        t.pos.z - a.group.position.z
      );
      if (d > ALLIES.ENGAGE_DIST || d >= bestD) continue;
      if (!this.los(a, t.pos)) continue;
      best = t;
      bestD = d;
    }
    return best;
  }

  /** Linha de visão livre entre os olhos do aliado e o peito do alvo. */
  private los(a: Ally, target: THREE.Vector3): boolean {
    this.tmpA.set(a.group.position.x, 1.55, a.group.position.z);
    this.tmpB.set(target.x, target.y - 0.15, target.z);
    this.tmpDir.subVectors(this.tmpB, this.tmpA);
    const dist = this.tmpDir.length();
    if (dist < 0.001) return true;
    this.tmpDir.multiplyScalar(1 / dist);
    this.ray.set(this.tmpA, this.tmpDir);
    this.ray.far = dist - 0.1;
    return this.ray.intersectObjects(this.solids, false).length === 0;
  }

  /** Um tiro do aliado: tracer, clarão, som que ecoa e dano no DIRAC. */
  private fireShot(a: Ally, target: Combatant, dist: number, ctx: AllyCtx) {
    const yaw = a.group.rotation.y;
    this.tmpA.set(
      a.group.position.x + Math.sin(yaw) * 0.3,
      1.42,
      a.group.position.z + Math.cos(yaw) * 0.3
    );
    this.tmpB.set(target.pos.x, target.pos.y - 0.25, target.pos.z);

    let acc = ALLIES.ACC_BASE - dist * ALLIES.ACC_PER_M;
    if (target.moving) acc -= ALLIES.ACC_MOVE_PENALTY;
    acc = Math.max(0.08, Math.min(0.75, acc));

    if (Math.random() >= acc) {
      this.tmpDir.subVectors(this.tmpB, this.tmpA).normalize();
      const side = Math.random() < 0.5 ? 1 : -1;
      const miss = 0.35 + Math.random() * 0.75;
      this.tmpB.x += -this.tmpDir.z * side * miss;
      this.tmpB.z += this.tmpDir.x * side * miss;
      this.tmpB.y += (Math.random() - 0.4) * 0.5;
      this.tmpB.addScaledVector(this.tmpDir, 5);
    }

    ctx.tracer(this.tmpA, this.tmpB);
    ctx.muzzle(this.tmpA);
    const distToPlayer = Math.hypot(
      ctx.playerPos.x - a.group.position.x,
      ctx.playerPos.z - a.group.position.z
    );
    ctx.onAllyShot(a.group.position, distToPlayer);
    if (Math.random() < acc) target.hit(ALLIES.DMG, a.name);
  }

  private updateBar(a: Ally) {
    a.bar.scale.x = Math.max(0.02, a.hp / ALLIES.HP);
  }

  /** Chamado todo frame pelo loop. */
  update(dt: number, now: number, ctx: AllyCtx) {
    // portador do Diapasão caiu → o aliado vivo mais próximo pega a carga
    // (Etapa 13); se não restou ninguém, o Game encerra a rodada
    if (this.carrier >= 0) {
      const c = this.allies[this.carrier];
      if (c.phase === 'dying' || c.phase === 'dead') {
        let best = -1;
        let bestD = Infinity;
        for (const a of this.allies) {
          if (a.phase === 'dying' || a.phase === 'dead') continue;
          const d = Math.hypot(
            a.group.position.x - c.group.position.x,
            a.group.position.z - c.group.position.z
          );
          if (d < bestD) {
            bestD = d;
            best = a.id;
          }
        }
        if (best >= 0) {
          this.assignCarrier(best);
        } else {
          this.clearCarrier();
        }
      }
    }

    for (const a of this.allies) {
      // barra encara a câmera
      a.bar.quaternion.copy(ctx.camera.quaternion);

      // brilho de dano decai
      if (a.flash > 0) {
        a.flash = Math.max(0, a.flash - dt * 8);
        a.bodyMat.emissiveIntensity = 0.1 + a.flash * 1.5;
        a.headMat.emissiveIntensity = 0.2 + a.flash * 1.7;
      }

      // passo: bob + balanço
      if (a.walking) {
        a.group.position.y = Math.abs(Math.sin(a.walkT)) * 0.035;
        a.group.rotation.z = Math.sin(a.walkT) * 0.04;
        a.walking = false; // reativado por step() neste frame
      } else {
        a.group.position.y = 0;
        a.group.rotation.z = 0;
      }

      if (a.phase === 'dying') {
        const k = Math.min(1, (now - a.phaseT) / DEATH_MS);
        a.group.rotation.x = k * k * (Math.PI / 2) * 0.92;
        if (k >= 1) {
          a.phase = 'dead';
          a.group.visible = false;
        }
        continue;
      }
      if (a.phase === 'dead') continue;

      // fora da fase de ação: esperando a rodada (na formação)
      if (!ctx.active) continue;

      // --- percepção: DIRAC visível → combate ---
      // (o portador do Diapasão não se distrai: cumpre a missão)
      const spotted = a.id === this.carrier ? null : this.spot(a, now, ctx);
      if (spotted) {
        a.lastSeen = now;
        if (a.phase !== 'engage') {
          a.phase = 'engage';
          a.phaseT = now;
          a.shooting = false;
          a.shotT =
            now +
            ALLIES.REACT_MIN_MS +
            Math.random() * (ALLIES.REACT_MAX_MS - ALLIES.REACT_MIN_MS);
          a.strafeT = 0;
        }
      }

      switch (a.phase) {
        case 'engage': {
          const target = spotted;
          if (!target || now - a.lastSeen > ALLIES.LOSE_MS) {
            // perdeu o alvo: volta à missão atual
            if (ctx.plantPos) {
              a.phase = 'hold';
              this.chainTo(a, ...this.holdPoint(a, ctx));
            } else if (ctx.playerAlive) {
              a.phase = 'escort';
            } else {
              a.phase = 'seek';
              a.pingAt = 0; // pressente um novo alvo já
            }
            break;
          }
          const dx = target.pos.x - a.group.position.x;
          const dz = target.pos.z - a.group.position.z;
          const dist = Math.hypot(dx, dz);
          a.group.rotation.y = angLerp(
            a.group.rotation.y,
            Math.atan2(dx, dz),
            Math.min(1, dt * 12)
          );

          // strafe de combate
          if (now >= a.strafeT) {
            a.strafeT = now + 800 + Math.random() * 900;
            a.strafeDir = Math.random() < 0.5 ? -1 : 1;
          }
          const step = ALLIES.STRAFE_SPEED * dt;
          const inv = 1 / (dist || 1);
          const nx = a.group.position.x + -dz * inv * a.strafeDir * step;
          const nz = a.group.position.z + dx * inv * a.strafeDir * step;
          if (!ctx.blocked(nx, nz)) {
            a.group.position.x = nx;
            a.group.position.z = nz;
            a.walkT += dt * 9;
            a.walking = true;
          } else {
            a.strafeDir = (a.strafeDir * -1) as 1 | -1;
          }

          // rajadas
          if (a.shooting) {
            if (now >= a.shotT) {
              this.fireShot(a, target, dist, ctx);
              a.burstLeft--;
              a.shotT = now + ALLIES.SHOT_MS;
              if (a.burstLeft <= 0) {
                a.shooting = false;
                a.shotT =
                  now +
                  ALLIES.PAUSE_MIN_MS +
                  Math.random() * (ALLIES.PAUSE_MAX_MS - ALLIES.PAUSE_MIN_MS);
              }
            }
          } else if (now >= a.shotT) {
            a.shooting = true;
            a.burstLeft =
              ALLIES.BURST_MIN +
              Math.floor(Math.random() * (ALLIES.BURST_MAX - ALLIES.BURST_MIN + 1));
          }
          break;
        }

        case 'escort': {
          if (!ctx.playerAlive) {
            // líder caído: vira caçador
            a.phase = 'seek';
            a.pingAt = 0;
            break;
          }
          const [fx, fz] = FORMATION[a.slot];
          const tx = ctx.playerPos.x + fx;
          const tz = ctx.playerPos.z + fz;
          const d = Math.hypot(tx - a.group.position.x, tz - a.group.position.z);
          if (d > 0.45) {
            this.step(a, tx, tz, d > 3.5 ? ALLIES.CATCHUP_SPEED : ALLIES.SPEED, dt, ctx);
          } else {
            // no posto: encara a mesma direção do líder
            a.group.rotation.y = angLerp(
              a.group.rotation.y,
              ctx.playerYaw + Math.PI,
              Math.min(1, dt * 4)
            );
          }

          // ficou muito para trás (encalhou numa sala)? reposiciona
          const dp = Math.hypot(
            ctx.playerPos.x - a.group.position.x,
            ctx.playerPos.z - a.group.position.z
          );
          if (dp > ALLIES.TELEPORT_DIST) {
            if (a.farSince === 0) a.farSince = now;
            if (now - a.farSince > 2000) {
              const [rx, rz] = this.freeSpotNear(ctx);
              a.group.position.set(rx, 0, rz);
              a.farSince = 0;
              a.stuckMs = 0;
            }
          } else {
            a.farSince = 0;
          }
          break;
        }

        case 'hold': {
          if (!ctx.plantPos) {
            // rodada virou antes: volta à escolta
            a.phase = ctx.playerAlive ? 'escort' : 'seek';
            break;
          }
          const [tx, tz] = this.holdPoint(a, ctx);
          const d = Math.hypot(tx - a.group.position.x, tz - a.group.position.z);
          if (d > 0.5) {
            this.followChain(a, dt, ALLIES.HOLD_SPEED, ctx);
          } else {
            // no posto de defesa: encara a entrada sul do site
            a.group.rotation.y = angLerp(
              a.group.rotation.y,
              Math.PI, // +Z = sul, de onde vem o retake
              Math.min(1, dt * 3)
            );
          }
          break;
        }

        case 'seek': {
          // líder caído e nada plantado: caça o DIRAC mais próximo
          if (ctx.plantPos) {
            a.phase = 'hold';
            this.chainTo(a, ...this.holdPoint(a, ctx));
            break;
          }
          if (now >= a.pingAt) {
            a.pingAt = now + ALLIES.PING_MS;
            let best: Combatant | null = null;
            let bestD = Infinity;
            for (const t of ctx.targets) {
              if (!t.alive) continue;
              const d = Math.hypot(
                t.pos.x - a.group.position.x,
                t.pos.z - a.group.position.z
              );
              if (d < bestD) {
                bestD = d;
                best = t;
              }
            }
            if (best) {
              // pressentimento: posição aproximada do inimigo (±2.5m)
              this.chainTo(
                a,
                best.pos.x + (Math.random() - 0.5) * 5,
                best.pos.z + (Math.random() - 0.5) * 5
              );
            }
          }
          if (a.chain.length > 0) {
            this.followChain(a, dt, ALLIES.HOLD_SPEED, ctx);
          }
          break;
        }

        case 'carry': {
          // Etapa 13: Diapasão nas mãos, caminho ao site designado
          if (ctx.plantPos) {
            // já plantado por outro: vira defesa
            a.phase = 'hold';
            break;
          }
          const d = Math.hypot(
            this.map.sites[a.carrySite].x - a.group.position.x,
            this.map.sites[a.carrySite].z - a.group.position.z
          );
          if (d <= ROUND.SITE_RADIUS * 0.65) {
            a.phase = 'planting';
            a.phaseT = now;
            a.plantK = 0;
            break;
          }
          this.followChain(a, dt, ALLIES.HOLD_SPEED, ctx);
          break;
        }

        case 'planting': {
          // canal de plantio do aliado: parado no site (Etapa 13)
          if (ctx.plantPos) {
            a.phase = 'hold';
            this.clearCarrier();
            break;
          }
          a.plantK += (dt * 1000) / ROUND.PLANT_MS;
          if (now - this.lastPlantTick >= 650) {
            this.lastPlantTick = now;
            hudEvents.emit({ type: 'plantTick' });
          }
          if (a.plantK >= 1) {
            a.plantK = 1;
            const site = a.carrySite;
            this.clearCarrier();
            a.phase = 'hold';
            ctx.onAllyPlant(site);
          }
          break;
        }

        default:
          break;
      }
    }

    this.syncInfo();
  }

  /** Ponto de defesa designado do aliado (fixo por slot no site plantado). */
  private holdPoint(a: Ally, ctx: AllyCtx): [number, number] {
    const site: 'A' | 'B' = ctx.plantPos && ctx.plantPos.x < 0 ? 'A' : 'B';
    const [hx, hz] = this.map.holdSlots[site][a.slot];
    return [hx, hz];
  }

  /** Um ponto livre perto do líder (reposicionamento de formação). */
  private freeSpotNear(ctx: AllyCtx): [number, number] {
    for (const [fx, fz] of FORMATION) {
      const x = ctx.playerPos.x + fx;
      const z = ctx.playerPos.z + fz;
      if (!ctx.blocked(x, z)) return [x, z];
    }
    return [ctx.playerPos.x, ctx.playerPos.z];
  }

  private syncInfo() {
    if (this.info.list.length !== this.allies.length) {
      this.info.list = this.allies.map(() => ({
        name: '',
        alive: true,
        hp: 0,
        x: 0,
        z: 0,
        walking: false,
      }));
    }
    let alive = 0;
    this.allies.forEach((a, i) => {
      const it = this.info.list[i];
      it.name = a.name;
      it.alive = a.phase !== 'dying' && a.phase !== 'dead';
      it.hp = a.hp;
      it.x = a.group.position.x;
      it.z = a.group.position.z;
      it.walking = a.walking;
      if (it.alive) alive++;
    });
    this.info.alive = alive;
  }
}
