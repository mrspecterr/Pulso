import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { CSS } from '../config/constants';
import { hudEvents } from '../core/state';

/**
 * Mira central. Pulsa a cada disparo (assinando o event-bus do HUD).
 */
export default function Crosshair() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(
    () =>
      hudEvents.subscribe((e) => {
        if (e.type !== 'shot') return;
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.5, duration: 70, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
      }),
    [scale]
  );

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={[styles.cross, { transform: [{ scale }] }]}>
        <View style={[styles.tick, styles.t]} />
        <View style={[styles.tick, styles.b]} />
        <View style={[styles.tick, styles.l]} />
        <View style={[styles.tick, styles.r]} />
        <View style={styles.dot} />
      </Animated.View>
    </View>
  );
}

const S = 40; // tamanho da mira
const T = 10; // comprimento do traço

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cross: { width: S, height: S },
  tick: { position: 'absolute', backgroundColor: CSS.TEAL },
  t: { top: 0, left: (S - 2) / 2, width: 2, height: T },
  b: { bottom: 0, left: (S - 2) / 2, width: 2, height: T },
  l: { left: 0, top: (S - 2) / 2, width: T, height: 2 },
  r: { right: 0, top: (S - 2) / 2, width: T, height: 2 },
  dot: {
    position: 'absolute',
    left: (S - 3) / 2,
    top: (S - 3) / 2,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#EAFFFB',
  },
});
