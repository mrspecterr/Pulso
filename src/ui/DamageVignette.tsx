import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { hudEvents } from '../core/state';

/**
 * DamageVignette — moldura magenta que pisca quando o jogador leva dano
 * (Etapa 6). Quanto maior o dano, mais forte o flash.
 */
export default function DamageVignette() {
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return hudEvents.subscribe((e) => {
      if (e.type !== 'playerHit') return;
      op.stopAnimation();
      op.setValue(Math.min(0.95, 0.45 + e.dmg / 24));
      Animated.timing(op, {
        toValue: 0,
        duration: 480,
        useNativeDriver: true,
      }).start();
    });
  }, [op]);

  return (
    <Animated.View pointerEvents="none" style={[styles.vignette, { opacity: op }]} />
  );
}

const styles = StyleSheet.create({
  vignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 16,
    borderRadius: 26,
    borderColor: 'rgba(255,61,142,0.85)',
    backgroundColor: 'rgba(255,61,142,0.07)',
  },
});
