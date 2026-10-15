// Parts do cliente (Etapa 15) — a linguagem visual do hub. Tudo em
// tipografia monoespaçada (a identidade terminal do PULSO), vidro escuro
// sobre as splash arts, e animações leves: um driver Animated compartilhado
// por interpolação, zero re-render por frame.
//
// Etapa 21 — o kit de “cliente premium”: tap() (som + vibração em um
// só gesto), MenuButton elástico, Shine (o brilho que varre o botão
// JOGAR) e KenBurns (a arte do hub respirando em zoom lento).
import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CSS } from '../config/constants';
import { settings } from '../core/state';
import { SFX } from '../game/Audio';

export const MONO = 'monospace';

// ------------------------------------------------------------- tap()
// O toque de interface do PULSO: o click de terminal + a vibração leve
// do aparelho — sempre juntos, sempre do mesmo jeito. Taps fortes
// (confirmar operador, entrar em partida) usam impacto médio.
export function tap(strong = false) {
  SFX.play('ui', strong ? 0.8 : 0.45);
  if (!settings.haptics) return;
  Haptics.impactAsync(
    strong ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
  ).catch(() => {});
}

// ------------------------------------------------------------- Equalizer
// Barras de "ressonância" — a assinatura visual do PULSO. Um único driver
// em loop; cada barra interpola keyframes defasados (onda caminhando).
export function Equalizer({
  color = CSS.TEAL,
  bars = 24,
  height = 26,
  width = 180,
  barW = 4,
}: {
  color?: string;
  bars?: number;
  height?: number;
  width?: number;
  barW?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: 1600, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  const heights = [0.25, 0.55, 0.95, 0.4, 0.8, 0.3, 0.65, 1];
  return (
    <View style={[eq.row, { width, height }]}>
      {Array.from({ length: bars }, (_, i) => {
        // fase e amplitude por barra — parece resposta de frequência viva
        const phase = (i * 3) % heights.length;
        const amp = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7));
        const keys = heights.map((_, k) => heights[(phase + k) % heights.length] * amp);
        const vals = [
          keys[0], keys[1], keys[2], keys[3], keys[4], keys[5], keys[6], keys[7], keys[0],
        ].map((v) => Math.max(0.12, Math.min(1, v)));
        const IR = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
        const scale = t.interpolate({ inputRange: IR, outputRange: vals });
        // ancoragem no baseline: translateY = (1−s)·h/2 faz a barra crescer do chão
        const shift = t.interpolate({
          inputRange: IR,
          outputRange: vals.map((v) => ((1 - v) * height) / 2),
        });
        return (
          <Animated.View
            key={i}
            style={{
              width: barW,
              borderRadius: 1,
              backgroundColor: color,
              opacity: 0.35 + 0.65 * Math.abs(Math.sin(i * 0.9 + 1)),
              transform: [{ translateY: shift }, { scaleY: scale }],
              height,
            }}
          />
        );
      })}
    </View>
  );
}

const eq = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

