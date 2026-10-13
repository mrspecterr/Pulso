import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { CSS } from '../config/constants';
import { hudEvents } from '../core/state';

/**
 * Hitmarker — marca de acerto no centro da mira.
 * hit: X branco rápido · headshot: X dourado · kill: anel teal expansivo.
 */
export default function Hitmarker() {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const off = hudEvents.subscribe((e) => {
      if (e.type !== 'hit' && e.type !== 'kill') return;
      const kill = e.type === 'kill';

      scale.setValue(kill ? 1.5 : 1.1);
      opacity.setValue(1);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: kill ? 350 : 180,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: kill ? 2.0 : 1.35,
          duration: kill ? 350 : 180,
          useNativeDriver: true,
        }),
      ]).start();

      if (kill) {
        ringScale.setValue(0.4);
        ringOpacity.setValue(0.9);
        Animated.parallel([
          Animated.timing(ringOpacity, { toValue: 0, duration: 450, useNativeDriver: true }),
          Animated.timing(ringScale, { toValue: 2.4, duration: 450, useNativeDriver: true }),
        ]).start();
      }
    });
    return off;
  }, [opacity, scale, ringOpacity, ringScale]);

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View
        style={[
          styles.ring,
          { opacity: ringOpacity, transform: [{ scale: ringScale }] },
        ]}
      />
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <View style={[styles.tick, styles.tl]} />
        <View style={[styles.tick, styles.tr]} />
        <View style={[styles.tick, styles.bl]} />
        <View style={[styles.tick, styles.br]} />
      </Animated.View>
    </View>
  );
}

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
  ring: {
    position: 'absolute',
    width: 46,
    height: 46,
    marginLeft: -23,
    marginTop: -23,
    borderRadius: 23,
    borderWidth: 2.5,
    borderColor: CSS.TEAL,
  },
  tick: { position: 'absolute', width: 2.5, height: 10, borderRadius: 1.25, backgroundColor: '#F2FBFF' },
  tl: { left: -13, top: -13, transform: [{ rotate: '-45deg' }] },
  tr: { left: 10, top: -13, transform: [{ rotate: '45deg' }] },
  bl: { left: -13, top: 3, transform: [{ rotate: '45deg' }] },
  br: { left: 10, top: 3, transform: [{ rotate: '-45deg' }] },
});
