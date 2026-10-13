import React, { useCallback, useRef, useState } from 'react';
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
  TRACER_LENGTH,
  TRACER_MS,
  WEAPONS,
} from '../config/constants';
import { gameStats, hudEvents, inputState, lookState, playerVitals, roundState, settings } from './state';

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
 * Etapa 6: operadores DIRAC com IA (patrulha, percepção, rajadas), dano
 * ao jogador (escudo absorve), morte = fim de rodada e death-cam.
 *
 * Blindagem: qualquer exceção no init do GL ou no loop aparece num painel
 * legível (em vez de crash cego) — facilita diagnóstico em aparelho real.
 */
export default function Game() {
  const lookPointer = useRef<{ id: string; x: number; y: number }>({ id: '', x: 0, y: 0 });
  const { width } = useWindowDimensions();
  const [fatal, setFatal] = useState<{ message: string; stack: string } | null>(null);
  const [glKey, setGlKey] = useState(0);

  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    try {
      runGame(gl, setFatal);
    } catch (e) {
      reportFatal(e, setFatal);
    }
  }, []);

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
function runGame(gl: ExpoWebGLRenderingContext, setFatal: (v: { message: string; stack: string }) => void) {
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;

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
    bundle.clearPlant();
    range.reset();
    squad.reset();
  };

  // --- gerente de rodadas ---
  const rounds = new RoundManager({
    onRoundStart: resetPlayerForRound,
    onPlanted: (site) => bundle.plant(site),
  });

  // dano do bot acertando o jogador: escudo absorve, HUD pisca, morte encerra
  const hitPlayer = (dmg: number) => {
    if (playerVitals.hp <= 0) return;
    let left = dmg;
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
      const moved = playerAlive && (mx !== 0 || mz !== 0);
      if (moved) {
        const sin = Math.sin(lookState.yaw);
        const cos = Math.cos(lookState.yaw);
        const step = MOVE_SPEED * dt;
        const dx = (-sin * mz + cos * mx) * step;
        const dz = (-cos * mz - sin * mx) * step;
        if (!blocked(camera.position.x + dx, camera.position.z)) {
          camera.position.x += dx;
        }
        if (!blocked(camera.position.x, camera.position.z + dz)) {
          camera.position.z += dz;
        }
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
      });
      gameStats.enemiesAlive = squad.info.alive;

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
