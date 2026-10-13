import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import Game from './src/core/Game';
import Hud from './src/ui/Hud';
import { CSS } from './src/config/constants';

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
 * Etapa 5: economia em dB, fases de compra/ação, Diapasão plantável e
 * placar de rodadas CORO × DIRAC.
 */
export default function App() {
  React.useEffect(() => {
    // trava em paisagem mesmo quando app.json não é aplicável (ex.: Snack)
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  return (
    <ErrorBoundary>
      <View style={styles.root}>
        <Game />
        <Hud />
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
