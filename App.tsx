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
import { CSS } from './src/config/constants';
import { gameStats, hudEvents, sessionState } from './src/core/state';
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
type Screen = 'splash' | 'home' | 'agents' | 'settings' | 'match';

export default function App() {
  const [screen, setScreen] = React.useState<Screen>('splash');
  const [session, setSession] = React.useState<{ agent: string; map: string } | null>(null);

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

  // eventos do jogo: fim de partida grava a carreira e volta ao HUB
  // (antes ia direto à seleção de agente — Etapa 8; o hub é a casa agora)
  React.useEffect(() => {
    const off = hudEvents.subscribe((e) => {
      if (e.type === 'matchOver') {
        void recordMatch(e.winner, {
          kills: gameStats.kills,
          headshots: gameStats.headshots,
          shots: gameStats.shots,
          hits: gameStats.hits,
        });
      }
      if (e.type === 'backToSelect') {
        setSession(null);
        setScreen('home');
      }
    });
    return off;
  }, []);

  const startMatch = () => {
    // o motor lê sessionState (hidratado do perfil e mantido vivo pelas
    // telas do hub); a key força remontar em cima da escolha atual
    setSession({ agent: sessionState.agent, map: sessionState.map });
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
            onPlay={startMatch}
            onAgents={() => setScreen('agents')}
            onSettings={() => setScreen('settings')}
          />
        )}

        {screen === 'agents' && <AgentsScreen onBack={() => setScreen('home')} />}

        {screen === 'settings' && <SettingsScreen onBack={() => setScreen('home')} />}

        {screen === 'match' && session && (
          <>
            <Game key={`${session.agent}-${session.map}`} />
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
