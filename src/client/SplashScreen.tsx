// SplashScreen (Etapa 15) — a porta do PULSO. A estação vazia na neblina
// teal, o logo respirando, o equalizador vivo e o convite: TOCAR PARA
// ENTRAR. O toque é intencional (dá tempo de carregar o perfil do storage
// enquanto o jogador lê o título).
//
// Etapa 21 — ENTRADA CINEMATOGRÁFICA: um único driver (0→1, 950ms) e cada
// elemento acorda na sua janela — fundo, logo (com peso de assinatura:
// entra maior e assenta), tagline, equalizer, convite, rodapé. Nada
// aparece “de uma vez”: a tela MONTA a si mesma.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { CSS } from '../config/constants';
import { TITLE_BG } from './art';
import { Equalizer, MONO, tap } from './parts';
import { getProfile } from './profile';

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  // entrada em sequência (Etapa 21) — um driver, muitas janelas
  const enter = useRef(new Animated.Value(0)).current;
  // piscar do convite + respiração do logo
  const blink = useRef(new Animated.Value(0.35)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  const out = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const e = Animated.timing(enter, {
      toValue: 1,
      duration: 950,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
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
    e.start();
    a.start();
    b.start();
    return () => {
      e.stop();
      a.stop();
      b.stop();
    };
  }, [enter, blink, breathe]);

  // as janelas da entrada (frações do driver 0→1)
  const inBg = enter.interpolate({ inputRange: [0, 0.42], outputRange: [0, 1] });
  const inLogo = enter.interpolate({ inputRange: [0.1, 0.52], outputRange: [0, 1] });
  const logoSettle = enter.interpolate({ inputRange: [0.1, 0.66], outputRange: [1.14, 1] });
  const inTag = enter.interpolate({ inputRange: [0.34, 0.68], outputRange: [0, 1] });
  const inEq = enter.interpolate({ inputRange: [0.44, 0.78], outputRange: [0, 1] });
  const inTap = enter.interpolate({ inputRange: [0.58, 0.88], outputRange: [0, 1] });
  const inFoot = enter.interpolate({ inputRange: [0.66, 1], outputRange: [0, 1] });

  const go = () => {
    tap(true);
    Animated.timing(out, { toValue: 0, duration: 260, useNativeDriver: true }).start(onDone);
  };

  const p = getProfile();

  return (
    <Animated.View style={[sp.root, { opacity: out }]}>
      {/* o fundo acorda primeiro — deixa o jogador aterrissar na estação */}
      <Animated.View style={[sp.fill, { opacity: inBg }]}>
        <Animated.Image
          source={TITLE_BG}
          style={[sp.bg, { opacity: 0.9, transform: [{ scale: breathe }] }]}
          resizeMode="cover"
        />
      </Animated.View>
      <View style={sp.shade} />

      <View style={sp.center}>
        {/* o logo entra com peso (maior e assenta) e CONTINUA respirando
            dentro — duas camadas: assentada por fora, fôlego por dentro */}
        <Animated.View style={{ opacity: inLogo, transform: [{ scale: logoSettle }] }}>
          <Animated.Text style={[sp.logo, { transform: [{ scale: breathe }] }]}>
            PULSO
          </Animated.Text>
        </Animated.View>
        <Animated.View style={{ opacity: inTag }}>
          <Text style={sp.tag}>FPS TÁTICO DE RESSONÂNCIA</Text>
        </Animated.View>
        <Animated.View style={{ opacity: inEq, marginTop: 14 }}>
          <Equalizer width={210} height={22} />
        </Animated.View>
      </View>

      <Pressable style={sp.touch} onPress={go}>
        <Animated.View style={{ opacity: inTap }}>
          <Animated.Text style={[sp.tap, { opacity: blink }]}>TOCAR PARA ENTRAR</Animated.Text>
        </Animated.View>
      </Pressable>

      <Animated.View style={{ opacity: inFoot }}>
        <Text style={sp.foot}>
          v0.24 · carreira de {p.career.matches} partida{p.career.matches === 1 ? '' : 's'} registrada
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const sp = StyleSheet.create({
  root: { flex: 1, backgroundColor: CSS.BG },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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
