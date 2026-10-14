// SettingsScreen (Etapa 15) — o painel de configurações do jogo. Cada
// mudança aplica NO OBJETO GLOBAL `settings` na hora (o motor e o HUD leem
// dali a cada frame) e persiste no perfil. Sensibilidade ganha o passo
// BAIXA; vibração agora é interruptor do jogador.
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CSS, QUALITY_ORDER } from '../config/constants';
import { TITLE_BG } from './art';
import { ChipRow, FadeSlide, MONO } from './parts';
import { careerXp, getProfile, levelInfo, rankTitle, resetProfile, saveProfile } from './profile';
import { settings } from '../core/state';
import { SFX } from '../game/Audio';

const SENS_OPTS = [
  { key: '0.7', label: 'BAIXA' },
  { key: '1', label: 'PADRÃO' },
  { key: '1.5', label: 'ALTA' },
  { key: '2', label: 'MÁXIMA' },
];

const VOL_OPTS = [
  { key: '1', label: '100%' },
  { key: '0.5', label: '50%' },
  { key: '0', label: 'MUDO' },
];

const HAPTIC_OPTS = [
  { key: '1', label: 'LIGADA' },
  { key: '0', label: 'DESLIGADA' },
];

export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);

  const p = getProfile();
  const c = p.career;
  const acc = c.shots > 0 ? Math.round((c.hits / c.shots) * 100) : 0;
  const { level } = levelInfo(careerXp(c));

  const setSens = (key: string) => {
    settings.sensMultiplier = Number(key);
    SFX.play('ui', 0.45);
    saveProfile();
    rerender();
  };
  const setQuality = (key: string) => {
    settings.quality = key as typeof settings.quality;
    SFX.play('ui', 0.45);
    saveProfile();
    rerender();
  };
  const setVolume = (key: string) => {
    settings.volume = Number(key);
    SFX.play('ui', 0.45);
    saveProfile();
    rerender();
  };
  const setHaptics = (key: string) => {
    settings.haptics = key === '1';
    SFX.play('ui', 0.45);
    saveProfile();
    rerender();
  };

  const wipe = () => {
    if (!confirmWipe) {
      setConfirmWipe(true); // primeiro toque arma a confirmação
      return;
    }
    resetProfile();
    setConfirmWipe(false);
    rerender();
  };

  return (
    <View style={st.root}>
      <Image source={TITLE_BG} style={st.bg} resizeMode="cover" />
      <View style={st.shade} />

      <View style={st.topRow}>
        <FadeSlide delay={60}>
          <Pressable style={st.back} onPress={() => { SFX.play('ui', 0.45); onBack(); }}>
            <Text style={st.backTxt}>◂ HUB</Text>
          </Pressable>
        </FadeSlide>
        <FadeSlide delay={100}>
          <Text style={st.title}>AJUSTES</Text>
        </FadeSlide>
      </View>

      <FadeSlide delay={180}>
        <View style={st.panel}>
          <Text style={st.panelTitle}>CONTROLES</Text>
          <View style={st.row}>
            <Text style={st.label}>SENSIBILIDADE</Text>
            <ChipRow options={SENS_OPTS} value={String(settings.sensMultiplier)} onPick={setSens} />
          </View>

          <Text style={st.panelTitle}>MÁQUINA</Text>
          <View style={st.row}>
            <Text style={st.label}>GRÁFICOS</Text>
            <ChipRow
              options={QUALITY_ORDER.map((q) => ({ key: q, label: q === 'MEDIO' ? 'MÉDIO' : q === 'NITIDO' ? 'NÍTIDO' : 'FLUIDO' }))}
              value={settings.quality}
              onPick={setQuality}
            />
          </View>

          <Text style={st.panelTitle}>SENSORES</Text>
          <View style={st.row}>
            <Text style={st.label}>ÁUDIO</Text>
            <ChipRow options={VOL_OPTS} value={String(settings.volume)} onPick={setVolume} />
          </View>
          <View style={st.row}>
            <Text style={st.label}>VIBRAÇÃO</Text>
            <ChipRow options={HAPTIC_OPTS} value={settings.haptics ? '1' : '0'} onPick={setHaptics} />
          </View>

          <View style={st.divider} />

          <Text style={st.panelTitle}>CARREIRA</Text>
          <View style={st.careerGrid}>
            <Text style={st.careerItem}>NV {level} · {rankTitle(level)}</Text>
            <Text style={st.careerItem}>{c.matches} partidas</Text>
            <Text style={st.careerItem}>{c.wins} vitórias</Text>
            <Text style={st.careerItem}>{c.kills} abates</Text>
            <Text style={st.careerItem}>{c.headshots} headshots</Text>
            <Text style={st.careerItem}>{c.plants} plantios</Text>
            <Text style={st.careerItem}>{c.shots > 0 ? `${acc}% precisão` : 'sem disparos'}</Text>
          </View>

          <View style={st.divider} />

          <View style={st.row}>
            <Text style={[st.label, { color: '#FF6D9D' }]}>ZERAR DADOS</Text>
            <Pressable
              style={[st.wipe, confirmWipe && st.wipeArmed]}
              onPress={wipe}
            >
              <Text style={st.wipeTxt}>{confirmWipe ? 'TEM CERTEZA? SIM' : 'APAGAR'}</Text>
            </Pressable>
            {confirmWipe && (
              <Pressable style={st.wipeNo} onPress={() => { SFX.play('ui', 0.45); setConfirmWipe(false); }}>
                <Text style={st.wipeNoTxt}>NÃO</Text>
              </Pressable>
            )}
          </View>

          <Text style={st.foot}>PULSO v0.17.0 · github.com/mrspecterr/Pulso</Text>
        </View>
      </FadeSlide>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: CSS.BG },
  bg: { position: 'absolute', width: '100%', height: '100%' },
  shade: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(5,8,12,0.90)',
  },

  topRow: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  back: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.35)',
    backgroundColor: 'rgba(11,15,20,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  backTxt: { fontFamily: MONO, fontSize: 10, letterSpacing: 3, color: '#CFE2EA' },
  title: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 6,
    color: '#E8F4F8',
    marginRight: -6,
  },

  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 56,
    bottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.30)',
    backgroundColor: 'rgba(9,13,18,0.94)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  panelTitle: {
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 4,
    color: CSS.TEAL,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  label: { fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: '#DCEAF2' },

  divider: {
    height: 1,
    backgroundColor: 'rgba(122,139,153,0.18)',
    marginTop: 12,
  },

  careerGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  careerItem: {
    fontFamily: MONO,
    fontSize: 8.5,
    letterSpacing: 1,
    color: '#9FB4C2',
    width: '33%',
    marginTop: 4,
  },

  wipe: {
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,61,142,0.55)',
    backgroundColor: 'rgba(255,61,142,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  wipeArmed: { backgroundColor: 'rgba(255,61,142,0.35)' },
  wipeTxt: { fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: '#FF6D9D' },
  wipeNo: {
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(122,139,153,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 6,
  },
  wipeNoTxt: { fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: '#9FB4C2' },

  foot: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 1,
    color: CSS.TEXT_DIM,
    marginTop: 10,
    textAlign: 'center',
  },
});
