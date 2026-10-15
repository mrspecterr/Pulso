import React from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import Game from './src/core/Game';
import Hud from './src/ui/Hud';
import AudioBridge from './src/core/AudioBridge';
import SplashScreen from './src/client/SplashScreen';
import HomeScreen from './src/client/HomeScreen';
import AgentsScreen from './src/client/AgentsScreen';
import ArsenalScreen from './src/client/ArsenalScreen';
import CareerScreen from './src/client/CareerScreen';
import SettingsScreen from './src/client/SettingsScreen';
import MissionsScreen from './src/client/MissionsScreen';
import RankScreen from './src/client/RankScreen';
import MatchLoading from './src/client/MatchLoading';
import { CSS } from './src/config/constants';
import { gameStats, hudEvents, matchStats, roundState, uiState, sessionState } from './src/core/state';
import type { SessionMode } from './src/core/state';
import { loadProfile, recordMatch } from './src/client/profile';
import { SFX } from './src/game/Audio';

/**
 * ErrorBoundary — se qualquer componente quebrar, mostra o erro em texto
 * legível (em vez do crash cego do runtime). Essencial para diagnóstico
 * remoto: o usuário fotografa a tela e o stack chega inteiro.
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // log disponível para ferramentas de diagnóstico do Expo
    console.error('[PULSO]', error?.message, error?.stack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errRoot}>
          <Text style={styles.errTitle}>ALGO QUEBROU NO PULSO</Text>
          <Text style={styles.errMsg}>{this.state.error.message}</Text>
          <ScrollView style={styles.errScroll}>
            <Text style={styles.errStack}>
              {this.state.error.stack?.split('\n').slice(0, 10).join('\n')}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

/**
 * PULSO — FPS tático 5v5 por rodadas (mobile).
 *
 * Etapa 15 — o CLIENTE do jogo: entrada (splash), HUB (home com perfil
 * real, carreira e artes dos operadores), galeria de agentes, ajustes —
 * tudo persistido no perfil do jogador (AsyncStorage). A partida nasce
 * do hub com o operador e o mapa escolhidos.
 *
 * Etapa 20 — ARSENAL & DOSSIÊ: galeria de armas com ficha técnica do
 * motor e o dossiê de carreira do operador (stats, estilo e conquistas).
 *
 * Etapa 21 — NAVEGAÇÃO VIVA: nenhuma tela troca "à seco" — a anterior
 * continua montada enquanto a nova entra por cima em crossfade (com um
 * deslize sutil e a antiga recuando em profundidade). Entrar em partida
 * é fade puro (a montagem do motor 3D já é pesada o suficiente).
 *
 * Etapa 22 — ENTRADA DE PARTIDA: o fade da partida agora esconde um
 * CARTÃO DE ENTRADA (mapa, clima, esquadrão, dicas) que cobre a
 * montagem do motor 3D e sai em crossfade no primeiro quadro
 * renderizado (sinal onReady do Game). O jogador nunca mais vê a tela
 * preta de carga.
 */
type Screen =
  | 'splash'
  | 'home'
  | 'agents'
  | 'arsenal'
  | 'career'
  | 'settings'
  | 'missions'
  | 'rank'
  | 'match';

