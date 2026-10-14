// Camada Única de Entrada (Etapa 10 — multi-touch).
//
// O PROBLEMA (v0.9 e anteriores): joystick, mira, fogo, traços e plantio
// eram componentes React Native separados, cada um querendo seu toque. O
// sistema de "responder" do RN entrega o fluxo de UM gesto a UM componente
// por vez — tocar o botão de tiro com o joystick pressionado roubava (ou
// cancelava) os eventos do outro. Resultado: "só funciona 1 toque por vez".
//
// A SOLUÇÃO (padrão dos FPS mobile reais): UMA View de tela inteira recebe
// TODOS os toques de uma vez. Cada dedo ganha um papel fixo no instante em
// que pisa na tela (joystick / mira / botão), roteado por zona, e os eventos
// de movimento/soltura seguem o papel — nunca mais negociação entre views.
// Os desenhos dos botões são apenas visuais (pointerEvents="none").

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  NativeSyntheticEvent,
  NativeTouchEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  AGENTS,
  BTN,
  BTN_PAD,
  JOY_BASE,
  JOY_RADIUS,
  LEFT_ZONE,
  LOOK_SENSITIVITY,
  PITCH_LIMIT,
  QUALITY_ORDER,
} from '../config/constants';
import type { QualityId, TracoKey } from '../config/constants';
import {
  inputState,
  joyVisual,
  lookState,
  playerVitals,
  roundState,
  sessionState,
  settings,
  tracoState,
} from './state';
import { SFX } from '../game/Audio';

// RN já usou number e string p/ identifier em versões diferentes — normaliza.
const tid = (t: { identifier: string | number }) => String(t.identifier);
const DEAD = 8; // zona morta do joystick (px)

// changedTouches é array no nativo e TouchList no rnw — Array.from cobre os dois
const changed = (e: NativeSyntheticEvent<NativeTouchEvent>): NativeTouchEvent[] =>
  Array.from(
    e.nativeEvent.changedTouches as unknown as ArrayLike<NativeTouchEvent>
  );

type Role =
  | { kind: 'joy'; sx: number; sy: number }
  | { kind: 'look'; x: number; y: number }
  | { kind: 'fire' }
  | { kind: 'plant' }
  | { kind: 'none' };

interface Props {
  /** fase com camada ativa (fora de loja/fim de partida) */
  active: boolean;
}

