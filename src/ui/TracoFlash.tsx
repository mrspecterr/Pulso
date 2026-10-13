import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { CSS } from '../config/constants';
import { hudEvents } from '../core/state';

/**
 * TracoFlash — feedback em tela cheia quando um Traço é executado:
 * CENZURA dispara um clarão branco rápido; BARREIRA, um véu teal curto.
 */
export default function TracoFlash() {
  const white = useRef(new Animated.Value(0)).current;
  const teal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const off = hudEvents.subscribe((e) => {
      if (e.type !== 'traco') return;
      const v = e.kind === 'cenzura' ? white : teal;
      v.setValue(1);
      Animated.timing(v, {
        toValue: 0,
        duration: e.kind === 'cenzura' ? 420 : 300,
        useNativeDriver: true,
      }).start();
    });
    return off;
  }, [white, teal]);

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.flash, { opacity: white.interpolate({ inputRange: [0, 1], outputRange: [0, 0.42] }) }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.veil, { opacity: teal.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }) }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flash: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F8FEFF',
  },
  veil: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: CSS.TEAL,
  },
});
