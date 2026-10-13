import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CSS } from '../config/constants';
import { inputState } from '../core/state';

/**
 * Botão de disparo: PRESSIONAR E SEGURAR = fogo automático do LEGATO.
 */
export default function FireButton() {
  return (
    <Pressable
      onPressIn={() => {
        inputState.firing = true;
      }}
      onPressOut={() => {
        inputState.firing = false;
      }}
      style={({ pressed }) => [styles.btn, pressed ? styles.pressed : styles.idle]}
    >
      <View style={styles.ring} />
      <View style={styles.dot} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: 34,
    bottom: 30,
    width: 92,
    height: 92,
    borderRadius: 46,
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
