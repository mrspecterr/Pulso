import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { CSS } from '../config/constants';
import { inputState } from '../core/state';

const MONO = 'monospace';

/**
 * Botão de recarga — pede ao loop de jogo que troque o pente.
 */
export default function ReloadButton() {
  return (
    <Pressable
      onPressIn={() => {
        inputState.reloadQueued = true;
      }}
      style={({ pressed }) => [styles.btn, pressed ? styles.pressed : styles.idle]}
    >
      <Text style={styles.label}>R</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: 142,
    bottom: 38,
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255,61,142,0.85)',
    backgroundColor: 'rgba(255,61,142,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: 'rgba(255,61,142,0.4)' },
  idle: {},
  label: {
    fontFamily: MONO,
    fontSize: 24,
    fontWeight: 'bold',
    color: CSS.MAGENTA,
  },
});