// ------------------------------------------------------------- KenBurns
// A arte de fundo do hub em deriva lenta (zoom + pan sutil em vaivém de
// 32s) — o efeito “Ken Burns” dos lobbies dos shooters grandes: a tela
// nunca está parada, e é de graça (transform nativo, zero re-render).
export function KenBurns({
  children,
  amp = 1,
  style,
}: {
  children: React.ReactNode;
  amp?: number; // 1 = deriva padrão; use menos em telas de texto
  style?: object | Array<object | false | undefined>;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: 32000, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  const scale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.025, 1.025 + 0.07 * amp, 1.025] });
  const x = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-8 * amp, 10 * amp, -8 * amp] });
  const y = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [5 * amp, -6 * amp, 5 * amp] });
  return (
    <Animated.View
      style={[
        { transform: [{ translateX: x }, { translateY: y }, { scale }] },
        Array.isArray(style) ? style.filter(Boolean) : style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ------------------------------------------------------------- Shine
// O brilho diagonal que varre o botão JOGAR a cada ciclo — o “touch de
// aço” dos CTAs de jogo pago. Vai DENTRO do botão (o pai corta com
// overflow:hidden) e não responde a toque.
export function Shine({ period = 2800 }: { period?: number }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(period - 900),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [x, period]);
  const left = x.interpolate({ inputRange: [0, 1], outputRange: [-70, 360] });
  return (
    <View pointerEvents="none" style={sh.cage}>
      {/* translate + rotação no MESMO transform (uma chave transform por
          estilo — duas se sobrescreveriam) */}
      <Animated.View style={[sh.bar, { transform: [{ translateX: left }, { rotate: '18deg' }] }]} />
    </View>
  );
}

const sh = StyleSheet.create({
  cage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', borderRadius: 12 },
  bar: {
    position: 'absolute',
    top: -24,
    bottom: -24,
    left: -14,
    width: 26,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
});

// ------------------------------------------------------------- FadeSlide
// Entrada padrão do hub: aparece deslizando 14px para cima, com atraso.
export function FadeSlide({
  delay = 0,
  children,
  style,
}: {
  delay?: number;
  children: React.ReactNode;
  style?: object | Array<object | false | undefined>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 420,
      delay,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
        Array.isArray(style) ? style.filter(Boolean) : style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ------------------------------------------------------------- Pulsing
// "Respiração" — o botão JOGAR vive (escala 1 ↔ 1.03, laço de 2,1s).
export function Pulsing({ children, style }: { children: React.ReactNode; style?: object }) {
  const s = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(s, { toValue: 1.03, duration: 1050, useNativeDriver: true }),
        Animated.timing(s, { toValue: 1, duration: 1050, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [s]);
  return <Animated.View style={[{ transform: [{ scale: s }] }, style]}>{children}</Animated.View>;
}

// ------------------------------------------------------------- MenuButton
// Botão do hub (AGENTES, ARSENAL, AJUSTES): vidro escuro, glifo, rótulo,
// sub-rótulo e acento na cor do agente quando ativo. Etapa 21: o botão
// AFUNDA no dedo — mola de escala no press, como os hubs dos grandes.
export function MenuButton({
  glyph,
  label,
  sub,
  accent = CSS.TEAL,
  onPress,
  small,
}: {
  glyph: string;
  label: string;
  sub?: string;
  accent?: string;
  onPress: () => void;
  small?: boolean;
}) {
  const s = useRef(new Animated.Value(1)).current;
  const inPress = () =>
    Animated.spring(s, { toValue: 0.962, speed: 46, bounciness: 0, useNativeDriver: true }).start();
  const outPress = () =>
    Animated.spring(s, { toValue: 1, speed: 16, bounciness: 7, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale: s }], width: small ? 132 : 204 }}>
      <Pressable
        style={({ pressed }) => [mb.btn, small && mb.btnSmall, pressed && mb.btnP]}
        onPress={onPress}
        onPressIn={inPress}
        onPressOut={outPress}
      >
        <Text style={[mb.glyph, { color: accent }]}>{glyph}</Text>
        <View style={mb.txt}>
          <Text style={mb.label}>{label}</Text>
          {sub ? <Text style={mb.sub} numberOfLines={1}>{sub}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const mb = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.28)',
    backgroundColor: 'rgba(11,15,20,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  btnSmall: { width: 132, paddingVertical: 6, paddingHorizontal: 9 },
  btnP: { backgroundColor: 'rgba(45,226,198,0.14)', borderColor: 'rgba(45,226,198,0.55)' },
  glyph: { fontFamily: MONO, fontSize: 17, width: 24, textAlign: 'center' },
  txt: { flex: 1, marginLeft: 8 },
  label: { fontFamily: MONO, fontSize: 12, fontWeight: 'bold', letterSpacing: 2.5, color: '#E8F4F8' },
  sub: { fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.5, color: CSS.TEXT_DIM, marginTop: 1 },
});

// ------------------------------------------------------------- ChipRow
// Seletor de segmento (usado nas configurações): um valor ativo por vez.
export function ChipRow({
  options,
  value,
  onPick,
  accent = CSS.TEAL,
}: {
  options: Array<{ key: string; label: string }>;
  value: string;
  onPick: (key: string) => void;
  accent?: string;
}) {
  return (
    <View style={cr.row}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            style={[cr.chip, on && { borderColor: accent, backgroundColor: accent + '26' }]}
            onPress={() => onPick(o.key)}
          >
            <Text style={[cr.txt, on && { color: accent }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const cr = StyleSheet.create({
  row: { flexDirection: 'row' },
  chip: {
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.30)',
    backgroundColor: 'rgba(18,26,34,0.85)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginLeft: 6,
  },
  txt: { fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, color: '#9FB4C2' },
});

// ------------------------------------------------------------- Barra de XP
export function XpBar({ into, need, width = 132 }: { into: number; need: number; width?: DimensionValue }) {
  const pct = Math.max(0, Math.min(1, need > 0 ? into / need : 0));
  return (
    <View style={[xp.track, { width }]}>
      <View style={[xp.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

const xp = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(122,139,153,0.25)',
    overflow: 'hidden',
    marginTop: 3,
  },
  fill: { height: 4, borderRadius: 2, backgroundColor: CSS.TEAL },
});
