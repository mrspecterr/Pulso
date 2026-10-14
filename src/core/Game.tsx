import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GLView } from 'expo-gl';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import { Renderer } from 'expo-three';
import { buildSubsolo } from '../scenes/SubsoloScene';
import type { SceneBundle } from '../scenes/SubsoloScene';
import { buildPalco } from '../scenes/PalcoScene';
import { TargetRange } from '../game/Targets';
import { BotSquad } from '../game/Bots';
import type { Combatant } from '../game/Bots';
import { AllySquad, ALLY_NAMES } from '../game/Allies';
import { RoundManager } from '../game/Round';
import { sprayAt } from '../game/Legato';
import { WeaponSystem } from '../game/Weapon';
import { Sparks } from '../game/Sparks';
import { SFX } from '../game/Audio';
import { MAPS } from '../config/maps';
import type { MapId } from '../config/maps';
import {
  AGENTS,
  CSS,
  COLORS,
  ECONOMY,
  EYE_HEIGHT,
  MOVE_SPEED,
  MUZZLE_MS,
  PLAYER_HP,
  PLAYER_RADIUS,
  QUALITY,
  ROUND,
  TRACOS,
  TRACER_LENGTH,
  TRACER_MS,
  TRAINING,
  WEAPONS,
} from '../config/constants';
import type { QualityId, TracoKey } from '../config/constants';
import {
  gameStats,
  hudEvents,
  inputState,
  lookState,
  matchStats,
  minimapState,
  playerVitals,
  roundState,
  scoreboard,
  sessionState,
  settings,
  tracoState,
} from './state';
import { combatModifiers } from './state';

const DEG2RAD = Math.PI / 180;

// construtores de cena por mapa (Etapa 14) — a geometria de JOGO
// (rotas/âncoras/spawn/sites) vem do MAPS, a arte vem daqui; Etapa 17:
// o CLIMA da sessão reescreve a luz de cada casa
const SCENE_BUILDERS: Record<
  MapId,
  (scene: THREE.Scene, weather: import('../config/maps').WeatherId) => SceneBundle
