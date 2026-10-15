// ArsenalScreen (Etapa 20) — a galeria de armas do hub. A arte da arma
// selecionada domina a tela (mesma linguagem dos operadores); à esquerda o
// rail de seleção; sobre a arte, a FICHA TÉCNICA com os números reais do
// motor (constants.ts): dano por salvo, cadência, DPS teórico e quantos
// disparos fecham um DIRAC. Os TRAJES completam o arsenal e a faixa da
// economia explica a conta da rodada — documentado como num jogo de
// verdade, sem tocar uma linha de gameplay.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CSS, ECONOMY, SHIELDS, WEAPONS, type WeaponId } from '../config/constants';
import { TITLE_BG, TRAJE_ART, WEAPON_ART } from './art';
import { FadeSlide, MONO } from './parts';
import { SFX } from '../game/Audio';

type Sel = WeaponId | 'TRAJES';
const ORDER: Sel[] = ['STACCATO', 'GLISSANDO', 'LEGATO', 'TRAJES'];

const AMBER = '#FFD37A';

// ---- números DERIVADOS dos specs reais (nada hardcode que possa mentir) ----
const rpmOf = (id: WeaponId) => Math.round(60000 / WEAPONS[id].CADENCE_MS);
const DPS_MAX = Math.max(
  ...ORDER.filter((w): w is WeaponId => w !== 'TRAJES').map(
    (w) => (WEAPONS[w].DMG_BODY * WEAPONS[w].PELLETS * 1000) / WEAPONS[w].CADENCE_MS
  )
);

function weaponView(id: WeaponId) {
  const W = WEAPONS[id];
  const bodySalvo = W.DMG_BODY * W.PELLETS;
  const headSalvo = W.DMG_HEAD * W.PELLETS;
  return {
    id,
    W,
    rpm: rpmOf(id),
    bodySalvo,
    headSalvo,
    dps: Math.round((bodySalvo * 1000) / W.CADENCE_MS),
    stkBody: Math.ceil(100 / bodySalvo),
    stkHead: Math.ceil(100 / headSalvo),
    unit: W.PELLETS > 1 ? 'salvas' : 'tiros',
    danoPct: bodySalvo / 72,
    cadPct: rpmOf(id) / 600,
    pentePct: W.MAG / 25,
    dpsPct: (bodySalvo * 1000) / W.CADENCE_MS / DPS_MAX,
  };
}
const VIEWS: Record<WeaponId, ReturnType<typeof weaponView>> = {
  STACCATO: weaponView('STACCATO'),
  GLISSANDO: weaponView('GLISSANDO'),
  LEGATO: weaponView('LEGATO'),
};

const NOTA: Record<Sel, string> = {
  STACCATO:
    'de graça toda rodada. Um tiro na cabeça e um no corpo fecham o serviço — poupe os decibéis e compre TRAJE.',
  GLISSANDO:
    'a rainha dos corredores: o salvo cheio fecha 72 no corpo a queima-roupa. O cone abre a partir do terceiro disparo — meça a distância antes de cantar.',
  LEGATO:
    '600 por minuto e headshot letal. Pare de andar para atirar: a mira morta é do GRAVE, a disciplina é sua.',
  TRAJES:
    'o traje absorve o dano ANTES da vida — 25 segura um salvo de GLISSANDO, 50 segura um headshot de STACCATO. Comprar cedo equilibra a economia do esquadrão inteiro.',
};

