import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  NativeTouchEvent,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GLView } from 'expo-gl';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import { Renderer } from 'expo-three';
import { buildSubsolo } from '../scenes/SubsoloScene';
import { TargetRange } from '../game/Targets';
import { BotSquad } from '../game/Bots';
import { RoundManager } from '../game/Round';
import { sprayAt } from '../game/Legato';
import {
  AGENTS,
  CSS,
  COLORS,
  EYE_HEIGHT,
  IMPACT_MS,
  LEFT_ZONE,
  LOOK_SENSITIVITY,
  MOVE_SPEED,
  MUZZLE_MS,
  PITCH_LIMIT,
  PLAYER_HP,
  PLAYER_RADIUS,
  ROUND,
  SITES,
  TRACOS,
  TRACER_LENGTH,
  TRACER_MS,
  WEAPONS,
} from '../config/constants';
import type { TracoKey } from '../config/constants';
import {
  gameStats,
  hudEvents,
  inputState,
  lookState,
  playerVitals,
  roundState,
  sessionState,
  settings,
  tracoState,
} from './state';

const tid = (t: { identifier: string | number }) => String(t.identifier);
const DEG2RAD = Math.PI / 180;

// posições dos bonecos de treino (aquecimento no SPAWN, longe das rotas dos bots)
const TARGET_SPOTS: Array<[number, number]> = [
  [3, 10.5], // frente-direita do spawn
  [-3.5, 11.5], // frente-esquerda do spawn
];

interface Tracer {
  line: THREE.Line;
  born: number;
}

/**
 * Game — GLView (OpenGL ES nativo), renderer three.js e loop.
 *
 * Etapa 8: agente CORO selecionável antes da partida — cada kit tem dois
 * Traços próprios (MUDO: CENZURA/BARREIRA · ECO: IMPULSO/SONAR ·
 * GRAVE: COURAÇA/ONDA) e um multiplicador de velocidade.
 *
 * Blindagem: qualquer exceção no init do GL ou no loop aparece num painel
 * legível (em vez de crash cego) — facilita diagnóstico em aparelho real.
 */
export default function Game() {
  const lookPointer = useRef<{ id: string; x: number; y: number }>({ id: '', x: 0, y: 0 });
  const { width } = useWindowDimensions();
  const [fatal, setFatal] = useState<{ message: string; stack: string } | null>(null);
  const [glKey, setGlKey] = useState(0);
  // handle de encerramento do loop — chamado quando o Game desmonta
  // (troca de agente) para não renderizar num contexto GL morto
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      stopRef.current?.();
    };
  }, []);

  const onContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      try {
        runGame(gl, setFatal, stopRef);
      } catch (e) {
        reportFatal(e, setFatal);
      }
    },
    []
  );

  if (fatal) {
    return (
      <View style={styles.errRoot}>
        <Text style={styles.errTitle}>FALHA NO MOTOR 3D</Text>
        <Text style={styles.errMsg}>{fatal.message}</Text>
        <ScrollView style={styles.errScroll}>
          <Text style={styles.errStack}>{fatal.stack}</Text>
        </ScrollView>
        <Text
          style={styles.errRetry}
          onPress={() => {
            setFatal(null);
            setGlKey((k) => k + 1);
          }}
        >
          ⟲ TENTAR DE NOVO
        </Text>
      </View>
    );
  }

  return (
    <View
      style={styles.fill}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <GLView key={glKey} style={styles.fill} onContextCreate={onContextCreate} />
    </View>
  );

  // --- handlers de mira (usam width via closure acima) ---
  function onTouchStart(e: NativeSyntheticEvent<NativeTouchEvent>) {
    const t = e.nativeEvent.changedTouches[0];
    if (!t || t.pageX < width * LEFT_ZONE) return;
    if (lookPointer.current.id !== '') return;
    lookPointer.current = { id: tid(t), x: t.pageX, y: t.pageY };
  }

  function onTouchMove(e: NativeSyntheticEvent<NativeTouchEvent>) {
    const lp = lookPointer.current;
    if (lp.id === '') return;
    const t = e.nativeEvent.touches.find((x) => tid(x) === lp.id);
    if (!t) return;
    lookState.yaw -= (t.pageX - lp.x) * LOOK_SENSITIVITY * settings.sensMultiplier;
    lookState.pitch -= (t.pageY - lp.y) * LOOK_SENSITIVITY * settings.sensMultiplier;
    lookState.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, lookState.pitch));
    lp.x = t.pageX;
    lp.y = t.pageY;
  }

  function onTouchEnd(e: NativeSyntheticEvent<NativeTouchEvent>) {
    const lp = lookPointer.current;
    if (lp.id === '') return;
    if (e.nativeEvent.changedTouches.some((t) => tid(t) === lp.id)) {
      lookPointer.current = { id: '', x: 0, y: 0 };
    }
  }
}

