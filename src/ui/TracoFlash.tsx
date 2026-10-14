import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { CSS, type TracoKey } from '../config/constants';
import { hudEvents } from '../core/state';

/**
 * TracoFlash — feedback em tela cheia quando um Traço é executado.
 * Cada kit tem a sua assinatura visual: CENZURA (clarão branco),
 * BARREIRA/IMPULSO (véu teal), SONAR (véu ciano), COURAÇA (âmbar),
 * ONDA (flash magenta).
 */
const FX: Record<TracoKey, { color: string; peak: number; ms: number }> = {
  cenzura: { color: '#F8FEFF', peak: 0.42, ms: 420 },
  barreira: { color: CSS.TEAL, peak: 0.22, ms: 300 },
  impulso: { color: CSS.TEAL, peak: 0.30, ms: 260 },
  sonar: { color: '#9FD8E8', peak: 0.26, ms: 480 },
  couraca: { color: '#FFB454', peak: 0.28, ms: 420 },
  onda: { color: CSS.MAGENTA, peak: 0.34, ms: 320 },
};

export default function TracoFlash() {
  // a Animated.Value carrega a opacidade real (0 → pico → 0)
  const v = useRef(new Animated.Value(0)).current;
  const [color, setColor] = useState('#F8FEFF');

  useEffect(() => {
    const off = hudEvents.subscribe((e) => {
      if (e.type !== 'traco') return;
      const fx = FX[e.kind];
      if (!fx) return;
      setColor(fx.color);
      v.setValue(fx.peak);
      Animated.timing(v, { toValue: 0, duration: fx.ms, useNativeDriver: true }).start();
    });
    return off;
  }, [v]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.flash, { backgroundColor: color, opacity: v }]}
    />
  );
}

const styles = StyleSheet.create({
  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