export default function ArsenalScreen({ onBack }: { onBack: () => void }) {
  const [sel, setSel] = useState<Sel>('LEGATO');
  const isWeapon = sel !== 'TRAJES';

  // crossfade da arte ao trocar de seleção (mesma mecânica dos operadores)
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    const a = Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [sel, fade]);

  const pick = (id: Sel) => {
    if (sel !== id) SFX.play('ui', 0.45);
    setSel(id);
  };

  const v = isWeapon ? VIEWS[sel as WeaponId] : null;

  return (
    <View style={ar.root}>
      {/* base neutra + arte da seleção com crossfade */}
      <Image source={TITLE_BG} style={ar.art} resizeMode="cover" />
      <Animated.View style={[ar.artLayer, { opacity: fade }]}>
        <Image
          source={isWeapon ? WEAPON_ART[sel as WeaponId] : TRAJE_ART}
          style={ar.art}
          resizeMode="cover"
        />
      </Animated.View>
      <LinearGradient
        colors={['rgba(7,10,15,0.97)', 'rgba(7,10,15,0.86)', 'rgba(7,10,15,0.16)']}
        locations={[0, 0.54, 0.92]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={ar.art}
      />
      <LinearGradient
        colors={['rgba(7,10,15,0)', 'rgba(7,10,15,0.88)']}
        locations={[0.68, 1]}
        style={ar.art}
      />

      {/* ---- topo: voltar · título ---- */}
      <View style={ar.topRow}>
        <FadeSlide delay={60}>
          <Pressable style={ar.back} onPress={() => { SFX.play('ui', 0.45); onBack(); }}>
            <Text style={ar.backTxt}>◂ HUB</Text>
          </Pressable>
        </FadeSlide>
        <FadeSlide delay={100}>
          <Text style={ar.title}>ARSENAL CORO</Text>
        </FadeSlide>
      </View>

      {/* ---- esquerda: rail de seleção ---- */}
      <View style={ar.leftCol}>
        <ScrollView contentContainerStyle={ar.leftFlow} showsVerticalScrollIndicator={false}>
          {ORDER.map((id, i) => {
            const active = sel === id;
            const traje = id === 'TRAJES';
            const W = traje ? null : WEAPONS[id as WeaponId];
            const sub = traje
              ? 'blindagem por absorção'
              : W!.price === 0
                ? 'arma de serviço · grátis'
                : `${W!.price} dB · ${W!.desc}`;
            return (
              <FadeSlide key={id} delay={140 + i * 70}>
                <Pressable
                  style={({ pressed }) => [
                    ar.card,
                    active && { borderColor: CSS.TEAL, backgroundColor: 'rgba(24,34,44,0.95)' },
                    pressed && ar.cardP,
                  ]}
                  onPress={() => pick(id)}
                >
                  <View style={[ar.cardGlyphRing, active && { borderColor: CSS.TEAL }]}>
                    <Text style={[ar.cardGlyph, active && { color: CSS.TEAL }]}>
                      {traje ? '⛨' : id[0]}
                    </Text>
                  </View>
                  <View style={ar.cardTxt}>
                    <Text style={[ar.cardNome, active && { color: CSS.TEAL }]}>{id}</Text>
                    <Text style={ar.cardSub} numberOfLines={1}>{sub}</Text>
                  </View>
                  <Text style={[ar.cardOn, { color: active ? CSS.TEAL : CSS.TEXT_DIM }]}>
                    {active ? '◉' : '○'}
                  </Text>
                </Pressable>
              </FadeSlide>
            );
          })}

          {/* a conta da rodada — a economia do jogo documentada */}
          <FadeSlide delay={140 + ORDER.length * 70}>
            <View style={ar.econ}>
              <Text style={ar.econTitle}>A CONTA DA RODADA</Text>
              <Text style={ar.econLine}>
                entrada {ECONOMY.START_DB} · abate +{ECONOMY.KILL_DB} · vitória +{ECONOMY.WIN_DB} · derrota +{ECONOMY.LOSS_DB}
              </Text>
              <Text style={ar.econLine}>
                teto de {ECONOMY.MAX_DB} dB por operador — o que sobra da rodada financia a próxima
              </Text>
            </View>
          </FadeSlide>
        </ScrollView>
      </View>

      {/* ---- direita: a ficha técnica sobre a arte ---- */}
      {v && (
        <View style={ar.panelCol} key={`w-${v.id}`}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ar.panelFlow}>
            <FadeSlide delay={120}>
              <View style={ar.panel}>
                {/* cabeçalho: nome + preço */}
                <View style={ar.headRow}>
                  <View style={ar.headTxt}>
                    <Text style={ar.nome}>{v.W.name}</Text>
                    <Text style={ar.desc}>{v.W.desc}</Text>
                  </View>
                  <View style={[ar.price, v.W.price === 0 && { borderColor: CSS.TEAL }]}>
                    <Text style={[ar.priceTxt, { color: v.W.price === 0 ? CSS.TEAL : AMBER }]}>
                      {v.W.price === 0 ? 'GRÁTIS' : `${v.W.price} dB`}
                    </Text>
                  </View>
                </View>

                {/* números do motor */}
                <View style={ar.sep} />
                <SpecRow label="DANO NO CORPO" value={String(v.bodySalvo)} note={v.W.PELLETS > 1 ? `salvo de ${v.W.PELLETS}×${v.W.DMG_BODY}` : 'por tiro'} />
                <SpecRow label="DANO NA CABEÇA" value={String(v.headSalvo)} note={v.W.PELLETS > 1 ? `salvo de ${v.W.PELLETS}×${v.W.DMG_HEAD}` : 'por tiro'} />
                <SpecRow label="CADÊNCIA" value={`${v.rpm} rpm`} note={`recarga em ${(v.W.RELOAD_MS / 1000).toFixed(1).replace('.', ',')}s`} />
                <SpecRow label="PENTE" value={String(v.W.MAG)} note={v.W.SPREAD_DEG > 0 ? `dispersão ±${String(v.W.SPREAD_DEG).replace('.', ',')}°` : 'projétil único'} />

                <View style={ar.sep} />
                <View style={ar.bigRow}>
                  <View style={ar.bigCell}>
                    <Text style={ar.bigVal}>{v.dps}</Text>
                    <Text style={ar.bigLab}>DPS TEÓRICO</Text>
                  </View>
                  <View style={ar.bigCell}>
                    <Text style={ar.bigVal}>{v.stkBody}</Text>
                    <Text style={ar.bigLab}>{v.unit.toUpperCase()} P/ ABATER</Text>
                  </View>
                  <View style={ar.bigCell}>
                    <Text style={ar.bigVal}>{v.stkHead}</Text>
                    <Text style={ar.bigLab}>{v.unit.toUpperCase()} NA CABEÇA</Text>
                  </View>
                </View>

                {/* barras comparativas (contra o próprio arsenal) */}
                <View style={ar.sep} />
                <StatBar label="DANO" pct={v.danoPct} />
                <StatBar label="CADÊNCIA" pct={v.cadPct} />
                <StatBar label="PENTE" pct={v.pentePct} />

                {/* nota de campo */}
                <View style={[ar.nota, { borderColor: CSS.TEAL + '55' }]}>
                  <Text style={ar.notaTitle}>NOTA DE CAMPO</Text>
                  <Text style={ar.notaTxt}>{NOTA[v.id]}</Text>
                </View>
              </View>
            </FadeSlide>
          </ScrollView>
        </View>
      )}

      {/* ---- direita (modo TRAJES): blindagem ---- */}
      {sel === 'TRAJES' && (
        <View style={ar.panelCol} key="t-TRAJES">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ar.panelFlow}>
            <FadeSlide delay={120}>
              <View style={ar.panel}>
                <View style={ar.headRow}>
                  <View style={ar.headTxt}>
                    <Text style={ar.nome}>TRAJES REFORÇADOS</Text>
                    <Text style={ar.desc}>blindagem de ressonância</Text>
                  </View>
                  <View style={[ar.price, { borderColor: AMBER }]}>
                    <Text style={[ar.priceTxt, { color: AMBER }]}>400–1000 dB</Text>
                  </View>
                </View>

                <View style={ar.sep} />
                {SHIELDS.map((s) => (
                  <View key={s.id} style={ar.shieldRow}>
                    <View style={ar.shieldRing}>
                      <Text style={ar.shieldRingTxt}>{s.id === 0 ? '∅' : s.id}</Text>
                    </View>
                    <View style={ar.shieldTxt}>
                      <Text style={ar.shieldNome}>{s.name}</Text>
                      <Text style={ar.shieldSub}>
                        {s.id === 0
                          ? 'entra leve, depende do ângulo e da sorte'
                          : `absorve ${s.id} de dano antes da vida`}
                      </Text>
                    </View>
                    <Text style={[ar.shieldPrice, { color: s.price === 0 ? CSS.TEAL : AMBER }]}>
                      {s.price === 0 ? 'GRÁTIS' : `${s.price}`}
                    </Text>
                  </View>
                ))}

                <View style={ar.sep} />
                <View style={[ar.nota, { borderColor: AMBER + '55' }]}>
                  <Text style={[ar.notaTitle, { color: AMBER }]}>NOTA DE CAMPO</Text>
                  <Text style={ar.notaTxt}>{NOTA.TRAJES}</Text>
                </View>
              </View>
            </FadeSlide>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ------------------------------------------------------------- peças locais

function SpecRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <View style={sr.row}>
      <Text style={sr.label}>{label}</Text>
      <View style={sr.right}>
        <Text style={sr.value}>{value}</Text>
        <Text style={sr.note}>{note}</Text>
      </View>
    </View>
  );
}