export default function App() {
  const [screen, setScreen] = React.useState<Screen>('splash');
  // Etapa 21 — transição: a tela anterior fica montada (estática, sem
  // input) enquanto a nova entra por cima; ao fim do crossfade, sai do
  // render. Se o jogador navegar de novo no meio, a troca recomeça do
  // zero sem estados órfãos — cada render só enxerga `prev` + `screen`.
  const [prev, setPrev] = React.useState<Screen | null>(null);
  const nav = React.useRef(new Animated.Value(1)).current;

  // ref espelhando a tela atual: `go` fica estável (o efeito dos eventos
  // do HUD captura uma única instância) e ainda assim enxerga a tela certa
  // mesmo se o jogador navegar duas vezes antes do re-render
  const screenRef = React.useRef<Screen>(screen);
  screenRef.current = screen;

  const go = React.useCallback(
    (next: Screen) => {
      const cur = screenRef.current;
      if (next === cur) return;
      screenRef.current = next;
      setPrev(cur);
      setScreen(next);
      nav.setValue(0);
      Animated.timing(nav, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setPrev(null);
      });
    },
    [nav]
  );
  const [session, setSession] = React.useState<{
    agent: string;
    map: string;
    weather: string;
    mode: SessionMode;
  } | null>(null);
  // Etapa 22 — a entrada de partida: `matchReady` acende no primeiro
  // quadro do motor (onReady do Game); `loadGone` tira o cartão do
  // render quando o crossfade termina
  const [matchReady, setMatchReady] = React.useState(false);
  const [loadGone, setLoadGone] = React.useState(false);

  React.useEffect(() => {
    // trava em paisagem mesmo quando app.json não é aplicável (ex.: Snack)
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    // liga o motor de áudio e carrega o perfil o quanto antes — a splash
    // dá tempo de sobra para ambos
    SFX.init();
    loadProfile();
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
      SFX.ambient(false);
    };
  }, []);

  // eventos do jogo: fim de partida grava a carreira, a patente sazonal
  // (Etapa 19 — com o placar de rodadas na conta do dB) e volta ao HUB.
  // Só partidas de verdade contam — o Campo de Provas (treino) não mexe
  // em carreira nem em patente.
  React.useEffect(() => {
    const off = hudEvents.subscribe((e) => {
      if (e.type === 'matchOver' && sessionState.mode === 'partida') {
        void recordMatch(e.winner, {
          kills: gameStats.kills,
          headshots: gameStats.headshots,
          shots: gameStats.shots,
          hits: gameStats.hits,
          plants: matchStats.plants,
          deaths: matchStats.deaths,
          roundsWon: roundState.scoreCORO,
          roundsLost: roundState.scoreDIRAC,
        });
      }
      if (e.type === 'backToSelect') {
        setSession(null);
        uiState.trainMenuOpen = false; // arsenal do treino fecha junto
        go('home');
      }
    });
    return off;
  }, []);

  const startMatch = (mode: SessionMode) => {
    // o motor lê sessionState (hidratado do perfil e mantido vivo pelas
    // telas do hub); a key força remontar em cima da escolha atual —
    // mapa, clima e agente inclusos (Etapa 17)
    sessionState.mode = mode;
    uiState.trainMenuOpen = false;
    setMatchReady(false); // Etapa 22 — a entrada de partida recomeça
    setLoadGone(false);
    setSession({
      agent: sessionState.agent,
      map: sessionState.map,
      weather: sessionState.weather,
      mode,
    });
    go('match');
  };

  // Interpolações da transição — hubs navegam com deslize + profundidade;
  // partida entra/sai em fade puro (montagem do motor já é pesada).
  const isHeavy = screen === 'match' || prev === 'match';
  const slideIn = nav.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const pushBack = nav.interpolate({ inputRange: [0, 1], outputRange: [1.028, 1] });

  // Etapa 21 — as telas viraram um switch: as duas camadas da transição
  // renderizam por aqui (a de baixo mostra de onde se veio, a de cima
  // para onde se vai)
  const renderScreen = (s: Screen) => {
    switch (s) {
      case 'splash':
        return <SplashScreen onDone={() => go('home')} />;
      case 'home':
        return (
          <HomeScreen
            onPlay={() => startMatch('partida')}
            onTraining={() => startMatch('treino')}
            onAgents={() => go('agents')}
            onArsenal={() => go('arsenal')}
            onCareer={() => go('career')}
            onSettings={() => go('settings')}
            onMissions={() => go('missions')}
            onRank={() => go('rank')}
          />
        );
      case 'agents':
        return <AgentsScreen onBack={() => go('home')} />;
      // Etapa 20 — os dois módulos novos do hub: a galeria de armas e o
      // dossiê de carreira do operador (leitura pura do perfil)
      case 'arsenal':
        return <ArsenalScreen onBack={() => go('home')} />;
      case 'career':
        return <CareerScreen onBack={() => go('home')} />;
      case 'settings':
        return <SettingsScreen onBack={() => go('home')} />;
      case 'missions':
        return <MissionsScreen onBack={() => go('home')} />;
      case 'rank':
        return <RankScreen onBack={() => go('home')} />;
      case 'match':
        return session ? (
          <>
            <Game
              key={`${session.agent}-${session.map}-${session.weather}-${session.mode}`}
              onReady={() => setMatchReady(true)}
            />
            <Hud />
            {/* Etapa 22 — o cartão de entrada cobre a montagem do motor e
                sai em crossfade no primeiro quadro renderizado; guarda de
                8s dentro do MatchLoading cobre falha do GL */}
            {!loadGone && (
              <MatchLoading ready={matchReady} onGone={() => setLoadGone(true)} />
            )}
          </>
        ) : null;
    }
  };

  return (
    <ErrorBoundary>
      <View style={styles.root}>
        {/* Etapa 21 — camada de baixo: a tela de onde se veio, recuada em
            profundidade e muda durante o crossfade; desmonta ao terminar */}
        {prev !== null && (
          <Animated.View
            pointerEvents="none"
            style={[styles.layer, !isHeavy && { transform: [{ scale: pushBack }] }]}
          >
            {renderScreen(prev)}
          </Animated.View>
        )}

        {/* camada de cima: a tela atual — entra em fade (+ deslize nos hubs) */}
        <Animated.View
          style={[
            styles.layer,
            { opacity: nav },
            !isHeavy && { transform: [{ translateY: slideIn }] },
          ]}
        >
          {renderScreen(screen)}
        </Animated.View>

        {/* som + haptics dos eventos do jogo (sempre montado) */}
        <AudioBridge />
        <StatusBar hidden style="light" />
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CSS.BG },
  // Etapa 21 — as duas camadas da transição ocupam a tela inteira; a
  // tela em si (filha da camada) continua flex:1 como sempre foi
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  errRoot: { flex: 1, backgroundColor: CSS.BG, padding: 24, justifyContent: 'center' },
  errTitle: {
    color: CSS.MAGENTA,
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: 10,
  },
  errMsg: { color: '#F2FBFF', fontFamily: 'monospace', fontSize: 13, marginBottom: 10 },
  errScroll: { maxHeight: 200 },
  errStack: { color: CSS.TEXT_DIM, fontFamily: 'monospace', fontSize: 10 },
});
