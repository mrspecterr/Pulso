// SplashScreen (Etapa 15) — a porta do PULSO. A estação vazia na neblina
// teal, o logo respirando, o equalizador vivo e o convite: TOCAR PARA
// ENTRAR. O toque é intencional (dá tempo de carregar o perfil do storage
// enquanto o jogador lê o título).
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { CSS } from '../config/constants';
import { TITLE_BG } from './art';
import { Equalizer, MONO } from './parts';
import { SFX } from '../game/Audio';
import { getProfile } from './profile';

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  // piscar do convite + respiração do logo
  const blink = useRef(new Animated.Value(0.35)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  const out = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ])
    );
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.045, duration: 1500, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [blink, breathe]);

  const go = () => {
    SFX.play('ui', 0.8);
    Animated.timing(out, { toValue: 0, duration: 260, useNativeDriver: true }).start(onDone);
  };

  const p = getProfile();

  return (
    <Animated.View style={[sp.root, { opacity: out }]}>
      <Animated.Image source={TITLE_BG} style={[sp.bg, { opacity: 0.9, transform: [{ scale: breathe }] }]} resizeMode="cover" />
      <View style={sp.shade} />

      <View style={sp.center}>
        <Animated.Text style={[sp.logo, { transform: [{ scale: breathe }] }]}>
          PULSO
        </Animated.Text>
        <Text style={sp.tag}>FPS TÁTICO DE RESSONÂNCIA</Text>
        <Equalizer width={210} height={22} />
      </View>

      <Pressable style={sp.touch} onPress={go}>
        <Animated.Text style={[sp.tap, { opacity: blink }]}>TOCAR PARA ENTRAR</Animated.Text>
      </Pressable>

      <Text style={sp.foot}>
        v0.17 · carreira de {p.career.matches} partida{p.career.matches === 1 ? '' : 's'} registrada
      </Text>
    </Animated.View>
  );
}

const sp = StyleSheet.create({
  root: { flex: 1, backgroundColor: CSS.BG },
  bg: { position: 'absolute', width: '100%', height: '100%' },
  shade: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(6,9,13,0.45)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: {
    fontFamily: MONO,
    fontSize: 58,
    fontWeight: 'bold',
    letterSpacing: 22,
    color: CSS.TEAL,
    textShadowColor: 'rgba(45,226,198,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 26,
    // o letterSpacing come o último espaço — compensa visualmente
    marginRight: -22,
  },
  tag: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 7,
    color: '#9FB4C2',
    marginTop: 8,
    marginRight: -7,
  },
  touch: { position: 'absolute', bottom: 64, width: '100%', alignItems: 'center' },
  tap: { fontFamily: MONO, fontSize: 11, letterSpacing: 4, color: '#E8F4F8' },
  foot: {
    position: 'absolute',
    bottom: 14,
    width: '100%',
    textAlign: 'center',
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 2,
    color: CSS.TEXT_DIM,
  },
});