const sr = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3.5 },
  label: { fontFamily: MONO, fontSize: 8.5, letterSpacing: 2, color: CSS.TEXT_DIM },
  right: { alignItems: 'flex-end' },
  value: { fontFamily: MONO, fontSize: 13, fontWeight: 'bold', color: '#E8F4F8' },
  note: { fontFamily: MONO, fontSize: 6.5, letterSpacing: 1, color: CSS.TEXT_DIM, marginTop: 1 },
});

function StatBar({ label, pct }: { label: string; pct: number }) {
  return (
    <View style={sb.row}>
      <Text style={sb.label}>{label}</Text>
      <View style={sb.track}>
        <View style={[sb.fill, { width: `${Math.max(0.04, Math.min(1, pct)) * 100}%` }]} />
      </View>
    </View>
  );
}

const sb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  label: { fontFamily: MONO, fontSize: 8, letterSpacing: 2, color: CSS.TEXT_DIM, width: 76 },
  track: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(122,139,153,0.22)',
    overflow: 'hidden',
  },
  fill: { height: 5, borderRadius: 2.5, backgroundColor: CSS.TEAL },
});

// ------------------------------------------------------------- estilos

const ar = StyleSheet.create({
  root: { flex: 1, backgroundColor: CSS.BG },
  art: { position: 'absolute', width: '100%', height: '100%' },
  artLayer: { position: 'absolute', width: '100%', height: '100%' },

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

  // -- rail esquerdo --
  leftCol: {
    position: 'absolute',
    left: 14,
    top: 56,
    bottom: 12,
    width: 300,
  },
  leftFlow: { paddingBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 236,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(122,139,153,0.30)',
    backgroundColor: 'rgba(11,15,20,0.80)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  cardP: { opacity: 0.85 },
  cardGlyphRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(122,139,153,0.40)',
    backgroundColor: 'rgba(9,13,18,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cardGlyph: { fontFamily: MONO, fontSize: 13, fontWeight: 'bold', color: '#CFE2EA' },
  cardTxt: { flex: 1 },
  cardNome: { fontFamily: MONO, fontSize: 12.5, fontWeight: 'bold', letterSpacing: 2.5, color: '#E8F4F8' },
  cardSub: { fontFamily: MONO, fontSize: 7, letterSpacing: 1.5, color: CSS.TEXT_DIM, marginTop: 1 },
  cardOn: { fontFamily: MONO, fontSize: 10, marginLeft: 6 },

  // -- a conta da rodada --
  econ: {
    width: 236,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,211,122,0.30)',
    backgroundColor: 'rgba(9,13,18,0.88)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 2,
  },
  econTitle: { fontFamily: MONO, fontSize: 8.5, fontWeight: 'bold', letterSpacing: 3, color: AMBER },
  econLine: { fontFamily: MONO, fontSize: 7, letterSpacing: 1, color: '#9FB4C2', lineHeight: 11, marginTop: 3 },

  // -- painel da ficha técnica --
  panelCol: {
    position: 'absolute',
    right: 18,
    top: 52,
    bottom: 12,
    width: 316,
  },
  panelFlow: { paddingBottom: 4 },
  panel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(45,226,198,0.38)',
    backgroundColor: 'rgba(8,12,17,0.90)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headTxt: { flex: 1, marginRight: 8 },
  nome: { fontFamily: MONO, fontSize: 17, fontWeight: 'bold', letterSpacing: 4, color: '#E8F4F8' },
  desc: { fontFamily: MONO, fontSize: 8, letterSpacing: 2, color: CSS.TEXT_DIM, marginTop: 2 },
  price: {
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: AMBER,
    backgroundColor: 'rgba(9,13,18,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priceTxt: { fontFamily: MONO, fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  sep: { height: 1, backgroundColor: 'rgba(122,139,153,0.18)', marginVertical: 7 },

  // -- três números grandes --
  bigRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  bigCell: { alignItems: 'center', flex: 1 },
  bigVal: { fontFamily: MONO, fontSize: 21, fontWeight: 'bold', color: CSS.TEAL },
  bigLab: { fontFamily: MONO, fontSize: 6.5, letterSpacing: 1.5, color: CSS.TEXT_DIM, marginTop: 2 },

  // -- nota de campo --
  nota: {
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: 'rgba(11,18,22,0.85)',
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: 9,
  },
  notaTitle: { fontFamily: MONO, fontSize: 7.5, fontWeight: 'bold', letterSpacing: 3, color: CSS.TEAL },
  notaTxt: { fontFamily: MONO, fontSize: 8.5, color: '#9FB4C2', lineHeight: 13, marginTop: 3 },

  // -- trajes --
  shieldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  shieldRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(255,211,122,0.5)',
    backgroundColor: 'rgba(9,13,18,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  shieldRingTxt: { fontFamily: MONO, fontSize: 12, fontWeight: 'bold', color: AMBER },
  shieldTxt: { flex: 1 },
  shieldNome: { fontFamily: MONO, fontSize: 10.5, fontWeight: 'bold', letterSpacing: 2, color: '#E8F4F8' },
  shieldSub: { fontFamily: MONO, fontSize: 7.5, color: CSS.TEXT_DIM, marginTop: 1 },
  shieldPrice: { fontFamily: MONO, fontSize: 11, fontWeight: 'bold' },
});
