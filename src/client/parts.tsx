// Parts do cliente (Etapa 15) — a linguagem visual do hub. Tudo em
// tipografia monoespaçada (a identidade terminal do PULSO), vidro escuro
// sobre as splash arts, e animações leves: um driver Animated compartilhado
// por interpolação, zero re-render por frame.
import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, Pressable, StyleSheet, Text, View } from 'react-native';
import { CSS } from '../config/constants';

export const MONO = 'monospace';

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
// Botão do hub (AGENTES, BRIEFING, AJUSTES): vidro escuro, glifo, rótulo,
// sub-rótulo e acento na cor do agente quando ativo.
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
  return (
    <Pressable
      style={({ pressed }) => [mb.btn, small && mb.btnSmall, pressed && mb.btnP]}
      onPress={onPress}
    >
      <Text style={[mb.glyph, { color: accent }]}>{glyph}</Text>
      <View style={mb.txt}>
        <Text style={mb.label}>{label}</Text>
        {sub ? <Text style={mb.sub} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

const mb = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 204,
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
