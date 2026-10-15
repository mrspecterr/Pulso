import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import Game from './src/core/Game';
import Hud from './src/ui/Hud';
import AudioBridge from './src/core/AudioBridge';
import SplashScreen from './src/client/SplashScreen';
import HomeScreen from './src/client/HomeScreen';
import AgentsScreen from './src/client/AgentsScreen';
import SettingsScreen from './src/client/SettingsScreen';
import MissionsScreen from './src/client/MissionsScreen';
import RankScreen from './src/client/RankScreen';
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
 */
type Screen = 'splash' | 'home' | 'agents' | 'settings' | 'missions' | 'rank' | 'match';

export default function App() {
  const [screen, setScreen] = React.useState<Screen>('splash');
  const [session, setSession] = React.useState<{
    agent: string;
    map: string;
    weather: string;
    mode: SessionMode;
  } | null>(null);

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
        setScreen('home');
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
    setSession({
      agent: sessionState.agent,
      map: sessionState.map,
      weather: sessionState.weather,
      mode,
    });
    setScreen('match');
  };

  return (
    <ErrorBoundary>
      <View style={styles.root}>
        {screen === 'splash' && (
          <SplashScreen onDone={() => setScreen('home')} />
        )}

        {screen === 'home' && (
          <HomeScreen
            onPlay={() => startMatch('partida')}
            onTraining={() => startMatch('treino')}
            onAgents={() => setScreen('agents')}
            onSettings={() => setScreen('settings')}
            onMissions={() => setScreen('missions')}
            onRank={() => setScreen('rank')}
          />
        )}

        {screen === 'agents' && <AgentsScreen onBack={() => setScreen('home')} />}

        {screen === 'settings' && <SettingsScreen onBack={() => setScreen('home')} />}

        {screen === 'missions' && <MissionsScreen onBack={() => setScreen('home')} />}

        {screen === 'rank' && <RankScreen onBack={() => setScreen('home')} />}

        {screen === 'match' && session && (
          <>
            <Game key={`${session.agent}-${session.map}-${session.weather}-${session.mode}`} />
            <Hud />
          </>
        )}

        {/* som + haptics dos eventos do jogo (sempre montado) */}
        <AudioBridge />
        <StatusBar hidden style="light" />
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CSS.BG },
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
