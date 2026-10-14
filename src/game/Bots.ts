// Operadores DIRAC (Etapa 6) — inimigos com IA leve e legível.
//
// Cada bot é um defensor com rota de patrulha por waypoints em áreas
// abertas do SUBSOLO. Comportamento:
//   patrol → anda a rota; vê o jogador (cone de visão + linha de visão
//            livre até 16m) ou OUVE um tiro perto → alert
//   alert  → trava na direção do jogador por um tempo de reação humano
//   engage → strafe lateral + rajadas de 3–6 tiros com imprecisão por
//            distância e movimento do alvo; sem visão por ~0.9s → patrol
//   retake (Etapa 7) → Diapasão plantado: corre de volta ao site
//            (waypoints com deslize em parede) para silenciá-lo
//   silencing → canal de 7s junto ao Diapasão; dano ou CENZURA interrompe
//   dying  → tomba (450ms); sem respawn até a próxima rodada
//
// O dano ao jogador passa pelo callback hitPlayer (o Game aplica o
// escudo, emite o evento de HUD e encerra a rodada se necessário).

import * as THREE from 'three';
import { BOTS, COLORS, DEFUSE } from '../config/constants';
import { StaticBuckets } from '../core/merge';
import { hudEvents } from '../core/state';

type BotPhase = 'patrol' | 'alert' | 'engage' | 'retake' | 'silencing' | 'dying' | 'dead';

interface Bot {
  id: number;
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  bar: THREE.Mesh;
  barMat: THREE.MeshBasicMaterial;
  bodyMat: THREE.MeshStandardMaterial;
  headMat: THREE.MeshStandardMaterial;
  visorMat: THREE.MeshBasicMaterial; // por bot: pisca branco quando cego
  ping: THREE.Mesh; // SONAR: silhueta visível através de paredes (Etapa 8)
  hp: number;
  phase: BotPhase;
  phaseT: number; // timestamp de entrada na fase
  reactAt: number; // quando a reação termina (alert → engage)
  route: Array<[number, number]>;
  wp: number; // índice do waypoint alvo
  losT: number; // última checagem de visão
  lastSeen: number; // última vez que viu o jogador
  shooting: boolean; // true = dentro de uma rajada
  burstLeft: number; // tiros restantes na rajada
  shotT: number; // timestamp do próximo tiro
  strafeDir: 1 | -1;
  strafeT: number; // próxima troca de direção do strafe
  flash: number; // brilho de dano 0..1
  blindUntil: number; // CENZURA: cego até este timestamp (Etapa 7)
  revealUntil: number; // SONAR: revelado até aqui (Etapa 8)
  defuseK: number; // progresso do silenciamento 0..1
  retakeChain: Array<[number, number]>; // waypoints até o Diapasão
  retakeWp: number; // índice do waypoint do retake
  stuckMs: number; // tempo sem conseguir andar (destrava o retake)
}

export interface BotCtx {
  camera: THREE.Camera; // para a barra de vida encarar a câmera
  playerPos: THREE.Vector3;
  playerAlive: boolean;
  active: boolean; // fase de ação em curso (bots percebem/atiram)
  playerMoving: boolean;
  blocked: (x: number, z: number) => boolean;
  hitPlayer: (dmg: number) => void;
  tracer: (from: THREE.Vector3, to: THREE.Vector3) => void;
  muzzle: (pos: THREE.Vector3) => void;
  /** posição do Diapasão plantado (null = não plantado) — Etapa 7 */
  plantPos: THREE.Vector3 | null;
  /** um DIRAC completou o silenciamento — DIRAC vence a rodada */
  onSilenced: () => void;
}

export interface BotInfo {
  id: number;
  phase: BotPhase;
  x: number;
  z: number;
  hp: number;
}

// Rotas defensivas — waypoints em áreas abertas (não cruzam paredes).
// A: triângulo dentro do SITE A · B: espelho no SITE B · meio: Concurso.
const ROUTES: Array<Array<[number, number]>> = [
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
];

const DEATH_MS = 450;

// Âncoras do retake (Etapa 7): passagem sul do site antes de entrar nele
// e vão central do Concurso para quem vem do lado oposto do mapa.
const RETAKE_ANCHOR: Record<'A' | 'B', [number, number]> = {
  A: [-10.5, -9.5],
  B: [10.5, -9.5],
};
const RETAKE_MID: [number, number] = [0, -8.6];

