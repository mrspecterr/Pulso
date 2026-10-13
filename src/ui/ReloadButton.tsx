import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { BTN, CSS } from '../config/constants';
import { hudEvents } from '../core/state';

const MONO = 'monospace';

/**
 * Botão de recarga — APENAS VISUAL (Etapa 10).
 * O toque vem da camada única de input; o brilho de confirmação acompanha
 * o evento 'reload' emitido pelo loop do jogo.
 */
export default function ReloadButton() {
  const [flash] = useState(new Animated.Value(0));

  useEffect(
    () =>
      hudEvents.subscribe((e) => {
        if (e.type !== 'reload') return;
        Animated.sequence([
          Animated.timing(flash, { toValue: 1, duration: 70, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true }),
        ]).start();
      }),
    [flash]
  );

  return (
    <View pointerEvents="none" style={styles.btn}>
      <Animated.View style={[styles.glow, { opacity: flash }]} />
      <Text style={styles.label}>R</Text>
    </View>
  );
}

const S = BTN.RELOAD.size;

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: BTN.RELOAD.right,
    bottom: BTN.RELOAD.bottom,
    width: S,
    height: S,
    borderRadius: S / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,61,142,0.85)',
    backgroundColor: 'rgba(255,61,142,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: S / 2,
    backgroundColor: 'rgba(255,61,142,0.4)',
  },
  label: {
    fontFamily: MONO,
    fontSize: 24,
    fontWeight: 'bold',
    color: CSS.MAGENTA,
  },
});