function reportFatal(
  e: unknown,
  set: (v: { message: string; stack: string }) => void
) {
  const err = e as { message?: string; stack?: string };
  set({
    message: err?.message ? String(err.message) : String(e),
    stack: err?.stack ? String(err.stack).split('\n').slice(0, 8).join('\n') : '—',
  });
}

/** Todo o motor de jogo, isolado para capturar exceções com contexto. */
function runGame(
  gl: ExpoWebGLRenderingContext,
  setFatal: (v: { message: string; stack: string }) => void,
  stopRef: React.MutableRefObject<(() => void) | null>
) {
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  // kit do agente escolhido na sessão (fixo durante a partida)
  const A = AGENTS[sessionState.agent];

  // --- cena ---
  const scene = new THREE.Scene();
  const bundle = buildSubsolo(scene);
  const range = new TargetRange(scene, TARGET_SPOTS);
  const squad = new BotSquad(scene, bundle.solids);

  // --- câmera (spawn CORO: sul do mapa, olhando para o norte/-Z) ---
  const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 220);
  camera.rotation.order = 'YXZ';
  camera.position.set(0, EYE_HEIGHT, 12.5);

  // posição viva + bots expostos no gancho de automação/diagnóstico
  const g = globalThis as unknown as {
    __PULSO__?: {
      pos?: THREE.Vector3;
      bots?: { alive: number; list: Array<{ id: number; phase: string; x: number; z: number; hp: number }> };
    };
  };
  if (g.__PULSO__) {
    g.__PULSO__.pos = camera.position;
    g.__PULSO__.bots = squad.info;
  }

  // --- renderer ---
  const renderer = new Renderer({ gl });
  renderer.setSize(w, h);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // --- efeitos de disparo ---
  const raycaster = new THREE.Raycaster();
  raycaster.far = TRACER_LENGTH;

  const muzzleLight = new THREE.PointLight(COLORS.MUZZLE, 0, 9, 2);
  scene.add(muzzleLight);
  let muzzleUntil = 0;

  const impactLight = new THREE.PointLight(COLORS.IMPACT, 0, 6, 2);
  scene.add(impactLight);
  const impactMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.07, 1),
    new THREE.MeshBasicMaterial({ color: COLORS.IMPACT, transparent: true, opacity: 0.95 })
  );
  impactMesh.visible = false;
  scene.add(impactMesh);
  let impactUntil = 0;

  const tracers: Tracer[] = [];
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const tmpVec = new THREE.Vector3();

  // tracer compartilhado (jogador e bots usam o mesmo efeito)
  const spawnTracer = (start: THREE.Vector3, end: THREE.Vector3) => {
    const geo = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
    const mat = new THREE.LineBasicMaterial({
      color: COLORS.TRACER,
      transparent: true,
      opacity: 0.9,
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    tracers.push({ line, born: performance.now() });
  };

  // --- Etapa 7: Traços ---
  // BARREIRA: muro de ressonância — bloqueia visão dos bots, balas e passagem
  const siteVec: Record<'A' | 'B', THREE.Vector3> = {
    A: new THREE.Vector3(SITES.A.x, 0, SITES.A.z),
    B: new THREE.Vector3(SITES.B.x, 0, SITES.B.z),
  };
  let barrier: {
    mesh: THREE.Mesh;
    edge: THREE.LineSegments;
    colliderIdx: number;
    until: number;
  } | null = null;

  const removeBarrier = () => {
    if (!barrier) return;
    scene.remove(barrier.mesh);
    scene.remove(barrier.edge);
    const si = bundle.solids.indexOf(barrier.mesh);
    if (si >= 0) bundle.solids.splice(si, 1);
    bundle.colliders.splice(barrier.colliderIdx, 1);
    barrier.mesh.geometry.dispose();
    (barrier.mesh.material as THREE.Material).dispose();
    barrier.edge.geometry.dispose();
    (barrier.edge.material as THREE.Material).dispose();
    barrier = null;
  };

  const spawnBarrier = (nowMs: number) => {
    const yaw = lookState.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const cx = camera.position.x + fx * TRACOS.BARREIRA_DIST;
    const cz = camera.position.z + fz * TRACOS.BARREIRA_DIST;

    const geo = new THREE.BoxGeometry(
      TRACOS.BARREIRA_WIDTH,
      TRACOS.BARREIRA_HEIGHT,
      0.12
    );
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: COLORS.TEAL,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    mesh.position.set(cx, TRACOS.BARREIRA_HEIGHT / 2, cz);
    mesh.rotation.y = yaw; // face longa perpendicular à visão
    scene.add(mesh);

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0xd9fff4, transparent: true, opacity: 0.9 })
    );
    edge.position.copy(mesh.position);
    edge.rotation.copy(mesh.rotation);
    scene.add(edge);

    // colisor AABB (a parede fina girada por yaw)
    const hw = TRACOS.BARREIRA_WIDTH / 2;
    const hx = Math.abs(Math.cos(yaw)) * hw + Math.abs(Math.sin(yaw)) * 0.06;
    const hz = Math.abs(Math.sin(yaw)) * hw + Math.abs(Math.cos(yaw)) * 0.06;
    bundle.colliders.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz });
    bundle.solids.push(mesh); // bloqueia balas e a visão dos bots

    barrier = {
      mesh,
      edge,
      colliderIdx: bundle.colliders.length - 1,
      until: nowMs + TRACOS.BARREIRA_LIFE_MS,
    };
  };

  // CENZURA: anel de choque que expande do jogador (feedback visual)
  interface Pulse {
    ring: THREE.Mesh;
    born: number;
  }
  const pulses: Pulse[] = [];
  const spawnPulse = (color: number) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.62, 48),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(camera.position.x, 0.12, camera.position.z);
    scene.add(ring);
    pulses.push({ ring, born: performance.now() });
  };

  const CENZURA_MS = 450; // duração do anel visual

  // ECO: IMPULSO — arremesso em andamento (direção + término)
  let dashUntil = 0;
  let dashX = 0;
  let dashZ = 0;

  const useTraco = (kind: TracoKey, nowMs: number) => {
    const playerAlive = playerVitals.hp > 0;
    const combatOk = roundState.phase === 'live' || roundState.phase === 'end';
    const spec = A.tracos.find((t) => t.key === kind);
    if (!combatOk || !playerAlive || !spec) return; // só Traços do próprio kit
    if (tracoState.uses[kind] <= 0 || nowMs < tracoState.readyAt[kind]) return;

    switch (kind) {
      case 'cenzura': {
        squad.blindNear(
          camera.position,
          nowMs,
          TRACOS.CENZURA_RANGE,
          TRACOS.CENZURA_BLIND_MS
        );
        spawnPulse(0xf2fbff); // clarão branco no chão
        break;
      }
      case 'barreira': {
        if (barrier) return; // um muro por vez
        spawnBarrier(nowMs);
        break;
      }
      case 'impulso': {
        // direção do arremesso: joystick se ativo, senão a mira
        const sin = Math.sin(lookState.yaw);
        const cos = Math.cos(lookState.yaw);
        let dx = -sin * inputState.moveZ + cos * inputState.moveX;
        let dz = -cos * inputState.moveZ - sin * inputState.moveX;
        const len = Math.hypot(dx, dz);
        if (len < 0.01) {
          dx = -sin;
          dz = -cos;
        } else {
          dx /= len;
          dz /= len;
        }
        dashX = dx;
        dashZ = dz;
        dashUntil = nowMs + TRACOS.IMPULSO_MS;
        spawnPulse(COLORS.TEAL);
        break;
      }
      case 'sonar': {
        squad.revealNear(camera.position, TRACOS.SONAR_RANGE, nowMs + TRACOS.SONAR_MS);
        spawnPulse(0x9fd8e8);
        break;
      }
      case 'couraca': {
        playerVitals.shieldBonus = TRACOS.COURACA_SHIELD;
        playerVitals.shieldBonusUntil = nowMs + TRACOS.COURACA_MS;
        spawnPulse(0xffb454);
        break;
      }
      case 'onda': {
        squad.shockwave(
          camera.position,
          TRACOS.ONDA_RANGE,
          TRACOS.ONDA_DMG,
          TRACOS.ONDA_PUSH,
          blocked
        );
        spawnPulse(COLORS.MAGENTA);
        break;
      }
    }

    tracoState.uses[kind]--;
    if (spec.cdMs > 0) tracoState.readyAt[kind] = nowMs + spec.cdMs;
    hudEvents.emit({ type: 'traco', kind });
  };

  // --- estado da arma (por rodada; espelha roundState.weapon) ---
  let ammo = WEAPONS.STACCATO.MAG;
  let lastShot = 0;
  let burstIdx = 0;
  let reloading = false;
  let reloadStart = 0;
  let lastWeapon = roundState.weapon;

  const resetPlayerForRound = () => {
    camera.position.set(0, EYE_HEIGHT, 12.5);
    camera.rotation.z = 0; // desfaz o rolê da death-cam
    lookState.yaw = 0;
    lookState.pitch = 0;
    lastWeapon = roundState.weapon;
    ammo = WEAPONS[lastWeapon].MAG;
    reloading = false;
    burstIdx = 0;
    gameStats.ammo = ammo;
    gameStats.reloading = false;
    // Traços da rodada (Etapa 7/8): recarga do kit do agente
    for (const t of A.tracos) {
      tracoState.uses[t.key] = t.uses;
      tracoState.readyAt[t.key] = 0;
    }
    dashUntil = 0;
    playerVitals.shieldBonus = 0;
    playerVitals.shieldBonusUntil = 0;
    removeBarrier();
    bundle.clearPlant();
    range.reset();
    squad.reset();
  };

  // --- gerente de rodadas ---
  const rounds = new RoundManager({
    onRoundStart: resetPlayerForRound,
    onPlanted: (site) => bundle.plant(site),
  });

  // dano do bot acertando o jogador: COURAÇA (temporal) e traje absorvem,
  // HUD pisca, morte encerra
  const hitPlayer = (dmg: number) => {
    if (playerVitals.hp <= 0) return;
    let left = dmg;
    if (playerVitals.shieldBonus > 0) {
      const absorbed = Math.min(playerVitals.shieldBonus, left);
      playerVitals.shieldBonus -= absorbed;
      left -= absorbed;
    }
    if (playerVitals.shield > 0) {
      const absorbed = Math.min(playerVitals.shield, left);
      playerVitals.shield -= absorbed;
      left -= absorbed;
    }
    playerVitals.hp = Math.max(0, playerVitals.hp - left);
    hudEvents.emit({ type: 'playerHit', dmg, hp: playerVitals.hp });
    if (playerVitals.hp <= 0) rounds.killPlayer();
  };

  const startReload = (nowMs: number) => {
    const W = WEAPONS[roundState.weapon];
    if (reloading || ammo === W.MAG) return;
    reloading = true;
    reloadStart = nowMs;
    gameStats.reloading = true;
    gameStats.reloadProgress = 0;
    hudEvents.emit({ type: 'reload' });
  };

  const fire = (nowMs: number) => {
    const W = WEAPONS[roundState.weapon];
    if (reloading) return;
    if (ammo <= 0) {
      startReload(nowMs);
      return;
    }

    // trocou de arma entre tiros (comprou na fase de compra) → reset
    if (roundState.weapon !== lastWeapon) {
      lastWeapon = roundState.weapon;
      ammo = W.MAG;
      gameStats.ammo = ammo;
    }

    // reinicia o spray se o dedo ficou longe do gatilho
    if (nowMs - lastShot > W.BURST_RESET_MS) burstIdx = 0;
    lastShot = nowMs;

    // direção com desvio do padrão de spray (graus → rad)
    const [sxDeg, syDeg] = sprayAt(burstIdx, roundState.weapon);
    burstIdx++;
    camera.getWorldDirection(fwd);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    tmpDir
      .copy(fwd)
      .addScaledVector(right, Math.tan(sxDeg * DEG2RAD))
      .addScaledVector(up, -Math.tan(syDeg * DEG2RAD))
      .normalize();

    // raycast: cenário + bonecos de treino + operadores DIRAC vivos
    const liveTargets = range.meshes.filter((m) => {
      const d = range.dummies[(m.userData as { dummyId: number }).dummyId];
      return d.state === 'alive';
    });
    raycaster.set(camera.position, tmpDir);
    const hits = raycaster.intersectObjects(
      [...bundle.solids, ...liveTargets, ...squad.aliveMeshes],
      false
    );
    const hit = hits.length > 0 ? hits[0] : null;

    // origem visual: boca da arma
    const start = tmpVec
      .copy(camera.position)
      .addScaledVector(fwd, 0.35)
      .addScaledVector(right, 0.22)
      .addScaledVector(up, -0.16);

    // aplica dano se acertou alguém (treino ou DIRAC)
    let end: THREE.Vector3;
    const ud = hit ? (hit.object.userData as { dummyId?: number; botId?: number; part?: string }) : null;
    if (hit && ud && (ud.dummyId != null || ud.botId != null)) {
      const isHead = ud.part === 'head';
      const dmg = isHead ? W.DMG_HEAD : W.DMG_BODY;
      let killed = false;
      if (ud.dummyId != null) {
        const res = range.damage(range.dummies[ud.dummyId], dmg, isHead);
        killed = res.killed;
      } else {
        const res = squad.damage(squad.byId(ud.botId as number), dmg, isHead);
        killed = res.killed;
      }
      gameStats.hits++;
      if (isHead) gameStats.headshots++;
      if (killed) {
        gameStats.kills++;
        rounds.payKill(); // economia: abate paga dB na fase de ação
        hudEvents.emit({ type: 'kill', head: isHead });
      } else {
        hudEvents.emit({ type: 'hit', head: isHead });
      }
      end = hit.point.clone();
      // faísca no alvo (reutiliza o efeito de impacto)
      impactLight.position.copy(hit.point);
      impactLight.intensity = isHead ? 10 : 6;
      impactMesh.position.copy(hit.point);
      impactMesh.visible = true;
      impactMesh.scale.setScalar(isHead ? 1.4 : 1);
      impactUntil = nowMs + IMPACT_MS;
    } else if (hit) {
      end = hit.point.clone();
      impactLight.position.copy(hit.point);
      impactLight.intensity = 7;
      impactMesh.position.copy(hit.point);
      impactMesh.visible = true;
      impactMesh.scale.setScalar(1);
      impactUntil = nowMs + IMPACT_MS;
    } else {
      end = start.clone().addScaledVector(tmpDir, TRACER_LENGTH);
    }

    // tracer
    spawnTracer(start, end);

    muzzleLight.position.copy(start);
    muzzleLight.intensity = 12;
    muzzleUntil = nowMs + MUZZLE_MS;

    ammo--;
    gameStats.ammo = ammo;
    gameStats.shots++;
    hudEvents.emit({ type: 'shot' });
    squad.heardShot(camera.position, nowMs); // o estrondo ecoa pelo subsolo

    if (ammo <= 0) startReload(nowMs); // esvaziou: recarrega sozinho
  };

  // --- colisão: círculo do jogador vs AABBs das paredes ---
  const blocked = (x: number, z: number) => {
    for (const c of bundle.colliders) {
      if (
        x + PLAYER_RADIUS > c.minX &&
        x - PLAYER_RADIUS < c.maxX &&
        z + PLAYER_RADIUS > c.minZ &&
        z - PLAYER_RADIUS < c.maxZ
      ) {
        return true;
      }
    }
    return false;
  };

  // --- distância ao site mais próximo (zona de plantio) ---
  const siteUnder = (x: number, z: number): 'A' | 'B' | null => {
    const distA = Math.hypot(x - SITES.A.x, z - SITES.A.z);
    const distB = Math.hypot(x - SITES.B.x, z - SITES.B.z);
    if (distA <= ROUND.SITE_RADIUS) return 'A';
    if (distB <= ROUND.SITE_RADIUS) return 'B';
    return null;
  };

  // --- loop de jogo ---
  let raf = 0;
  let last = performance.now();
  let stopped = false;
  const loop = () => {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    try {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      const dtMs = now - last;
      last = now;

      // mira
      camera.rotation.y = lookState.yaw;
      camera.rotation.x = lookState.pitch;

      // locomoção com colisão (morto não anda) — resolve eixo a eixo
      const playerAlive = playerVitals.hp > 0;
      const mx = inputState.moveX;
      const mz = inputState.moveZ;
      const dashing = playerAlive && now < dashUntil;
      const moved = playerAlive && (dashing || mx !== 0 || mz !== 0);
      if (dashing) {
        // IMPULSO (ECO): subpassos curtos para não atravessar paredes
        let left = (TRACOS.IMPULSO_DIST / TRACOS.IMPULSO_MS) * dtMs;
        while (left > 0.001) {
          const step = Math.min(0.2, left);
          left -= step;
          const nx = camera.position.x + dashX * step;
          const nz = camera.position.z + dashZ * step;
          const okX = !blocked(nx, camera.position.z);
          const okZ = !blocked(camera.position.x, nz);
          if (okX) camera.position.x = nx;
          if (okZ) camera.position.z = nz;
          if (!okX && !okZ) break; // encalhou numa quina
        }
      } else if (playerAlive && (mx !== 0 || mz !== 0)) {
        const sin = Math.sin(lookState.yaw);
        const cos = Math.cos(lookState.yaw);
        const step = MOVE_SPEED * A.speedMul * dt;
        const dx = (-sin * mz + cos * mx) * step;
        const dz = (-cos * mz - sin * mx) * step;
        if (!blocked(camera.position.x + dx, camera.position.z)) {
          camera.position.x += dx;
        }
        if (!blocked(camera.position.x, camera.position.z + dz)) {
          camera.position.z += dz;
        }
      }

      // IMPULSO: abertura do campo de visão (sensação de velocidade)
      const targetFov = dashing ? 84 : 75;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10);
        camera.updateProjectionMatrix();
      }

      // COURAÇA (GRAVE): escudo temporal expira
      if (
        playerVitals.shieldBonus > 0 &&
        now >= playerVitals.shieldBonusUntil
      ) {
        playerVitals.shieldBonus = 0;
      }

      // death-cam: câmera despenca e rola quando o jogador cai
      if (!playerAlive) {
        camera.position.y += (0.45 - camera.position.y) * Math.min(1, dt * 3.5);
        camera.rotation.z += (0.42 - camera.rotation.z) * Math.min(1, dt * 3.5);
      }

      // zona de site (para o HUD e o plantio)
      roundState.inSite = siteUnder(camera.position.x, camera.position.z);

      // fases da rodada
      rounds.update(now, dtMs, moved);

      // operadores DIRAC (apenas na fase de ação)
      squad.update(dt, now, {
        camera,
        playerPos: camera.position,
        playerAlive,
        active: roundState.phase === 'live',
        playerMoving: moved,
        blocked,
        hitPlayer,
        tracer: spawnTracer,
        muzzle: (p) => {
          muzzleLight.position.copy(p);
          muzzleLight.intensity = 12;
          muzzleUntil = now + MUZZLE_MS;
        },
        plantPos: roundState.planted && roundState.plantSite
          ? siteVec[roundState.plantSite]
          : null,
        onSilenced: () => rounds.silence(),
      });
      gameStats.enemiesAlive = squad.info.alive;
      gameStats.defusing = squad.info.defusing;
      gameStats.defuseProgress = squad.info.defuseProgress;

      // Traços pedidos pelo HUD (Etapa 7/8)
      if (inputState.tracoQueued) {
        const kind = inputState.tracoQueued;
        inputState.tracoQueued = null;
        useTraco(kind, now);
      }

      // partida encerrada → voltar à seleção de agente (Etapa 8)
      if (inputState.agentSelectQueued) {
        inputState.agentSelectQueued = false;
        hudEvents.emit({ type: 'backToSelect' });
      }

      // BARREIRA: pulsa e some no fim da vida útil
      if (barrier) {
        const left = barrier.until - now;
        const mat = barrier.mesh.material as THREE.MeshBasicMaterial;
        const emat = barrier.edge.material as THREE.LineBasicMaterial;
        mat.opacity =
          0.26 + Math.sin(now / 160) * 0.05 + Math.min(1, left / 800) * 0.06;
        emat.opacity = Math.min(0.9, left / 800);
        if (left <= 0) removeBarrier();
      }

      // CENZURA: anéis de choque expandem e somem
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        const age = now - p.born;
        if (age >= CENZURA_MS) {
          scene.remove(p.ring);
          p.ring.geometry.dispose();
          (p.ring.material as THREE.Material).dispose();
          pulses.splice(i, 1);
        } else {
          const k = age / CENZURA_MS;
          p.ring.scale.setScalar(0.4 + k * 10);
          (p.ring.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - k);
        }
      }

      // recarga pedida pelo HUD
      if (inputState.reloadQueued) {
        inputState.reloadQueued = false;
        startReload(now);
      }

      // progresso da recarga
      if (reloading) {
        const k = (now - reloadStart) / WEAPONS[roundState.weapon].RELOAD_MS;
        gameStats.reloadProgress = Math.min(1, k);
        if (k >= 1) {
          reloading = false;
          ammo = WEAPONS[roundState.weapon].MAG;
          gameStats.ammo = ammo;
          gameStats.reloading = false;
        }
      }

      // fogo automático — só na fase de ação, só com o jogador vivo
      const combatOk =
        (roundState.phase === 'live' || roundState.phase === 'end') && playerAlive;
      if (combatOk && inputState.firing && !reloading && now - lastShot >= WEAPONS[roundState.weapon].CADENCE_MS) {
        fire(now);
      }

      // tracers envelhecem
      for (let i = tracers.length - 1; i >= 0; i--) {
        const tr = tracers[i];
        const age = now - tr.born;
        if (age >= TRACER_MS) {
          scene.remove(tr.line);
          tr.line.geometry.dispose();
          (tr.line.material as THREE.Material).dispose();
          tracers.splice(i, 1);
        } else {
          (tr.line.material as THREE.LineBasicMaterial).opacity = 0.95 * (1 - age / TRACER_MS);
        }
      }
      if (now >= muzzleUntil) muzzleLight.intensity = 0;
      if (now >= impactUntil) {
        impactLight.intensity = 0;
        impactMesh.visible = false;
      } else {
        const k = (impactUntil - now) / IMPACT_MS; // 1 → 0
        impactMesh.scale.multiplyScalar(1 + (1 - k) * 0.12);
        (impactMesh.material as THREE.MeshBasicMaterial).opacity = 0.95 * k;
      }

      range.update(dt, camera);
      bundle.update(dt, now / 1000);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    } catch (e) {
      stopped = true;
      cancelAnimationFrame(raf);
      reportFatal(e, setFatal);
    }
  };
  loop();
  stopRef.current = () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  errRoot: {
    flex: 1,
    backgroundColor: CSS.BG,
    padding: 24,
    justifyContent: 'center',
  },
  errTitle: {
    color: CSS.MAGENTA,
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: 10,
  },
  errMsg: { color: '#F2FBFF', fontFamily: 'monospace', fontSize: 13, marginBottom: 10 },
  errScroll: { maxHeight: 180, marginBottom: 12 },
  errStack: { color: CSS.TEXT_DIM, fontFamily: 'monospace', fontSize: 10 },
  errRetry: {
    color: CSS.TEAL,
    fontFamily: 'monospace',
    fontSize: 15,
    letterSpacing: 2,
    paddingVertical: 10,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(45,226,198,0.5)',
    borderRadius: 8,
  },
});