/** Interpolação angular pelo caminho curto (-π..π). */
function angLerp(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class BotSquad {
  /** leitura ao vivo para HUD/diagnóstico (polling; não é reativo) */
  readonly info: {
    alive: number;
    list: BotInfo[];
    defusing: boolean; // Etapa 7: alguém silenciando o Diapasão
    defuseProgress: number; // 0..1 do canal
  } = { alive: 0, list: [], defusing: false, defuseProgress: 0 };

  private bots: Bot[] = [];
  private ray = new THREE.Raycaster();
  private solids: THREE.Object3D[];
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpDir = new THREE.Vector3();
  private tmpCol = new THREE.Color();

  constructor(scene: THREE.Scene, solids: THREE.Object3D[]) {
    this.solids = solids;

    const bodyGeo = new THREE.CapsuleGeometry(0.26, 0.92, 6, 12);
    const headGeo = new THREE.SphereGeometry(0.18, 16, 12);
    const barGeo = new THREE.PlaneGeometry(0.72, 0.075);
    const visorGeo = new THREE.BoxGeometry(0.2, 0.06, 0.05);

    // peças de armadura DIRAC (compartilhadas; filhos do corpo — não entram
    // no raycast, que só testa corpo e cabeça)
    const armorGeo = new THREE.BoxGeometry(0.36, 0.44, 0.2);
    const packGeo = new THREE.BoxGeometry(0.32, 0.42, 0.15);
    const shoulderGeo = new THREE.BoxGeometry(0.15, 0.1, 0.24);
    const gunGeo = new THREE.BoxGeometry(0.06, 0.1, 0.46);
    const thrusterGeo = new THREE.BoxGeometry(0.12, 0.06, 0.03);
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x3a3448,
      roughness: 0.55,
      metalness: 0.22,
    });
    const packMat = new THREE.MeshStandardMaterial({
      color: 0x2e2a3c,
      roughness: 0.65,
      metalness: 0.14,
    });
    const thrusterMat = new THREE.MeshBasicMaterial({ color: COLORS.MAGENTA });

    ROUTES.forEach((route, id) => {
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x232c38,
        roughness: 0.7,
        metalness: 0.2,
        emissive: COLORS.MAGENTA,
        emissiveIntensity: 0.1,
      });
      const headMat = new THREE.MeshStandardMaterial({
        color: 0x2b3542,
        roughness: 0.6,
        metalness: 0.25,
        emissive: COLORS.MAGENTA,
        emissiveIntensity: 0.2,
      });
      const barMat = new THREE.MeshBasicMaterial({
        color: 0xf2fbff,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });

      const group = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.98;
      body.castShadow = true;

      // armadura + propulsor + fuzil — fundidos por material (Etapa 10):
      // as peças nunca se movem entre si, então viram 3 meshes em vez de 5
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
      const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
      thruster.position.set(0, 0.4, -0.51); // corpo-espaço (pack + local)
      for (const piece of [chest, pack, shL, shR, gun, thruster]) {
        piece.castShadow = true;
        armor.add(piece);
      }
      armor.build();

      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.66;
      head.castShadow = true;
      // visor — o "olho" magenta do operador (frente local +Z)
      const visorMat = new THREE.MeshBasicMaterial({ color: COLORS.MAGENTA });
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.position.set(0, 0.02, 0.17);
      head.add(visor);
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.y = 2.0;

      // SONAR (Etapa 8): contorno magenta do operador revelado — desenha
      // por cima de tudo (sem depth test) para atravessar paredes
      const pingMat = new THREE.MeshBasicMaterial({
        color: COLORS.MAGENTA,
        transparent: true,
        opacity: 0.0,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const ping = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.98, 4, 10), pingMat);
      ping.position.y = 0.98;
      ping.renderOrder = 999;
      ping.visible = false;

      group.add(body, head, bar, ping);
      group.position.set(route[0][0], 0, route[0][1]);
      scene.add(group);

      // etiquetas para o raycast das balas do jogador
      body.userData = { botId: id, part: 'body' };
      head.userData = { botId: id, part: 'head' };

      this.bots.push({
        id,
        group,
        body,
        head,
        bar,
        barMat,
        bodyMat,
        headMat,
        visorMat,
        ping,
        hp: BOTS.HP,
        phase: 'patrol',
        phaseT: 0,
        reactAt: 0,
        route,
        wp: 1,
        losT: 0,
        lastSeen: -1e9,
        shooting: false,
        burstLeft: 0,
        shotT: 0,
        strafeDir: 1,
        strafeT: 0,
        flash: 0,
        blindUntil: 0,
        revealUntil: 0,
        defuseK: 0,
        retakeChain: [],
        retakeWp: 0,
        stuckMs: 0,
      });
    });

    this.syncInfo();
  }

  /** Bot pelo id (userData do raycast). */
  byId(id: number): Bot {
    return this.bots[id];
  }

  /** Malhas vivas para o raycast das balas do jogador. */
  get aliveMeshes(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const b of this.bots) {
      if (b.phase !== 'dying' && b.phase !== 'dead') {
        out.push(b.body, b.head);
      }
    }
    return out;
  }

  /** Aplica dano; mesmo formato de retorno do campo de treino. */
  damage(bot: Bot, amount: number, isHead: boolean): { killed: boolean; hp: number } {
    if (bot.phase === 'dying' || bot.phase === 'dead') {
      return { killed: false, hp: 0 };
    }
    bot.hp -= amount;
    bot.flash = 1;
    // levar tiro revela o atirador
    bot.lastSeen = performance.now();
    // silenciamento/retake interrompidos: ele luta de volta
    if (bot.phase === 'silencing') {
      bot.defuseK = 0;
      this.updateBar(bot);
    }
    if (bot.phase === 'patrol' || bot.phase === 'retake' || bot.phase === 'silencing') {
      bot.phase = 'alert';
      bot.phaseT = performance.now();
      bot.reactAt = bot.phaseT + 120; // reação curta quando já está levando tiro
    }
    if (bot.hp <= 0) {
      bot.hp = 0;
      bot.phase = 'dying';
      bot.phaseT = performance.now();
      bot.bar.visible = false;
      return { killed: true, hp: 0 };
    }
    this.updateBar(bot);
    return { killed: false, hp: bot.hp };
  }

  /**
   * CENZURA (Traço do jogador, Etapa 7): cega operadores com linha de
   * visão até o jogador dentro do alcance. Cegos não atiram nem
   * silenciam; o silenciamento em curso é interrompido.
   */
  blindNear(playerPos: THREE.Vector3, now: number, range: number, blindMs: number) {
    for (const b of this.bots) {
      if (b.phase === 'dying' || b.phase === 'dead') continue;
      const d = Math.hypot(
        b.group.position.x - playerPos.x,
        b.group.position.z - playerPos.z
      );
      if (d <= range && this.los(b, playerPos)) {
        b.blindUntil = Math.max(b.blindUntil, now + blindMs);
        if (b.phase === 'silencing') {
          b.phase = 'retake'; // recomeça o canal quando chegar de novo
          b.defuseK = 0;
          this.updateBar(b);
        }
      }
    }
  }

  /**
   * SONAR (Traço da ECO, Etapa 8): revela operadores num raio — as
   * silhuetas ficam visíveis através das paredes por um tempo.
   * Diferente da CENZURA, não precisa de linha de visão.
   */
  revealNear(playerPos: THREE.Vector3, range: number, until: number) {
    for (const b of this.bots) {
      if (b.phase === 'dying' || b.phase === 'dead') continue;
      const d = Math.hypot(
        b.group.position.x - playerPos.x,
        b.group.position.z - playerPos.z
      );
      if (d <= range) {
        b.revealUntil = Math.max(b.revealUntil, until);
      }
    }
  }

  /**
   * ONDA DE CHOQUE (Traço do GRAVE, Etapa 8): detonação ao redor do
   * jogador — fere e arremessa operadores com linha de visão livre
   * (parede bloqueia a onda). Retorna quantos foram atingidos.
   */
  shockwave(
    playerPos: THREE.Vector3,
    range: number,
    dmg: number,
    push: number,
    blocked: (x: number, z: number) => boolean
  ): number {
    let hitCount = 0;
    for (const b of this.bots) {
      if (b.phase === 'dying' || b.phase === 'dead') continue;
      const dx = b.group.position.x - playerPos.x;
      const dz = b.group.position.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d > range || !this.los(b, playerPos)) continue;
      hitCount++;

      // empurrão radial em subpassos curtos (sem atravessar parede)
      const inv = 1 / (d || 1);
      let left = push;
      while (left > 0.001) {
        const step = Math.min(0.25, left);
        left -= step;
        const nx = b.group.position.x + dx * inv * step;
        const nz = b.group.position.z + dz * inv * step;
        if (blocked(nx, nz)) break;
        b.group.position.x = nx;
        b.group.position.z = nz;
      }

      // o dano passa pelo canal normal: interrompe silenciamento,
      // alerta o esquadrão e pode abater
      this.damage(b, dmg, false);
    }
    return hitCount;
  }

  /** Tiro do jogador ecoou — bots dentro do alcance de audição entram em alerta. */
  heardShot(playerPos: THREE.Vector3, now: number) {
    for (const b of this.bots) {
      if (b.phase !== 'patrol') continue;
      const d = Math.hypot(
        b.group.position.x - playerPos.x,
        b.group.position.z - playerPos.z
      );
      if (d <= BOTS.HEAR_RANGE) {
        b.phase = 'alert';
        b.phaseT = now;
        b.reactAt =
          now + BOTS.REACT_MIN_MS + Math.random() * (BOTS.REACT_MAX_MS - BOTS.REACT_MIN_MS);
      }
    }
  }

  /** Reinicia o esquadrão para o início da rodada. */
  reset() {
    const now = performance.now();
    for (const b of this.bots) {
      b.hp = BOTS.HP;
      b.phase = 'patrol';
      b.phaseT = now;
      b.reactAt = 0;
      b.wp = 1;
      b.lastSeen = -1e9;
      b.shooting = false;
      b.burstLeft = 0;
      b.shotT = 0;
      b.strafeDir = 1;
      b.strafeT = 0;
      b.flash = 0;
      b.blindUntil = 0;
      b.revealUntil = 0;
      b.ping.visible = false;
      b.defuseK = 0;
      b.retakeChain = [];
      b.retakeWp = 0;
      b.stuckMs = 0;
      b.group.visible = true;
      b.group.rotation.set(0, 0, 0);
      b.group.position.set(b.route[0][0], 0, b.route[0][1]);
      b.group.scale.setScalar(1);
      b.bar.visible = true;
      b.bodyMat.emissiveIntensity = 0.1;
      b.headMat.emissiveIntensity = 0.2;
      b.visorMat.color.setHex(COLORS.MAGENTA);
      this.updateBar(b);
    }
    this.syncInfo();
  }

  /** Chamado todo frame pelo loop de jogo. */
  update(dt: number, now: number, ctx: BotCtx) {
    let anyDefusing = false;
    let defuseProgress = 0;

    for (const b of this.bots) {
      // barra de vida encara a câmera
      b.bar.quaternion.copy(ctx.camera.quaternion);

      // SONAR: silhueta magenta pulsando enquanto revelado (Etapa 8)
      const revealed = now < b.revealUntil;
      if (revealed) {
        const k = 0.55 + Math.abs(Math.sin(now / 140)) * 0.45;
        b.ping.visible = true;
        (b.ping.material as THREE.MeshBasicMaterial).opacity = 0.85 * k;
      } else if (b.ping.visible) {
        b.ping.visible = false;
      }

      // decaimento do brilho de dano
      if (b.flash > 0) {
        b.flash = Math.max(0, b.flash - dt * 8);
        b.bodyMat.emissiveIntensity = 0.1 + b.flash * 1.5;
        b.headMat.emissiveIntensity = 0.2 + b.flash * 1.7;
      }

      // CENZURA: visor branco piscando enquanto cego
      const blinded = now < b.blindUntil;
      if (blinded) {
        const k = 0.5 + Math.abs(Math.sin(now / 45)) * 0.5;
        b.visorMat.color.setRGB(k, k, k);
      } else if (b.visorMat.color.r !== COLORS.MAGENTA / 16777216) {
        b.visorMat.color.setHex(COLORS.MAGENTA);
      }

      if (b.phase === 'dying') {
        const k = Math.min(1, (now - b.phaseT) / DEATH_MS);
        b.group.rotation.x = k * k * (Math.PI / 2) * 0.92;
        if (k >= 1) {
          b.phase = 'dead';
          b.group.visible = false;
        }
        continue;
      }
      if (b.phase === 'dead') continue;

      // fora da fase de ação: fica parado (aguardando a rodada)
      if (!ctx.active) continue;

      const dx = ctx.playerPos.x - b.group.position.x;
      const dz = ctx.playerPos.z - b.group.position.z;
      const dist = Math.hypot(dx, dz);

      // --- Etapa 7: Diapasão plantado → todos correm para silenciar ---
      if (
        ctx.plantPos &&
        !blinded &&
        (b.phase === 'patrol' || b.phase === 'alert' || b.phase === 'engage')
      ) {
        b.phase = 'retake';
        b.phaseT = now;
        b.shooting = false;
        // rota: vem do lado oposto do mapa? passa pelo vão central antes
        const site: 'A' | 'B' = ctx.plantPos.x < 0 ? 'A' : 'B';
        const anchor = RETAKE_ANCHOR[site];
        const oppositeSide =
          (site === 'A' && b.group.position.x > 2) ||
          (site === 'B' && b.group.position.x < -2);
        b.retakeChain = oppositeSide
          ? [RETAKE_MID, anchor, [ctx.plantPos.x, ctx.plantPos.z]]
          : [anchor, [ctx.plantPos.x, ctx.plantPos.z]];
        b.retakeWp = 0;
        b.defuseK = 0;
        this.updateBar(b);
      }

      // --- percepção (com throttle) — cego não enxerga ---
      if (!blinded && now - b.losT >= BOTS.LOS_EVERY_MS) {
        b.losT = now;
        if (
          ctx.playerAlive &&
          dist <= BOTS.PERCEIVE_RANGE &&
          this.los(b, ctx.playerPos)
        ) {
          if (b.phase === 'patrol' && this.inFov(b, dx, dz, dist)) {
            b.phase = 'alert';
            b.phaseT = now;
            b.reactAt =
              now +
              BOTS.REACT_MIN_MS +
              Math.random() * (BOTS.REACT_MAX_MS - BOTS.REACT_MIN_MS);
          }
          b.lastSeen = now;
        }
      }

      switch (b.phase) {
        case 'patrol': {
          const [tx, tz] = b.route[b.wp];
          const wdx = tx - b.group.position.x;
          const wdz = tz - b.group.position.z;
          const wd = Math.hypot(wdx, wdz);
          if (wd < 0.35) {
            b.wp = (b.wp + 1) % b.route.length;
          } else {
            const step = BOTS.PATROL_SPEED * dt;
            const nx = b.group.position.x + (wdx / wd) * step;
            const nz = b.group.position.z + (wdz / wd) * step;
            if (!ctx.blocked(nx, nz)) {
              b.group.position.x = nx;
              b.group.position.z = nz;
            } else {
              b.wp = (b.wp + 1) % b.route.length; // preso → tenta o próximo
            }
            b.group.rotation.y = angLerp(
              b.group.rotation.y,
              Math.atan2(wdx, wdz),
              Math.min(1, dt * 6)
            );
          }
          break;
        }

        case 'alert': {
          // trava no jogador, esperando a reação terminar
          b.group.rotation.y = angLerp(
            b.group.rotation.y,
            Math.atan2(dx, dz),
            Math.min(1, dt * 10)
          );
          if (now - b.lastSeen > BOTS.LOSE_MS) {
            b.phase = ctx.plantPos ? 'retake' : 'patrol';
            break;
          }
          if (now >= b.reactAt) {
            b.phase = 'engage';
            b.phaseT = now;
            b.shooting = false;
            b.shotT = now + 120;
            b.strafeT = 0;
          }
          break;
        }

        case 'engage': {
          if (blinded) break; // cego para de atirar e fica parado
          if (!ctx.playerAlive || now - b.lastSeen > BOTS.LOSE_MS) {
            b.phase = ctx.plantPos ? 'retake' : 'patrol';
            break;
          }
          b.group.rotation.y = angLerp(
            b.group.rotation.y,
            Math.atan2(dx, dz),
            Math.min(1, dt * 12)
          );

          // strafe perpendicular à linha de tiro
          if (now >= b.strafeT) {
            b.strafeT = now + 800 + Math.random() * 900;
            b.strafeDir = Math.random() < 0.5 ? -1 : 1;
          }
          const step = BOTS.STRAFE_SPEED * dt;
          const inv = 1 / (dist || 1);
          const sx = (-dz * inv) * b.strafeDir;
          const sz = (dx * inv) * b.strafeDir;
          const nx = b.group.position.x + sx * step;
          const nz = b.group.position.z + sz * step;
          if (!ctx.blocked(nx, nz)) {
            b.group.position.x = nx;
            b.group.position.z = nz;
          } else {
            b.strafeDir = (b.strafeDir * -1) as 1 | -1;
          }

          // rajadas
          if (b.shooting) {
            if (now >= b.shotT) {
              this.fireShot(b, now, dist, ctx);
              b.burstLeft--;
              b.shotT = now + BOTS.SHOT_MS;
              if (b.burstLeft <= 0) {
                b.shooting = false;
                b.shotT =
                  now +
                  BOTS.PAUSE_MIN_MS +
                  Math.random() * (BOTS.PAUSE_MAX_MS - BOTS.PAUSE_MIN_MS);
              }
            }
          } else if (now >= b.shotT) {
            b.shooting = true;
            b.burstLeft =
              BOTS.BURST_MIN +
              Math.floor(Math.random() * (BOTS.BURST_MAX - BOTS.BURST_MIN + 1));
          }
          break;
        }

        case 'retake': {
          if (!ctx.plantPos || blinded) break; // cego espera passar
          const [tx, tz] = b.retakeChain[b.retakeWp];
          const wdx = tx - b.group.position.x;
          const wdz = tz - b.group.position.z;
          const wd = Math.hypot(wdx, wdz);

          // chegou ao Diapasão?
          const dp = Math.hypot(
            ctx.plantPos.x - b.group.position.x,
            ctx.plantPos.z - b.group.position.z
          );
          if (dp <= DEFUSE.RADIUS) {
            b.phase = 'silencing';
            b.phaseT = now;
            this.updateBar(b);
            break;
          }

          if (wd < 0.6 && b.retakeWp < b.retakeChain.length - 1) {
            b.retakeWp++;
            b.stuckMs = 0;
            break;
          }

          // anda com deslize em parede (eixo a eixo, como o jogador)
          const step = DEFUSE.RETAKE_SPEED * dt;
          const nx = b.group.position.x + (wdx / (wd || 1)) * step;
          const nz = b.group.position.z + (wdz / (wd || 1)) * step;
          let movedOk = false;
          if (!ctx.blocked(nx, nz)) {
            b.group.position.x = nx;
            b.group.position.z = nz;
            movedOk = true;
          } else if (!ctx.blocked(nx, b.group.position.z)) {
            b.group.position.x = nx;
            movedOk = true;
          } else if (!ctx.blocked(b.group.position.x, nz)) {
            b.group.position.z = nz;
            movedOk = true;
          }

          if (movedOk) {
            b.stuckMs = 0;
            b.group.rotation.y = angLerp(
              b.group.rotation.y,
              Math.atan2(wdx, wdz),
              Math.min(1, dt * 7)
            );
          } else {
            b.stuckMs += dt * 1000;
            if (b.stuckMs > 1200) {
              // travado: reinjeta o vão central no meio da rota
              b.retakeChain = [
                RETAKE_MID,
                ...b.retakeChain.filter(
                  (p) => p[0] !== RETAKE_MID[0] || p[1] !== RETAKE_MID[1]
                ),
              ];
              b.retakeWp = 0;
              b.stuckMs = 0;
            }
          }
          break;
        }

        case 'silencing': {
          if (!ctx.plantPos) break;
          b.defuseK += (dt * 1000) / DEFUSE.MS;
          if (b.defuseK >= 1) {
            b.defuseK = 1;
            ctx.onSilenced();
          }
          // barra mostra o canal de silenciamento (branco → magenta)
          b.barMat.color.setRGB(1, 1, 1).lerp(this.tmpCol.set(COLORS.MAGENTA), b.defuseK);
          b.bar.scale.x = Math.max(0.02, b.defuseK);
          anyDefusing = true;
          defuseProgress = Math.max(defuseProgress, b.defuseK);
          break;
        }

        default:
          break;
      }
    }

    this.info.defusing = anyDefusing;
    this.info.defuseProgress = defuseProgress;
    this.syncInfo();
  }

  /** Um tiro do bot: tracer, clarão e chance de acerto no jogador. */
  private fireShot(b: Bot, now: number, dist: number, ctx: BotCtx) {
    // boca da arma: à frente do corpo, altura do peito
    const yaw = b.group.rotation.y;
    this.tmpA.set(
      b.group.position.x + Math.sin(yaw) * 0.3,
      1.42,
      b.group.position.z + Math.cos(yaw) * 0.3
    );
    // alvo: peito do jogador
    this.tmpB.set(ctx.playerPos.x, ctx.playerPos.y - 0.25, ctx.playerPos.z);

    let acc = BOTS.ACC_BASE - dist * BOTS.ACC_PER_M;
    if (ctx.playerMoving) acc -= BOTS.ACC_MOVE_PENALTY;
    acc = Math.max(0.08, Math.min(0.75, acc));

    if (Math.random() >= acc) {
      // errou — o tiro passa raspando: desvio perpendicular prolongado
      this.tmpDir.subVectors(this.tmpB, this.tmpA).normalize();
      const side = Math.random() < 0.5 ? 1 : -1;
      const miss = 0.35 + Math.random() * 0.75;
      this.tmpB.x += -this.tmpDir.z * side * miss;
      this.tmpB.z += this.tmpDir.x * side * miss;
      this.tmpB.y += (Math.random() - 0.4) * 0.5;
      this.tmpB.addScaledVector(this.tmpDir, 5); // segue além do jogador
    }

    ctx.tracer(this.tmpA, this.tmpB);
    ctx.muzzle(this.tmpA);
    hudEvents.emit({ type: 'botShot', dist }); // Etapa 11: o estrondo abafado do DIRAC
    if (Math.random() < acc) ctx.hitPlayer(BOTS.DMG);
  }

  /** Linha de visão livre entre os olhos do bot e o peito do jogador. */
  private los(b: Bot, playerPos: THREE.Vector3): boolean {
    this.tmpA.set(b.group.position.x, 1.55, b.group.position.z);
    this.tmpB.set(playerPos.x, playerPos.y - 0.15, playerPos.z);
    this.tmpDir.subVectors(this.tmpB, this.tmpA);
    const dist = this.tmpDir.length();
    if (dist < 0.001) return true;
    this.tmpDir.multiplyScalar(1 / dist);
    this.ray.set(this.tmpA, this.tmpDir);
    this.ray.far = dist - 0.1;
    return this.ray.intersectObjects(this.solids, false).length === 0;
  }

  /** O jogador está no cone de visão frontal do bot? */
  private inFov(b: Bot, dx: number, dz: number, dist: number): boolean {
    if (dist < 1.5) return true; // colado nele: percebe de qualquer lado
    const yaw = b.group.rotation.y;
    const dot = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / dist;
    return dot > BOTS.FOV_DOT;
  }

  private updateBar(b: Bot) {
    const k = b.hp / BOTS.HP;
    b.bar.scale.x = Math.max(0.02, k);
    // branco (cheio) → magenta (crítico)
    b.barMat.color.copy(this.tmpCol.set(0xf2fbff)).lerp(this.tmpCol.set(COLORS.MAGENTA), 1 - k);
  }

  /** Mantém o objeto de leitura (info) atualizado sem alocar. */
  private syncInfo() {
    if (this.info.list.length !== this.bots.length) {
      this.info.list = this.bots.map(() => ({ id: 0, phase: 'patrol', x: 0, z: 0, hp: 0 }));
    }
    let alive = 0;
    this.bots.forEach((b, i) => {
      const it = this.info.list[i];
      it.id = b.id;
      it.phase = b.phase;
      it.x = b.group.position.x;
      it.z = b.group.position.z;
      it.hp = b.hp;
      if (b.phase !== 'dying' && b.phase !== 'dead') alive++;
    });
    this.info.alive = alive;
  }
}
