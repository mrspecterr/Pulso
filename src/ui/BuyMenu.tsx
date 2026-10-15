import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CSS, SHIELDS, WEAPONS } from '../config/constants';
import type { WeaponId } from '../config/constants';
import { inputState, playerVitals, roundState, sessionState, uiState } from '../core/state';
import { SFX } from '../game/Audio';

const MONO = 'monospace';

/** arsenal na ordem da loja (Etapa 24: cinco armas, do serviço ao calibre) */
const WEAPON_ORDER: WeaponId[] = ['STACCATO', 'TREMOLANDO', 'GLISSANDO', 'LEGATO', 'FERMATA'];

/**
 * BuyMenu — loja da fase de compra (Etapa 5).
 * Compras aplicam direto no roundState (ponte mutável) e valem para a
 * rodada seguinte / para a partida. No CAMPO DE PROVAS (Etapa 16) a loja
 * abre a qualquer momento pelo botão ARSENAL e o PRONTO apenas a fecha.
 * Etapa 24: cinco armas na lista e os TRAJES numa linha horizontal — a
 * loja continua cabendo na tela deitada sem virar pergaminho.
 */
export default function BuyMenu() {
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);

  const buyWeapon = (id: WeaponId) => {
    const spec = WEAPONS[id];
    if (roundState.weapon === id) return;
    if (spec.price > 0 && roundState.dB < spec.price) return;
    if (spec.price > 0) {
      roundState.dB -= spec.price;
      SFX.play('buy', 0.85); // comprou: caixa registradora (Etapa 11)
    } else {
      SFX.play('ui', 0.6); // troca grátis: clique seco
    }
    roundState.weapon = id;
    refresh();
  };

  const buyShield = (id: number, price: number) => {
    if (roundState.shield === id) return;
    if (roundState.dB < price) return;
    roundState.dB -= price;
    roundState.shield = id;
    playerVitals.shield = id;
    SFX.play(price > 0 ? 'buy' : 'ui', price > 0 ? 0.85 : 0.6);
    refresh();
  };

  const ready = () => {
    SFX.play('ui', 0.8);
    // campo de provas: o botão apenas fecha a loja (não há fase p/ aceitar)
    if (sessionState.mode === 'treino') {
      uiState.trainMenuOpen = false;
      refresh();
      return;
    }
    inputState.readyQueued = true;
  };

  const weaponRow = (id: WeaponId) => {
    const spec = WEAPONS[id];
    const equipped = roundState.weapon === id;
    const canBuy = spec.price === 0 || equipped || roundState.dB >= spec.price;
    return (
      <Pressable
        key={id}
        style={[styles.row, equipped ? styles.rowOn : styles.rowOff]}
        onPress={() => buyWeapon(id)}
        disabled={!canBuy}
      >
        <View>
          <Text style={[styles.rowName, !canBuy && styles.rowDim]}>{spec.name}</Text>
          <Text style={styles.rowDesc}>
            {spec.desc} · dano {spec.DMG_BODY}/{spec.DMG_HEAD}
            {spec.PELLETS > 1 ? ` ×${spec.PELLETS}` : ''}
          </Text>
        </View>
        <Text style={[styles.rowPrice, equipped ? styles.priceOn : canBuy ? styles.priceOk : styles.rowDim]}>
          {equipped ? 'EQUIPADA' : spec.price === 0 ? 'GRÁTIS' : `${spec.price} dB`}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.panel}>
      {/* o conteúdo rola se a tela for baixa — na deitada padrão cabe direto */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.flow}>
        <View style={styles.head}>
          <Text style={styles.title}>COMPRA</Text>
          <Text style={styles.wallet}>{roundState.dB} dB</Text>
        </View>

        <View style={styles.secLabel}>
          <Text style={styles.sec}>ARSENAL</Text>
        </View>
        {WEAPON_ORDER.map(weaponRow)}

        <View style={styles.secLabel}>
          <Text style={styles.sec}>TRAJE REFORÇADO</Text>
        </View>
        <View style={styles.shieldRow}>
          {SHIELDS.map((s) => {
            const active = roundState.shield === s.id;
            const canBuy = s.id === 0 || active || roundState.dB >= s.price;
            return (
              <Pressable
                key={s.id}
                style={[styles.shield, active ? styles.shieldOn : styles.shieldOff, !canBuy && styles.rowDim]}
                onPress={() => buyShield(s.id, s.price)}
                disabled={!canBuy}
              >
                <Text style={[styles.shieldName, active && styles.shieldNameOn]}>
                  {s.id === 0 ? 'SEM' : `+${s.id}`}
                </Text>
                <Text style={[styles.shieldSub, !canBuy && styles.rowDim]}>
                  {active ? 'ATIVO' : s.price === 0 ? '—' : `${s.price} dB`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={({ pressed }) => [styles.ready, pressed && styles.readyP]} onPress={ready}>
          <Text style={styles.readyTxt}>
            {sessionState.mode === 'treino' ? 'FECHAR ARSENAL ✕' : 'PRONTO ▸'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Etapa 24: painel preso ao topo e à base (cabe em QUALQUER altura de
  // tela deitada) — o conteúdo rola só se precisar
  panel: {
    position: 'absolute',
    left: '50%',
    top: 10,
    bottom: 10,
    marginLeft: -215,
    width: 430,
    backgroundColor: 'rgba(9,13,18,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(45,226,198,0.35)',
    padding: 14,
  },
  flow: { paddingBottom: 2 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  title: { fontFamily: MONO, fontSize: 16, fontWeight: 'bold', letterSpacing: 6, color: CSS.TEAL },
  wallet: { fontFamily: MONO, fontSize: 14, fontWeight: 'bold', color: '#F2FBFF' },
  secLabel: { marginTop: 8, marginBottom: 4 },
  sec: { fontFamily: MONO, fontSize: 9, letterSpacing: 3, color: CSS.TEXT_DIM },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 5.5,
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  rowOff: { borderColor: 'rgba(122,139,153,0.25)', backgroundColor: 'rgba(20,27,35,0.6)' },
  rowOn: { borderColor: 'rgba(45,226,198,0.7)', backgroundColor: 'rgba(45,226,198,0.10)' },
  rowName: { fontFamily: MONO, fontSize: 12.5, fontWeight: 'bold', color: '#EAF6F2', letterSpacing: 1 },
  rowDim: { opacity: 0.35 },
  rowDesc: { fontFamily: MONO, fontSize: 9, color: CSS.TEXT_DIM, marginTop: 1 },
  rowPrice: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: '#AFC2CE' },
  priceOk: { color: CSS.TEAL },
  priceOn: { color: CSS.TEAL, fontWeight: 'bold' },

  // trajes: três selos lado a lado (a loja não estica mais pra baixo)
  shieldRow: { flexDirection: 'row', gap: 6 },
  shield: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  shieldOff: { borderColor: 'rgba(122,139,153,0.25)', backgroundColor: 'rgba(20,27,35,0.6)' },
  shieldOn: { borderColor: 'rgba(45,226,198,0.7)', backgroundColor: 'rgba(45,226,198,0.10)' },
  shieldName: { fontFamily: MONO, fontSize: 12, fontWeight: 'bold', color: '#EAF6F2' },
  shieldNameOn: { color: CSS.TEAL },
  shieldSub: { fontFamily: MONO, fontSize: 9, letterSpacing: 1, color: '#AFC2CE', marginTop: 1 },

  ready: {
    marginTop: 10,
    backgroundColor: 'rgba(45,226,198,0.18)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CSS.TEAL,
    paddingVertical: 10,
    alignItems: 'center',
  },
  readyP: { backgroundColor: 'rgba(45,226,198,0.45)' },
  readyTxt: { fontFamily: MONO, fontSize: 14, fontWeight: 'bold', letterSpacing: 4, color: CSS.TEAL },
});