export default React.memo(function InputLayer({ active }: Props) {
  const roles = useRef(new Map<string, Role>());
  const { width: W, height: H } = useWindowDimensions();

  // --- geometria das zonas (px, âncoras idênticas às dos visuais) ---
  const circle = (
    x: number,
    y: number,
    cx: number,
    cy: number,
    r: number
  ) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;

  const inBtnCircle = (
    x: number,
    y: number,
    b: { right: number; bottom: number; size: number }
  ) => circle(x, y, W - b.right - b.size / 2, H - b.bottom - b.size / 2, b.size / 2 + BTN_PAD);

  const inRect = (
    x: number,
    y: number,
    r: { left: number; top: number; w: number; h: number }
  ) => x >= r.left && x <= r.left + r.w && y >= r.top && y <= r.top + r.h;

  const plantZone = () => ({
    left: W - BTN.PLANT.right - BTN.PLANT.w,
    top: H - BTN.PLANT.bottom - BTN.PLANT.h,
    w: BTN.PLANT.w,
    h: BTN.PLANT.h,
  });

  const tracoZone = (t: { right: number; bottom: number; w: number; h: number }) => ({
    left: W - t.right - t.w,
    top: H - t.bottom - t.h,
    w: t.w,
    h: t.h,
  });

  const inTopBtn = (
    x: number,
    y: number,
    b: { left: number; top: number; w: number; h: number }
  ) => inRect(x, y, { left: b.left, top: b.top, w: b.w, h: b.h });

  // --- disponibilidade dos controles: avaliada NO INSTANTE DO TOQUE ---
  // (nunca no render — o React.memo congelaria o valor de outra fase)
  const combatOn = () => roundState.phase === 'live' || roundState.phase === 'end';
  const plantOn = () =>
    roundState.phase === 'live' &&
    roundState.carrying &&
    roundState.inSite !== null &&
    !roundState.planted &&
    playerVitals.hp > 0;

  const fireTraco = (slot: 0 | 1) => {
    const kit = AGENTS[sessionState.agent].tracos[slot];
    const now = performance.now();
    if (tracoState.uses[kit.key] > 0 && now >= tracoState.readyAt[kit.key]) {
      inputState.tracoQueued = kit.key;
    }
  };

  const cycleSens = () => {
    const order = [1, 1.5, 2];
    const i = order.indexOf(settings.sensMultiplier);
    settings.sensMultiplier = order[(i + 1) % order.length];
  };

  const cycleQuality = () => {
    const i = QUALITY_ORDER.indexOf(settings.quality);
    const next = QUALITY_ORDER[(i + 1) % QUALITY_ORDER.length] as QualityId;
    settings.quality = next;
  };

  // Etapa 11: volume do áudio — 100% → 50% → mudo → 100%
  const cycleVolume = () => {
    const order = [1, 0.5, 0];
    const i = order.indexOf(settings.volume);
    settings.volume = order[(i + 1) % order.length];
    SFX.onVolumeChanged(); // o hum do subsolo acompanha na hora
    if (settings.volume > 0) SFX.play('ui', 0.6); // confirma audível
  };

  // --- atribuição de papel no instante em que o dedo toca ---
  const assign = (t: NativeTouchEvent): Role => {
    const x = t.pageX;
    const y = t.pageY;

    // ajustes de coluna esquerda: verificados ANTES da zona do joystick
    // (retângulos pequenos e fixos — não roubam arrastos comuns)
    if (inTopBtn(x, y, BTN.SENS)) {
      cycleSens();
      return { kind: 'none' };
    }
    if (inTopBtn(x, y, BTN.GRAF)) {
      cycleQuality();
      return { kind: 'none' };
    }
    if (inTopBtn(x, y, BTN.SND)) {
      cycleVolume();
      return { kind: 'none' };
    }

    if (x < W * LEFT_ZONE) {
      // zona esquerda: joystick flutuante (um por vez)
      const hasJoy = [...roles.current.values()].some((r) => r.kind === 'joy');
      if (hasJoy) return { kind: 'none' };
      return { kind: 'joy', sx: x, sy: y };
    }

    // lado direito: botões primeiro (áreas pequenas), mira por último
    if (combatOn()) {
      if (inBtnCircle(x, y, BTN.FIRE)) return { kind: 'fire' };
      if (plantOn() && inRect(x, y, plantZone())) return { kind: 'plant' };
      if (inBtnCircle(x, y, BTN.RELOAD)) {
        inputState.reloadQueued = true;
        return { kind: 'none' };
      }
      if (inRect(x, y, tracoZone(BTN.TRACO1))) {
        fireTraco(0);
        return { kind: 'none' };
      }
      if (inRect(x, y, tracoZone(BTN.TRACO2))) {
        fireTraco(1);
        return { kind: 'none' };
      }
    }

    // área livre: mira (uma por vez — sem pulos acidentais)
    const hasLook = [...roles.current.values()].some((r) => r.kind === 'look');
    if (hasLook) return { kind: 'none' };
    return { kind: 'look', x, y };
  };

  const onTouchStart = (e: NativeSyntheticEvent<NativeTouchEvent>) => {
    for (const t of changed(e)) {
      const id = tid(t);
      if (roles.current.has(id)) continue; // seguro contra duplicação
      const role = assign(t);
      roles.current.set(id, role);

      if (role.kind === 'joy') {
        joyVisual.active = true;
        joyVisual.base.setValue({
          x: t.pageX - JOY_BASE / 2,
          y: t.pageY - JOY_BASE / 2,
        });
        joyVisual.knob.setValue({ x: 0, y: 0 });
        joyVisual.opacity.setValue(1);
      } else if (role.kind === 'fire') {
        inputState.firing = true;
      } else if (role.kind === 'plant') {
        inputState.plantHeld = true;
      }
    }
  };

  const onTouchMove = (e: NativeSyntheticEvent<NativeTouchEvent>) => {
    for (const t of changed(e)) {
      const role = roles.current.get(tid(t));
      if (!role) continue;

      if (role.kind === 'joy') {
        let dx = t.pageX - role.sx;
        let dy = t.pageY - role.sy;
        const len = Math.hypot(dx, dy);
        if (len > JOY_RADIUS) {
          dx = (dx / len) * JOY_RADIUS;
          dy = (dy / len) * JOY_RADIUS;
        }
        joyVisual.knob.setValue({ x: dx, y: dy });
        if (len <= DEAD) {
          inputState.moveX = 0;
          inputState.moveZ = 0;
        } else {
          inputState.moveX = dx / JOY_RADIUS;
          inputState.moveZ = -dy / JOY_RADIUS;
        }
      } else if (role.kind === 'look') {
        lookState.yaw -= (t.pageX - role.x) * LOOK_SENSITIVITY * settings.sensMultiplier;
        lookState.pitch -= (t.pageY - role.y) * LOOK_SENSITIVITY * settings.sensMultiplier;
        lookState.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, lookState.pitch));
        role.x = t.pageX;
        role.y = t.pageY;
      }
      // fire/plant/none: papéis "pegajosos" — mover o dedo não muda nada
    }
  };

  const release = (t: NativeTouchEvent) => {
    const id = tid(t);
    const role = roles.current.get(id);
    if (!role) return;
    roles.current.delete(id);

    if (role.kind === 'joy') {
      inputState.moveX = 0;
      inputState.moveZ = 0;
      joyVisual.active = false;
      Animated.parallel([
        Animated.timing(joyVisual.knob, {
          toValue: { x: 0, y: 0 },
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(joyVisual.opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (role.kind === 'fire') {
      inputState.firing = false;
    } else if (role.kind === 'plant') {
      inputState.plantHeld = false;
    }
  };

  const onTouchEnd = (e: NativeSyntheticEvent<NativeTouchEvent>) => {
    for (const t of changed(e)) release(t);
  };

  const onTouchCancel = (e: NativeSyntheticEvent<NativeTouchEvent>) => {
    for (const t of changed(e)) release(t);
  };

  // camada desativada (loja/fim de partida): solta tudo fora do render
  const releaseAll = useCallback(() => {
    for (const role of roles.current.values()) {
      if (role.kind === 'joy') {
        inputState.moveX = 0;
        inputState.moveZ = 0;
        joyVisual.active = false;
        Animated.parallel([
          Animated.timing(joyVisual.knob, {
            toValue: { x: 0, y: 0 },
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(joyVisual.opacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      } else if (role.kind === 'fire') {
        inputState.firing = false;
      } else if (role.kind === 'plant') {
        inputState.plantHeld = false;
      }
    }
    roles.current.clear();
  }, []);

  useEffect(() => {
    if (!active) releaseAll();
  }, [active, releaseAll]);

  if (!active) {
    return <View pointerEvents="none" style={styles.fill} />;
  }

  return (
    <View
      style={styles.fill}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    />
  );
});

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
