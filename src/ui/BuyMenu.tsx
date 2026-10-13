import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CSS, SHIELDS, WEAPONS } from '../config/constants';
import type { WeaponId } from '../config/constants';
import { inputState, playerVitals, roundState } from '../core/state';

const MONO = 'monospace';

/**
 * BuyMenu — loja da fase de compra (Etapa 5).
 * Compras aplicam direto no roundState (ponte mutável) e valem para a
 * rodada seguinte / para a partida.
 */
export default function BuyMenu() {
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);

  const buyWeapon = (id: WeaponId) => {
    const spec = WEAPONS[id];
    if (roundState.weapon === id) return;
    if (id === 'LEGATO' && roundState.dB < spec.price) return;
    if (id === 'LEGATO') roundState.dB -= spec.price;
    roundState.weapon = id;
    refresh();
  };

  const buyShield = (id: number, price: number) => {
    if (roundState.shield === id) return;
    if (roundState.dB < price) return;
    roundState.dB -= price;
    roundState.shield = id;
    playerVitals.shield = id;
    refresh();
  };

  const ready = () => {
    inputState.readyQueued = true;
  };

  const weaponRow = (id: WeaponId) => {
    const spec = WEAPONS[id];
    const equipped = roundState.weapon === id;
    const canBuy = id === 'STACCATO' || equipped || roundState.dB >= spec.price;
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
      <View style={styles.head}>
        <Text style={styles.title}>COMPRA</Text>
        <Text style={styles.wallet}>{roundState.dB} dB</Text>
      </View>

      <View style={styles.secLabel}>
        <Text style={styles.sec}>ARSENAL</Text>
      </View>
      {weaponRow('STACCATO')}
      {weaponRow('LEGATO')}

      <View style={styles.secLabel}>
        <Text style={styles.sec}>TRAJE REFORÇADO</Text>
      </View>
      {SHIELDS.map((s) => {
        const active = roundState.shield === s.id;
        const canBuy = s.id === 0 || active || roundState.dB >= s.price;
        return (
          <Pressable
            key={s.id}
            style={[styles.row, active ? styles.rowOn : styles.rowOff]}
            onPress={() => buyShield(s.id, s.price)}
            disabled={!canBuy}
          >
            <Text style={[styles.rowName, !canBuy && styles.rowDim]}>
              {s.name}
              {s.id > 0 ? ` +${s.id}` : ''}
            </Text>
            <Text style={[styles.rowPrice, active ? styles.priceOn : canBuy ? styles.priceOk : styles.rowDim]}>
              {active ? 'ATIVO' : s.price === 0 ? '—' : `${s.price} dB`}
            </Text>
          </Pressable>
        );
      })}

      <Pressable style={({ pressed }) => [styles.ready, pressed && styles.readyP]} onPress={ready}>
        <Text style={styles.readyTxt}>PRONTO ▸</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -215,
    marginTop: -130,
    width: 430,
    backgroundColor: 'rgba(9,13,18,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(45,226,198,0.35)',
    padding: 14,
  },
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
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 5,
  },
  rowOff: { borderColor: 'rgba(122,139,153,0.25)', backgroundColor: 'rgba(20,27,35,0.6)' },
  rowOn: { borderColor: 'rgba(45,226,198,0.7)', backgroundColor: 'rgba(45,226,198,0.10)' },
  rowName: { fontFamily: MONO, fontSize: 13, fontWeight: 'bold', color: '#EAF6F2', letterSpacing: 1 },
  rowDim: { opacity: 0.35 },
  rowDesc: { fontFamily: MONO, fontSize: 9, color: CSS.TEXT_DIM, marginTop: 1 },
  rowPrice: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: '#AFC2CE' },
  priceOk: { color: CSS.TEAL },
  priceOn: { color: CSS.TEAL, fontWeight: 'bold' },
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
