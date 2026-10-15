// MatchLoading (Etapa 22) — a ENTRADA DE PARTIDA. Desde a Etapa 1 o
// apertar JOGAR atravessava a montagem crua do motor 3D (tela preta,
// congelamento); agora o jogador atravessa um cartão de partida de
// verdade — mapa, clima, esquadrão e dicas da estação — que cobre a
// montagem e sai em crossfade no PRIMEIRO QUADRO renderizado (sinal
// onReady do Game). Segurança: se o sinal não vier (ex.: painel de
// falha do GL), a tela se retira sozinha aos 8s.
//
// Tudo em driver nativo (useNativeDriver) — o equalizer e o brilho
// continuam vivos mesmo com a thread JS bloqueada construindo a cena.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AGENTS, CSS, ROUND } from '../config/constants';
import { MAPS, WEATHERS } from '../config/maps';
import { sessionState } from '../core/state';
import { TITLE_BG } from './art';
import { Equalizer, FadeSlide, MONO } from './parts';

// Dicas honestas — tudo que está aqui é o que o motor realmente faz
// (a lição da Etapa 20: a interface não promete o que o jogo não paga)
const TIPS = [
  'Andar cancela o plantio — ache um canto seguro antes de segurar PLANTAR.',
  'Inimigos só acendem no minimapa ao atirar, ao levar dano ou sob SONAR.',
  'Perder a rodada custa a arma na mão — às vezes vale poupar pro LEGATO.',
  'Cada ponto DIRAC no placar deixa o inimigo mais afiado — feche cedo.',
  'Abate +200 dB · vitória +2900 · derrota +1900 — a economia também atira.',
  'Cair carregando o Diapasão não é o fim: o aliado mais próximo resgata.',
  'NOITE encurta a visão dos DIRACs; NEBLINA corta a percepção deles.',
  'Os TRAÇOS recarregam entre rodadas — gaste sem medo.',
];

