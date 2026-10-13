import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BTN, CSS } from '../config/constants';
import { inputState } from '../core/state';

/**
 * Botão de disparo — APENAS VISUAL (Etapa 10).
 * O toque é detectado pela camada única de input; aqui só refletimos o
 * estado (pressionado = atirando) por polling barato a 100 ms.
 */
export default function FireButton() {
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setPressed(inputState.firing), 100);
    return () => clearInterval(id);
  }, []);

  return (
    <View
      pointerEvents="none"
      style={[styles.btn, pressed ? styles.pressed : styles.idle]}
    >
      <View style={styles.ring} />
      <View style={styles.dot} />
    </View>
  );
}

const S = BTN.FIRE.size;

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: BTN.FIRE.right,
    bottom: BTN.FIRE.bottom,
    width: S,
    height: S,
    borderRadius: S / 2,
    borderWidth: 2,
    borderColor: CSS.TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { backgroundColor: 'rgba(45,226,198,0.14)' },
  pressed: { backgroundColor: 'rgba(45,226,198,0.45)', transform: [{ scale: 0.93 }] },
  ring: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: CSS.TEAL,
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CSS.TEAL,
  },
});
