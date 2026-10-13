import React, { useRef } from 'react';
import {
  Animated,
  NativeSyntheticEvent,
  NativeTouchEvent,
  StyleSheet,
  View,
} from 'react-native';
import { CSS, JOY_BASE, JOY_KNOB, JOY_RADIUS } from '../config/constants';
import { inputState } from '../core/state';

// RN já usou number e string p/ identifier em versões diferentes — normaliza.
const tid = (t: { identifier: string | number }) => String(t.identifier);
const DEAD = 8; // zona morta (px)

/**
 * Joystick flutuante: aparece onde o dedo toca na zona esquerda (40%) da
 * tela. Escreve direto no inputState (sem re-render por movimento).
 */
export default function Joystick() {
  const basePos = useRef(new Animated.ValueXY()).current;
  const knobPos = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const finger = useRef<{ id: string; sx: number; sy: number } | null>(null);

  const onStart = (e: NativeSyntheticEvent<NativeTouchEvent>) => {
    if (finger.current) return;
    const t = e.nativeEvent.changedTouches[0];
    if (!t) return;
    finger.current = { id: tid(t), sx: t.pageX, sy: t.pageY };
    basePos.setValue({ x: t.pageX - JOY_BASE / 2, y: t.pageY - JOY_BASE / 2 });
    knobPos.setValue({ x: 0, y: 0 });
    opacity.setValue(1);
  };

  const onMove = (e: NativeSyntheticEvent<NativeTouchEvent>) => {
    const f = finger.current;
    if (!f) return;
    const t = e.nativeEvent.touches.find((x) => tid(x) === f.id);
    if (!t) return;
    let dx = t.pageX - f.sx;
    let dy = t.pageY - f.sy;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      dx = (dx / len) * JOY_RADIUS;
      dy = (dy / len) * JOY_RADIUS;
    }
    knobPos.setValue({ x: dx, y: dy });
    if (len <= DEAD) {
      inputState.moveX = 0;
      inputState.moveZ = 0;
    } else {
      inputState.moveX = dx / JOY_RADIUS;
      inputState.moveZ = -dy / JOY_RADIUS;
    }
  };

  const onEnd = (e: NativeSyntheticEvent<NativeTouchEvent>) => {
    const f = finger.current;
    if (!f) return;
    if (!e.nativeEvent.changedTouches.some((t) => tid(t) === f.id)) return;
    finger.current = null;
    inputState.moveX = 0;
    inputState.moveZ = 0;
    Animated.parallel([
      Animated.timing(knobPos, { toValue: { x: 0, y: 0 }, duration: 120, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View
      pointerEvents="box-only"
      style={styles.zone}
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
      onTouchCancel={onEnd}
    >
      <Animated.View
        style={[styles.baseWrap, { opacity, transform: basePos.getTranslateTransform() }]}
      >
        <View style={styles.base}>
          <Animated.View style={[styles.knob, { transform: knobPos.getTranslateTransform() }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%' },
  baseWrap: { position: 'absolute', left: 0, top: 0, width: JOY_BASE, height: JOY_BASE },
  base: {
    width: JOY_BASE,
    height: JOY_BASE,
    borderRadius: JOY_BASE / 2,
    borderWidth: 2,
    borderColor: 'rgba(45,226,198,0.55)',
    backgroundColor: 'rgba(11,15,20,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    left: (JOY_BASE - JOY_KNOB) / 2,
    top: (JOY_BASE - JOY_KNOB) / 2,
    width: JOY_KNOB,
    height: JOY_KNOB,
    borderRadius: JOY_KNOB / 2,
    borderWidth: 2,
    borderColor: CSS.TEAL,
    backgroundColor: 'rgba(45,226,198,0.30)',
  },
});