export default function MatchLoading({
  ready,
  onGone,
}: {
  ready: boolean;
  onGone: () => void;
}) {
  const out = useRef(new Animated.Value(1)).current;
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));

  // dicas rotativas — a espera nunca é muda
  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 2800);
    return () => clearInterval(id);
  }, []);

  // a saída: primeiro quadro do motor (ou 8s de segurança, o que vier
  // primeiro — cobre inclusive o painel de falha do GL)
  useEffect(() => {
    if (!ready) {
      const guard = setTimeout(onGone, 8000);
      return () => clearTimeout(guard);
    }
    const a = Animated.timing(out, {
      toValue: 0,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start(({ finished }) => {
      if (finished) onGone();
    });
    return () => a.stop();
  }, [ready, out, onGone]);

  const M = MAPS[sessionState.map];
  const W = WEATHERS[sessionState.weather];
  const A = AGENTS[sessionState.agent];
  const training = sessionState.mode === 'treino';

  return (
    <Animated.View style={[ml.root, { opacity: out }]}>
      {/* a estação ao fundo, tingida pela cor do mapa */}
      <Image source={TITLE_BG} style={ml.bg} resizeMode="cover" />
      <View style={[ml.tint, { backgroundColor: M.corCss + '14' }]} />
      <LinearGradient
        colors={['rgba(6,9,13,0.88)', 'rgba(6,9,13,0.58)', 'rgba(6,9,13,0.92)']}
        style={ml.bg}
      />

      <View style={ml.center}>
        <FadeSlide delay={40}>
          <Text style={ml.kicker}>
            {training ? 'CAMPO DE PROVAS' : 'OPERAÇÃO RISSONÂNCIA'}
          </Text>
        </FadeSlide>

        {/* o lugar */}
        <FadeSlide delay={120}>
          <Text style={[ml.mapName, { color: M.corCss }]}>{M.nome}</Text>
        </FadeSlide>
        <FadeSlide delay={200}>
          <View style={ml.wxRow}>
            <Text style={[ml.wxGlyph, { color: W.corCss }]}>{W.glyph}</Text>
            <Text style={ml.wxName}>{W.nome}</Text>
            <Text style={ml.wxTag} numberOfLines={1}>{W.tagline}</Text>
          </View>
        </FadeSlide>

        <FadeSlide delay={280}>
          <View style={ml.eqWrap}>
            <Equalizer width={250} height={16} barW={3} />
          </View>
        </FadeSlide>

        {/* as pessoas — você e o esquadrão hostil */}
        <FadeSlide delay={360}>
          <View style={ml.vsRow}>
            <View style={ml.side}>
              <View style={[ml.avatar, { borderColor: A.corCss }]}>
                <Text style={[ml.avatarTxt, { color: A.corCss }]}>
                  {sessionState.agent[0]}
                </Text>
              </View>
              <Text style={[ml.sideName, { color: A.corCss }]}>{A.nome}</Text>
              <Text style={ml.sideRole}>{A.funcao}</Text>
            </View>

            <View style={ml.vsCol}>
              <Text style={ml.vsGlyph}>⟷</Text>
              <Text style={ml.vsSub}>
                {training ? 'TREINO' : `5 v 5 · MELHOR DE ${ROUND.ROUNDS_TO_WIN * 2 - 1}`}
              </Text>
            </View>

            <View style={ml.side}>
              <View style={[ml.avatar, { borderColor: CSS.MAGENTA }]}>
                <Text style={[ml.avatarTxt, { color: CSS.MAGENTA }]}>⊗</Text>
              </View>
              <Text style={[ml.sideName, { color: CSS.MAGENTA }]}>DIRAC</Text>
              <Text style={ml.sideRole}>esquadrão hostil</Text>
            </View>
          </View>
        </FadeSlide>
      </View>

      {/* rodapé: a dica que troca + o sintonizador */}
      <View style={ml.foot}>
        <FadeSlide key={tip} delay={0}>
          <View style={ml.footCol}>
            <Text style={ml.tipKey}>DICA DA ESTAÇÃO</Text>
            <Text style={ml.tip} numberOfLines={2}>{TIPS[tip]}</Text>
          </View>
        </FadeSlide>
        <View style={ml.tuneRow}>
          <Equalizer width={90} height={9} barW={2.5} color={CSS.TEXT_DIM} />
          <Text style={ml.tune}>SINTONIZANDO A ESTAÇÃO…</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const ml = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill },
  bg: { position: 'absolute', width: '100%', height: '100%' },
  tint: { position: 'absolute', width: '100%', height: '100%' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kicker: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 6,
    color: CSS.TEXT_DIM,
    marginBottom: 6,
  },
  mapName: {
    fontFamily: MONO,
    fontSize: 34,
    fontWeight: 'bold',
    letterSpacing: 14,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    marginRight: -14, // o letterSpacing come o último espaço
  },
  wxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  wxGlyph: { fontFamily: MONO, fontSize: 13 },
  wxName: { fontFamily: MONO, fontSize: 11, fontWeight: 'bold', letterSpacing: 3, color: '#CFE2EA', marginLeft: 7 },
  wxTag: { fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.5, color: CSS.TEXT_DIM, marginLeft: 8 },
  eqWrap: { marginTop: 12, marginBottom: 14 },

  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 26,
  },
  side: { alignItems: 'center', width: 170 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    backgroundColor: 'rgba(11,15,20,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontFamily: MONO, fontSize: 20, fontWeight: 'bold' },
  sideName: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginTop: 6,
  },
  sideRole: { fontFamily: MONO, fontSize: 7.5, letterSpacing: 2, color: CSS.TEXT_DIM, marginTop: 2 },
  vsCol: { alignItems: 'center' },
  vsGlyph: { fontFamily: MONO, fontSize: 19, color: CSS.TEXT_DIM },
  vsSub: { fontFamily: MONO, fontSize: 7.5, letterSpacing: 2, color: CSS.TEXT_DIM, marginTop: 3 },

  foot: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footCol: { alignItems: 'center' },
  tipKey: { fontFamily: MONO, fontSize: 7, letterSpacing: 3, color: CSS.TEAL, marginBottom: 3 },
  tip: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.5,
    color: '#9FB4C2',
    textAlign: 'center',
    maxWidth: 460,
    lineHeight: 13,
  },
  tuneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  tune: { fontFamily: MONO, fontSize: 7, letterSpacing: 3, color: CSS.TEXT_DIM, marginLeft: 8 },
});
