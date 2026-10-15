import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { CSS } from '../config/constants';

/**
 * ScopeOverlay (Etapa 24) — a luneta da FERMATA.
 *
 * A ótica cobre a tela: um anel de blindagem (border GIGANTE num círculo —
 * em RN a borda cresce pra dentro, então o frame é do tamanho da lente
 * SOMADO às duas bordas; a caixa de conteúdo transparente vira a lente) e o
 * retículo de fio único com estadias abaixo do centro. A mira comum e o
 * viewmodel somem — este retículo É a mira.
 */
export default function ScopeOverlay() {
  const { width: W, height: H } = useWindowDimensions();
  const D = Math.min(W, H) - 4; // lente inscrita na tela
  // blindagem: da borda da lente até o canto mais distante (+ folga)
  const B = Math.hypot(W, H) / 2 - D / 2 + 8;
  const S = D + 2 * B; // frame total (lente + duas bordas)

  return (
    <View pointerEvents="none" style={sc.fill}>
      <View
        style={[
          sc.mask,
          {
            width: S,
            height: S,
            borderRadius: S / 2,
            borderWidth: B,
            marginLeft: -S / 2,
            marginTop: -S / 2,
          },
        ]}
      />
      {/* fio horizontal e vertical (o retículo) */}
      <View style={[sc.hairH, { width: W }]} />
      <View style={[sc.hairV, { height: H }]} />
      {/* estadias: pares de traços abaixo do centro (leitura de distância) */}
      <View style={[sc.stadiaRow, { marginTop: 64 }]}>
        <View style={sc.stadiaL} />
        <View style={sc.stadiaR} />
      </View>
      <View style={[sc.stadiaRow, { marginTop: 108 }]}>
        <View style={sc.stadiaL} />
        <View style={sc.stadiaR} />
      </View>
      {/* ponto de impacto */}
      <View style={sc.dot} />
    </View>
  );
}

const sc = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // círculo centrado por margens negativas (left/top 50%)
  mask: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderColor: 'rgba(3,5,8,0.97)',
    backgroundColor: 'transparent',
  },
  hairH: {
    position: 'absolute',
    top: '50%',
    height: 1,
    marginTop: -0.5,
    backgroundColor: 'rgba(107,247,221,0.75)',
  },
  hairV: {
    position: 'absolute',
    left: '50%',
    width: 1,
    marginLeft: -0.5,
    backgroundColor: 'rgba(107,247,221,0.75)',
  },
  stadiaRow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    flexDirection: 'row',
  },
  stadiaL: { width: 14, height: 1, marginLeft: -34, backgroundColor: 'rgba(107,247,221,0.6)' },
  stadiaR: { width: 14, height: 1, marginLeft: 20, backgroundColor: 'rgba(107,247,221,0.6)' },
  dot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 4,
    height: 4,
    marginTop: -2,
    marginLeft: -2,
    borderRadius: 2,
    backgroundColor: CSS.TEAL,
  },
});
