import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { CSS, JOY_BASE, JOY_KNOB } from '../config/constants';
import { joyVisual } from '../core/state';

/**
 * Joystick flutuante — APENAS VISUAL (Etapa 10).
 *
 * A camada única de input (InputLayer) escreve nos valores Animated do
 * módulo `joyVisual` no mesmo instante em que processa o toque; este
 * componente apenas os reproduz. Nenhum manipulador de toque aqui — dois
 * dedos nunca mais disputam o mesmo gesto.
 */
export default function Joystick() {
  return (
    <View pointerEvents="none" style={styles.zone}>
      <Animated.View
        style={[
          styles.baseWrap,
          {
            opacity: joyVisual.opacity,
            transform: joyVisual.base.getTranslateTransform(),
          },
        ]}
      >
        <View style={styles.base}>
          <Animated.View
            style={[styles.knob, { transform: joyVisual.knob.getTranslateTransform() }]}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // a zona cobre a tela toda; o desenho é absoluto e segue o dedo
  zone: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
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