> = {
  SUBSOLO: buildSubsolo,
  PALCO: buildPalco,
};

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

  // Etapa 10: TODOS os toques chegam pela camada única (InputLayer) no HUD —
  // a mira de arrasto que vivia aqui não existe mais.
  return (
    <View style={styles.fill}>
      <GLView key={glKey} style={styles.fill} onContextCreate={onContextCreate} />
    </View>
  );
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
  // mapa da sessão (Etapa 14): sites, spawn, rotas e caminhos
  const M = MAPS[sessionState.map];
  // clima da sessão (Etapa 17): arte das cenas + números de combate
  const weather = sessionState.weather;
  // campo de provas (Etapa 16): treino livre — dB infinito, sem rodadas
  const training = sessionState.mode === 'treino';

  // partida nova, estatísticas novas (Etapa 16): o Game remonta a cada
  // partida, mas os contadores viviam no state.ts global e atravessavam
  // sessões — o fim de partida mostrava (e a carreira gravava) totais
  // acumulados de todas as partidas do processo
  gameStats.kills = 0;
  gameStats.headshots = 0;
  gameStats.shots = 0;
  gameStats.hits = 0;
  matchStats.plants = 0; // Etapa 17: plantios/quedas são DA PARTIDA
  matchStats.deaths = 0;

  // --- cena ---
  const scene = new THREE.Scene();
  const bundle = SCENE_BUILDERS[sessionState.map](scene, weather);
  const range = new TargetRange(scene, M.targets);
  const squad = new BotSquad(scene, bundle.solids, M);
  squad.setWeather(weather); // Etapa 17: percepção/audição/reação do clima
  const allies = new AllySquad(scene, bundle.solids, M); // Etapa 12: esquadrão CORO
  // minimapa (Etapa 13/14): footprint das paredes + geometria do mapa
  minimapState.walls = bundle.walls;
  minimapState.worldW = M.world.W;
  minimapState.worldH = M.world.H;
  minimapState.siteA = { x: M.sites.A.x, z: M.sites.A.z };
  minimapState.siteB = { x: M.sites.B.x, z: M.sites.B.z };

  // --- câmera (spawn CORO: sul do mapa, olhando para o norte/-Z) ---
  const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 220);
  camera.rotation.order = 'YXZ';
  camera.position.set(M.spawn[0], EYE_HEIGHT, M.spawn[1]);

  // posição viva + bots expostos no gancho de automação/diagnóstico
  const g = globalThis as unknown as {
    __PULSO__?: {
      pos?: THREE.Vector3;
      bots?: { alive: number; list: Array<{ id: number; phase: string; x: number; z: number; hp: number }> };
      renderer?: THREE.WebGLRenderer;
      dev?: {
        /** encerra a partida na hora (fim de partida controlado p/ testes) */
        matchOver: (winner: 'CORO' | 'DIRAC') => void;
      };
    };
  };
  if (g.__PULSO__) {
    g.__PULSO__.pos = camera.position;
    g.__PULSO__.bots = squad.info;
    g.__PULSO__.dev = {
      matchOver: (winner) => {
        roundState.matchWinner = winner;
        roundState.phase = 'over';
        hudEvents.emit({ type: 'matchOver', winner });
      },
    };
  }

  // a câmera precisa estar na cena para os filhos dela (a arma) renderizarem
  scene.add(camera);
  const weapon = new WeaponSystem(camera);
  weapon.setWeapon(roundState.weapon);
  weapon.attachShells(scene);
  // luz de preenchimento presa à câmera: garante que o viewmodel nunca vire
  // silhueta preta contra o cenário escuro (alcance curto, só afeta a arma)
  const gunFill = new THREE.PointLight(0xfff1e0, 0.55, 1.7, 2);
  gunFill.position.set(0.18, 0.08, -0.22);
  camera.add(gunFill);

  // --- renderer (Etapa 10: pipeline de desempenho) ---
  const renderer = new Renderer({ gl });
  renderer.setSize(w, h);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // direção de arte (Etapa 9): filmic. Etapa 17: o clima afina a exposição —
  // a noite não estoura no neon, a neblina não vira leite.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure =
    weather === 'NOITE' ? 1.42 : weather === 'NEBLINA' ? 1.5 : 1.55;
  // Etapa 10: PCF puro (o "Soft" custa o dobro no mobile) + atualização a 20 Hz
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  let nextShadowUpdate = 0;

  // Alvo de render escalonado: o mundo 3D é desenhado em resolução menor e
  // esticado para o buffer nativo num único quad texturizado (1 draw call).
  // O HUD React continua nítido — só a imagem 3D fica mais leve de calcular.
  let renderTarget: THREE.WebGLRenderTarget | null = null;
  const blitScene = new THREE.Scene();
  const blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blitMat = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false });
  blitMat.toneMapped = false; // o tom filmico já foi aplicado ao renderizar o mundo
  blitScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMat));

  const applyQuality = () => {
    const Q = QUALITY[settings.quality];
    renderTarget?.dispose();
    renderTarget = new THREE.WebGLRenderTarget(
      Math.max(2, Math.floor(w * Q.scale)),
      Math.max(2, Math.floor(h * Q.scale)),
      { depthBuffer: true, stencilBuffer: false, generateMipmaps: false }
    );
    blitMat.map = renderTarget.texture;
    blitMat.needsUpdate = true;
    // sombras: ligar/desligar exige recompilar materiais (uma vez, ok)
    const shadowsChanged = renderer.shadowMap.enabled !== Q.shadows;
    renderer.shadowMap.enabled = Q.shadows;
    renderer.shadowMap.needsUpdate = true;
    bundle.setShadowResolution(Q.shadowSize);
    if (shadowsChanged) {
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m) {
          (Array.isArray(m) ? m : [m]).forEach((mm) => {
            mm.needsUpdate = true;
          });
        }
      });
    }
  };
  let curQuality: QualityId = settings.quality;
  applyQuality();
  if (g.__PULSO__) g.__PULSO__.renderer = renderer; // diagnóstico direto

  // --- efeitos de disparo ---
  const raycaster = new THREE.Raycaster();
  raycaster.far = TRACER_LENGTH;

  const muzzleLight = new THREE.PointLight(COLORS.MUZZLE, 0, 9, 2);
  scene.add(muzzleLight);
  let muzzleUntil = 0;

  // faíscas de impacto (Etapa 9 — substituem o flash estático antigo)
  const sparks = new Sparks(scene);
  const tmpNormal = new THREE.Vector3();

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
    A: new THREE.Vector3(M.sites.A.x, 0, M.sites.A.z),
    B: new THREE.Vector3(M.sites.B.x, 0, M.sites.B.z),
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

  // GRAVE: POSTURA (Etapa 17) — cotovelo fincado: mira morta, passo curto
  let steadyUntil = 0;

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
      case 'cadencia': {
        // VIBRATO (Etapa 16): reafina o esquadrão — o jogador regenera ao
        // longo do canal e os aliados no raio recebem a cura na hora
        playerVitals.regenUntil = nowMs + TRACOS.CADENCIA_MS;
        playerVitals.regenPerSec = TRACOS.CADENCIA_REGEN;
        allies.healNear(
          camera.position,
          TRACOS.CADENCIA_ALLY_RANGE,
          TRACOS.CADENCIA_HEAL
        );
        spawnPulse(0xb48cff);
        break;
      }
      case 'ritardando': {
        // VIBRATO (Etapa 16): campo de lentidão — DIRACs no raio ficam
        // pesados e demoram a reagir enquanto o campo segura
        squad.slowNear(
          camera.position,
          TRACOS.RITARDANDO_RANGE,
          nowMs + TRACOS.RITARDANDO_MS,
          TRACOS.RITARDANDO_REACT_MS
        );
        spawnPulse(0x8fb7ff);
        break;
      }
      case 'surdina': {
        // MUDO (Etapa 17): campo de surdez — atravessa parede (ressonância)
        squad.deafenNear(
          camera.position,
          nowMs,
          TRACOS.SURDINA_RANGE,
          TRACOS.SURDINA_MS
        );
        spawnPulse(0x51606e); // pulso surdo-mudo, quase sem cor
        break;
      }
      case 'marca': {
        // ECO (Etapa 17): dardo rastreador no alvo mais alinhado com a mira
        const marked = squad.markNearest(
          camera,
          TRACOS.MARCA_FOV_DOT,
          TRACOS.MARCA_RANGE,
          nowMs + TRACOS.MARCA_MS
        );
        if (marked < 0) {
          // errou o cone: não gasta o uso (o dardo nem saiu do tubo)
          tracoState.uses[kind]++;
          break;
        }
        spawnPulse(COLORS.TEAL);
        break;
      }
      case 'postura': {
        // GRAVE (Etapa 17): finca o cotovelo — mira morta pelo prazo
        steadyUntil = nowMs + TRACOS.POSTURA_MS;
        spawnPulse(0xffb454);
        break;
      }
      case 'acorde': {
        // VIBRATO (Etapa 17): escudo harmônico do esquadrão inteiro
        combatModifiers.guardUntil = nowMs + TRACOS.ACORDE_MS;
        spawnPulse(0xb48cff);
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
    camera.position.set(M.spawn[0], EYE_HEIGHT, M.spawn[1]);
    camera.rotation.z = 0; // desfaz o rolê da death-cam
    lookState.yaw = 0;
    lookState.pitch = 0;
    lastWeapon = roundState.weapon;
    ammo = WEAPONS[lastWeapon].MAG;
    weapon.setWeapon(lastWeapon);
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
    playerVitals.regenUntil = 0; // CADÊNCIA não atravessa rodadas
    playerVitals.regenPerSec = 0;
    steadyUntil = 0; // POSTURA recomeça do zero (Etapa 17)
    combatModifiers.guardUntil = 0; // ACORDE idem
    removeBarrier();
    bundle.clearPlant();
    range.reset();
    squad.reset();
    squad.setLevel(roundState.diracLevel); // Etapa 13: DIRACs do nível atual
    allies.reset(); // Etapa 12: esquadrão de volta à formação
    scoreboard.kills = {}; // Etapa 13: placar de combate limpa
  };

  // --- gerente de rodadas ---
  const rounds = new RoundManager({
    onRoundStart: resetPlayerForRound,
    onPlanted: (site) => bundle.plant(site),
    // Etapa 12: o CORO segue em campo enquanto restar alguém vivo
    coroAlive: () => playerVitals.hp > 0 || allies.info.alive > 0,
    // Etapa 16: campo de provas (a máquina de rodadas fica desligada)
    training,
  });

  // campo de provas: caído → volta ao spawn com o kit recarregado
  let respawnAt = 0;

  // dano do bot acertando o jogador: COURAÇA (temporal) e traje absorvem,
  // ACORDE (Etapa 17) reduz a conta antes de tudo, HUD pisca, morte
  // encerra — a menos que o esquadrão ainda lute (Etapa 12)
  const hitPlayer = (dmg: number, killer: string) => {
    if (playerVitals.hp <= 0) return;
    let left = dmg;
    if (performance.now() < combatModifiers.guardUntil) {
      left *= combatModifiers.guardMul; // escudo harmônico do VIBRATO
    }
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
    if (playerVitals.hp <= 0) {
      matchStats.deaths++; // Etapa 17: a carreira quer saber das quedas
      hudEvents.emit({ type: 'feed', killer, victim: 'VOCÊ' });
      if (training) {
        // Etapa 16: no campo de provas não há rodada — quem decide a volta
        // é o respawn do treino (spawn + vida + kit + pente cheios)
        respawnAt = performance.now() + TRAINING.RESPAWN_MS;
        return;
      }
      rounds.killPlayer();
      // Etapa 13: líder caiu com o Diapasão → o aliado vivo mais próximo
      // pega a carga e leva ao site (a rodada segue com você de espectador)
      if (roundState.carrying && roundState.phase === 'live') {
        let best = -1;
        let bestD = Infinity;
        allies.info.list.forEach((l, i) => {
          if (!l.alive) return;
          const d = Math.hypot(
            l.x - camera.position.x,
            l.z - camera.position.z
          );
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        if (best >= 0) {
          roundState.carrying = false;
          allies.assignCarrier(best); // grava roundState.carrierAlly
        }
      }
    }
  };

  // --- combatentes 5v5 (Etapa 12) — posições vivas por referência ---
  // O que os DIRACs veem: o jogador + os aliados CORO.
  const playerCombatant: Combatant = {
    pos: camera.position,
    moving: false,
    alive: true,
    isPlayer: true,
    hit: (dmg, killer) => hitPlayer(dmg, killer),
  };
  const allyCombatants: Combatant[] = ALLY_NAMES.map((_, i) => ({
    pos: allies.posOf(i),
    moving: false,
    alive: true,
    isPlayer: false,
    hit: (dmg, killer) => {
      allies.damage(allies.byIndex(i), dmg, killer);
    },
  }));
  const coroTargets = [playerCombatant, ...allyCombatants];
  // O que os aliados veem: os operadores DIRAC.
  const diracTargets: Combatant[] = squad.info.list.map(
    (bi) =>
      ({
        pos: squad.posOf(bi.id),
        moving: false,
        alive: true,
        isPlayer: false,
        hit: (dmg, killer) => {
          squad.damage(squad.byId(bi.id), dmg, false, killer);
        },
      }) as Combatant
  );

  const startReload = (nowMs: number) => {
    const W = WEAPONS[roundState.weapon];
    if (reloading || ammo === W.MAG) return;
    reloading = true;
    reloadStart = nowMs;
    gameStats.reloading = true;
    gameStats.reloadProgress = 0;
    hudEvents.emit({ type: 'reload' });
  };

  // --- placar de combate (Etapa 13) ---
  // Abates confirmados alimentam o scoreboard mostrado no fim da rodada;
  // eventos de missão ("TENOR ▸ PEGOU O DIAPASÃO") não contam.
  const isCombatantName = (n: string) =>
    n === 'VOCÊ' ||
    (ALLY_NAMES as readonly string[]).includes(n) ||
    /^DIRAC [1-5]$/.test(n);
  const unsubFeed = hudEvents.subscribe((e) => {
    if (
      e.type === 'feed' &&
      e.killer !== e.victim &&
      isCombatantName(e.killer) &&
      isCombatantName(e.victim)
    ) {
      scoreboard.kills[e.killer] = (scoreboard.kills[e.killer] ?? 0) + 1;
    }
    // Etapa 17: plantio DESTE jogador conta para a carreira/missões — o
    // evento agora diz quem fechou o canal (jogador ou aliado)
    if (e.type === 'planted' && e.by === 'player') {
      matchStats.plants++;
    }
  });

  const fire = (nowMs: number) => {
    const W = WEAPONS[roundState.weapon];
    if (reloading) return;
    if (ammo <= 0) {
      hudEvents.emit({ type: 'dry' }); // gatilho no vazio (Etapa 11)
      startReload(nowMs);
      return;
    }

    // trocou de arma entre tiros (comprou na fase de compra) → reset
    if (roundState.weapon !== lastWeapon) {
      lastWeapon = roundState.weapon;
      ammo = W.MAG;
      gameStats.ammo = ammo;
      weapon.setWeapon(roundState.weapon);
    }

    // reinicia o spray se o dedo ficou longe do gatilho
    if (nowMs - lastShot > W.BURST_RESET_MS) burstIdx = 0;
    lastShot = nowMs;

    // POSTURA (GRAVE, Etapa 17): cotovelo fincado — a tendência do spray
    // morre enquanto durar a postura (os balins da GLISSANDO continuam no
    // cone de dispersão — a escopeta não vira um laser)
    const steady = nowMs < steadyUntil;
    const [sxDeg, syDeg] = steady ? [0, 0] : sprayAt(burstIdx, roundState.weapon);
    burstIdx++;
    camera.getWorldDirection(fwd);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);

    // origem visual: boca da arma (viewmodel em primeira pessoa)
    const start = weapon.muzzleWorld(tmpVec);

    // raycast: cenário + bonecos de treino + operadores DIRAC vivos
    const liveTargets = range.meshes.filter((m) => {
      const d = range.dummies[(m.userData as { dummyId: number }).dummyId];
      return d.state === 'alive';
    });
    const hitGroup = [...bundle.solids, ...liveTargets, ...squad.aliveMeshes];

    // ---- GLISSANDO (Etapa 16): leque de balins ----
    // Cada balim sorteia um ponto no cone de dispersão (em volta da
    // tendência do spray). O dano é somado POR VÍTIMA e aplicado uma única
    // vez — um abate, um feed, um pagamento; precisão conta o gatilho.
    if (W.PELLETS > 1) {
      const dummyHits = new Map<number, { dmg: number; head: boolean; point: THREE.Vector3 }>();
      const botHits = new Map<number, { dmg: number; head: boolean; point: THREE.Vector3 }>();
      const sparkPts: Array<{ p: THREE.Vector3; n: THREE.Vector3 | null }> = [];
      const ends: THREE.Vector3[] = []; // até 3 tracers do leque

      for (let i = 0; i < W.PELLETS; i++) {
        // disco uniforme no cone (sqrt evita aglomerar no centro)
        const rr = Math.sqrt(Math.random()) * W.SPREAD_DEG;
        const ang = Math.random() * Math.PI * 2;
        const sx = sxDeg + Math.cos(ang) * rr;
        const sy = syDeg + Math.sin(ang) * rr;
        tmpDir
          .copy(fwd)
          .addScaledVector(right, Math.tan(sx * DEG2RAD))
          .addScaledVector(up, -Math.tan(sy * DEG2RAD))
          .normalize();
        raycaster.set(camera.position, tmpDir);
        const hits = raycaster.intersectObjects(hitGroup, false);
        const hit = hits.length > 0 ? hits[0] : null;
        const end = hit
          ? hit.point.clone()
          : start.clone().addScaledVector(tmpDir, TRACER_LENGTH);
        if (ends.length < 3) ends.push(end);

        const ud = hit
          ? (hit.object.userData as { dummyId?: number; botId?: number; part?: string })
          : null;
        if (hit && ud && ud.dummyId != null) {
          const h = dummyHits.get(ud.dummyId) ?? {
            dmg: 0,
            head: false,
            point: end,
          };
          h.dmg += ud.part === 'head' ? W.DMG_HEAD : W.DMG_BODY;
          h.head = h.head || ud.part === 'head';
          dummyHits.set(ud.dummyId, h);
        } else if (hit && ud && ud.botId != null) {
          const h = botHits.get(ud.botId) ?? {
            dmg: 0,
            head: false,
            point: end,
          };
          h.dmg += ud.part === 'head' ? W.DMG_HEAD : W.DMG_BODY;
          h.head = h.head || ud.part === 'head';
          botHits.set(ud.botId, h);
        } else if (hit) {
          // cenário: guarda até 3 pontos para as faíscas do leque
          if (sparkPts.length < 3) {
            sparkPts.push({
              p: end,
              n: hit.face
                ? tmpNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).clone()
                : null,
            });
          }
        }
      }

      // aplica o dano somado por vítima (mesmos canais da bala única)
      dummyHits.forEach((h, id) => {
        const res = range.damage(range.dummies[id], h.dmg, h.head);
        gameStats.hits++;
        if (h.head) gameStats.headshots++;
        if (res.killed) {
          gameStats.kills++;
          rounds.payKill();
          hudEvents.emit({ type: 'kill', head: h.head });
        } else {
          hudEvents.emit({ type: 'hit', head: h.head });
        }
        sparks.burst(h.point, null, 0xff8fc4, 8, 2.6);
      });
      botHits.forEach((h, id) => {
        const res = squad.damage(squad.byId(id), h.dmg, h.head, 'VOCÊ');
        gameStats.hits++;
        if (h.head) gameStats.headshots++;
        if (res.killed) {
          gameStats.kills++;
          rounds.payKill();
          hudEvents.emit({ type: 'kill', head: h.head });
          hudEvents.emit({ type: 'feed', killer: 'VOCÊ', victim: `DIRAC ${id + 1}` });
        } else {
          hudEvents.emit({ type: 'hit', head: h.head });
        }
        sparks.burst(h.point, null, 0xff8fc4, 10, 2.6);
      });
      for (const s of sparkPts) {
        sparks.burst(s.p, s.n, 0xffe2ad, 7, 4.2);
      }
      for (const e of ends) {
        spawnTracer(start, e);
      }

      muzzleLight.position.copy(start);
      muzzleLight.intensity = 24; // escopeta acende o corredor
      muzzleUntil = nowMs + MUZZLE_MS;
      weapon.onFire(); // recuo pesado + clarão grande + corredera
      // POSTURA segura o corpo: o chute da câmera amortece
      viewPunch = Math.min(viewPunch + (steady ? 0.5 : 1.25), 1.6);

      ammo--;
      gameStats.ammo = ammo;
      gameStats.shots++;
      hudEvents.emit({ type: 'shot' });
      squad.heardShot(camera.position, nowMs);
      if (ammo <= 0) startReload(nowMs);
      return;
    }

    // ---- bala única (STACCATO / LEGATO) ----
    tmpDir
      .copy(fwd)
      .addScaledVector(right, Math.tan(sxDeg * DEG2RAD))
      .addScaledVector(up, -Math.tan(syDeg * DEG2RAD))
      .normalize();

    raycaster.set(camera.position, tmpDir);
    const hits = raycaster.intersectObjects(hitGroup, false);
    const hit = hits.length > 0 ? hits[0] : null;

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
        hudEvents.emit({
          type: 'feed',
          killer: 'VOCÊ',
          victim: `DIRAC ${(ud.botId ?? 0) + 1}`,
        });
      } else {
        hudEvents.emit({ type: 'hit', head: isHead });
      }
      end = hit.point.clone();
      // faíscas de acerto no operador (magenta)
      sparks.burst(hit.point, null, 0xff8fc4, isHead ? 12 : 8, 2.6);
    } else if (hit) {
      end = hit.point.clone();
      // faíscas no cenário, orientadas pela normal da superfície
      if (hit.face) {
        tmpNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
        sparks.burst(hit.point, tmpNormal, 0xffe2ad, 10, 4.2);
      } else {
        sparks.burst(hit.point, null, 0xffe2ad, 10, 4.2);
      }
    } else {
      end = start.clone().addScaledVector(tmpDir, TRACER_LENGTH);
    }

    // tracer
    spawnTracer(start, end);

    muzzleLight.position.copy(start);
    muzzleLight.intensity = 18;
    muzzleUntil = nowMs + MUZZLE_MS;
    weapon.onFire(); // recuo + clarão + cápsula do viewmodel
    viewPunch = Math.min(viewPunch + (steady ? 0.3 : 0.7), 1.5); // chute da câmera

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
    const distA = Math.hypot(x - M.sites.A.x, z - M.sites.A.z);
    const distB = Math.hypot(x - M.sites.B.x, z - M.sites.B.z);
    if (distA <= ROUND.SITE_RADIUS) return 'A';
    if (distB <= ROUND.SITE_RADIUS) return 'B';
    return null;
  };

  // --- loop de jogo ---
  let raf = 0;
  let last = performance.now();
  let stopped = false;
  let prevYaw = lookState.yaw;
  let prevPitch = lookState.pitch;
  let viewPunch = 0; // recuo visual da câmera (sobe e decai)
  let fpsEma = 60; // média móvel de quadros (Etapa 10)
  let nextBeep = 0; // próximo beep do Diapasão plantado (Etapa 11)

  // o subsolo começa a respirar: zumbido ambiente em loop (Etapa 11)
  SFX.ambient(true);
  const loop = () => {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    try {
      const now = performance.now();
      const rawDt = (now - last) / 1000;
      const dt = Math.min(rawDt, 0.05);
      const dtMs = now - last;
      last = now;

      // mira
      camera.rotation.y = lookState.yaw;
      viewPunch *= Math.exp(-dt * 10);
      camera.rotation.x = lookState.pitch + viewPunch * 0.014;

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
        // POSTURA (Etapa 17): cotovelo fincado pesa o passo — o preço da mira
        const step =
          MOVE_SPEED *
          A.speedMul *
          (now < steadyUntil ? TRACOS.POSTURA_MOVE_MUL : 1) *
          dt;
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

      // CADÊNCIA (VIBRATO, Etapa 16): a reafinação devolve vida ao jogador
      if (
        playerVitals.hp > 0 &&
        playerVitals.hp < PLAYER_HP &&
        now < playerVitals.regenUntil
      ) {
        playerVitals.hp = Math.min(
          PLAYER_HP,
          playerVitals.hp + playerVitals.regenPerSec * dt
        );
      }

      // CAMPO DE PROVAS (Etapa 16): dB infinito + respawn do treino
      if (training) {
        roundState.dB = ECONOMY.MAX_DB; // arsenal sempre aberto
        if (respawnAt > 0 && now >= respawnAt) {
          respawnAt = 0;
          camera.position.set(M.spawn[0], EYE_HEIGHT, M.spawn[1]);
          camera.rotation.z = 0; // desfaz o rolê da death-cam
          lookState.yaw = 0;
          lookState.pitch = 0;
          playerVitals.hp = PLAYER_HP;
          // kit do agente e pente cheios: treinar Traços sem esperar rodada
          for (const t of A.tracos) {
            tracoState.uses[t.key] = t.uses;
            tracoState.readyAt[t.key] = 0;
          }
          lastWeapon = roundState.weapon;
          ammo = WEAPONS[lastWeapon].MAG;
          weapon.setWeapon(lastWeapon);
          reloading = false;
          gameStats.reloading = false;
          gameStats.ammo = ammo;
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

      // Etapa 11: o Diapasão plantado canta — beeps que aceleram conforme
      // o fusível derrete (40s → 0: de ~1/s a ~8/s)
      if (roundState.phase === 'live' && roundState.planted) {
        if (now >= nextBeep) {
          const left = Math.max(0, roundState.chargeEndsAt - now);
          SFX.play('charge_beep', 0.55);
          const frac = left / ROUND.CHARGE_MS;
          nextBeep = now + 130 + frac * 880;
        }
      } else {
        nextBeep = 0; // próximo plantio começa cantando na hora
      }

      // operadores DIRAC (apenas na fase de ação)
      squad.update(dt, now, {
        camera,
        targets: coroTargets,
        active: roundState.phase === 'live',
        blocked,
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

      // esquadrão CORO (Etapa 12) — flags vivas dos combatentes primeiro
      playerCombatant.moving = moved;
      playerCombatant.alive = playerAlive;
      allyCombatants.forEach((c, i) => {
        c.moving = allies.info.list[i].walking;
        c.alive = allies.info.list[i].alive;
      });
      diracTargets.forEach((c, i) => {
        c.moving = false;
        c.alive = squad.isAlive(i);
      });
      allies.update(dt, now, {
        camera,
        playerPos: camera.position,
        playerYaw: lookState.yaw,
        playerAlive,
        active: roundState.phase === 'live',
        targets: diracTargets,
        blocked,
        tracer: spawnTracer,
        muzzle: (p) => {
          muzzleLight.position.copy(p);
          muzzleLight.intensity = 10;
          muzzleUntil = now + MUZZLE_MS;
        },
        plantPos: roundState.planted && roundState.plantSite
          ? siteVec[roundState.plantSite]
          : null,
        onAllyShot: (pos, distToPlayer) => {
          // o tiro do aliado ecoa: DIRACs próximos se alertam e o jogador
          // escuta o estrondo distante
          squad.heardShot(pos, now);
          hudEvents.emit({ type: 'botShot', dist: distToPlayer });
        },
        onAllyPlant: (site) => rounds.allyPlant(site), // Etapa 13
      });
      gameStats.alliesAlive = allies.info.alive;
      gameStats.allyMask = allies.info.list.map((l) => (l.alive ? '1' : '0')).join('');

      // minimapa tático (Etapa 13): posições vivas copiadas sem alocar
      const mm = minimapState;
      mm.px = camera.position.x;
      mm.pz = camera.position.z;
      mm.yaw = lookState.yaw;
      for (let i = 0; i < mm.allies.length; i++) {
        const dst = mm.allies[i];
        const src = allies.info.list[i];
        dst.x = src.x;
        dst.z = src.z;
        dst.alive = src.alive;
        dst.show = src.alive;
      }
      for (let i = 0; i < mm.enemies.length; i++) {
        const dst = mm.enemies[i];
        const src = squad.info.list[i];
        dst.x = src.x;
        dst.z = src.z;
        dst.alive = src.hp > 0;
        dst.show = src.pinged;
      }
      mm.planted = roundState.planted ? roundState.plantSite : null;
      mm.carrierIdx = roundState.carrierAlly ?? -1;

      // desfechos 5v5 (Etapa 12): varrida DIRAC = ponto CORO; CORO
      // aniquilado (jogador + aliados) = ponto DIRAC
      if (roundState.phase === 'live' && squad.info.alive === 0) {
        rounds.sweep();
      }
      if (roundState.phase === 'live' && !playerAlive && allies.info.alive === 0) {
        rounds.killPlayer();
      }

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
          hudEvents.emit({ type: 'reloadDone' }); // ferrolho fechou (Etapa 11)
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

      // viewmodel (sway/bob/recuo/recarga) + faíscas
      weapon.update(dt, {
        moving: moved,
        lookDX: lookState.yaw - prevYaw,
        lookDY: lookState.pitch - prevPitch,
        alive: playerAlive,
        reloading,
        reloadK: gameStats.reloadProgress,
        weapon: roundState.weapon,
      });
      prevYaw = lookState.yaw;
      prevPitch = lookState.pitch;
      sparks.update(dt, camera);

      range.update(dt, camera);
      bundle.update(dt, now / 1000);

      // troca de qualidade no meio do jogo (botão GRAF)
      if (settings.quality !== curQuality) {
        curQuality = settings.quality;
        applyQuality();
      }

      // sombras a 20 Hz (imperceptível) em vez de todo frame
      if (renderer.shadowMap.enabled && now >= nextShadowUpdate) {
        renderer.shadowMap.needsUpdate = true;
        nextShadowUpdate = now + 50;
      }

      // render em duas etapas: mundo no alvo escalonado → quad final
      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);
      gameStats.drawCalls = renderer.info.render.calls; // passada da cena
      renderer.setRenderTarget(null);
      renderer.render(blitScene, blitCam);
      gl.endFrameEXP();

      // diagnóstico de desempenho (HUD + __PULSO__)
      if (rawDt > 0) {
        fpsEma += (1 / rawDt - fpsEma) * 0.06;
      }
      gameStats.fps = Math.round(fpsEma);
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
    unsubFeed(); // Etapa 13: placar não escuta mais o feed
    SFX.ambient(false); // o subsolo silencia junto com a partida
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
