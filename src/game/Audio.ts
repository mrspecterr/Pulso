// Motor de áudio do PULSO (Etapa 11 — Áudio e feedback).
//
// Todo o áudio é procedural (gerado por scripts/gen_sfx.py) e toca por um
// pool de players expo-audio por som — rajadas de LEGATO sobrepõem sem
// cortar o rastro do tiro anterior. Volume mestre segue o botão SOM do HUD
// (100% · 50% · mudo), e o zumbido do subsolo (hum.wav) faz o ambiente.
//
// Nunca lança: qualquer falha de áudio é engolida — o jogo segue mudo,
// nunca quebra.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { settings } from '../core/state';

export type SfxKey =
  | 'fire_staccato'
  | 'fire_legato'
  | 'fire_gli'
  | 'fire_trem'
  | 'fire_fermata'
  | 'bolt'
  | 'pump'
  | 'fire_bot'
  | 'reload_click'
  | 'reload_slam'
  | 'dry'
  | 'hit'
  | 'headshot'
  | 'kill'
  | 'hurt'
  | 'plant_tick'
  | 'planted'
  | 'charge_beep'
  | 'detonate'
  | 'silenced'
  | 'round_win'
  | 'round_lose'
  | 'buy'
  | 'ui'
  | 'traco'
  | 'hum';

const SRC: Record<SfxKey, number> = {
  fire_staccato: require('../../assets/sfx/fire_staccato.wav'),
  fire_legato: require('../../assets/sfx/fire_legato.wav'),
  fire_gli: require('../../assets/sfx/fire_gli.wav'),
  fire_trem: require('../../assets/sfx/fire_trem.wav'),
  fire_fermata: require('../../assets/sfx/fire_fermata.wav'),
  bolt: require('../../assets/sfx/bolt.wav'),
  pump: require('../../assets/sfx/pump.wav'),
  fire_bot: require('../../assets/sfx/fire_bot.wav'),
  reload_click: require('../../assets/sfx/reload_click.wav'),
  reload_slam: require('../../assets/sfx/reload_slam.wav'),
  dry: require('../../assets/sfx/dry.wav'),
  hit: require('../../assets/sfx/hit.wav'),
  headshot: require('../../assets/sfx/headshot.wav'),
  kill: require('../../assets/sfx/kill.wav'),
  hurt: require('../../assets/sfx/hurt.wav'),
  plant_tick: require('../../assets/sfx/plant_tick.wav'),
  planted: require('../../assets/sfx/planted.wav'),
  charge_beep: require('../../assets/sfx/charge_beep.wav'),
  detonate: require('../../assets/sfx/detonate.wav'),
  silenced: require('../../assets/sfx/silenced.wav'),
  round_win: require('../../assets/sfx/round_win.wav'),
  round_lose: require('../../assets/sfx/round_lose.wav'),
  buy: require('../../assets/sfx/buy.wav'),
  ui: require('../../assets/sfx/ui.wav'),
  traco: require('../../assets/sfx/traco.wav'),
  hum: require('../../assets/sfx/hum.wav'),
};

// sons "quentes" ganham pools maiores: sobrepõem a si mesmos sem cortar
const POOL: Partial<Record<SfxKey, number>> = {
  fire_staccato: 4,
  fire_legato: 5,
  fire_gli: 3,
  fire_trem: 6, // 800 rpm: a rajada precisa sobrepor-se sem cortar
  fire_fermata: 2,
  bolt: 2,
  pump: 2,
  fire_bot: 4,
  hit: 3,
  headshot: 3,
  hurt: 3,
  charge_beep: 2,
  plant_tick: 2,
};

const AMBIENT_LEVEL = 0.16; // hum do subsolo bem no fundo

class SfxEngine {
  private pools = new Map<SfxKey, AudioPlayer[]>();
  private cursor = new Map<SfxKey, number>();
  private ambientPlayer: AudioPlayer | null = null;
  private ambientOn = false;
  ready = false;

  /** Chamado uma vez (App montando): cria os players e o modo de áudio. */
  async init() {
    if (this.ready) return;
    this.ready = true;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers', // SFX de jogo: não rouba o foco de outros apps
        allowsRecording: false,
        shouldPlayInBackground: false,
      });
    } catch {
      // sem modo de áudio o som ainda toca na maioria dos aparelhos
    }
    for (const key of Object.keys(SRC) as SfxKey[]) {
      try {
        const size = POOL[key] ?? 2;
        const pool: AudioPlayer[] = [];
        for (let i = 0; i < size; i++) {
          pool.push(createAudioPlayer(SRC[key]));
        }
        this.pools.set(key, pool);
      } catch {
        // falhou criar este som: o resto segue
      }
    }
  }

  /** Toca um som. `vol` 0..1 relativo ao mestre; `rate` varia o timbre. */
  play(key: SfxKey, vol = 1, rate = 1) {
    if (settings.volume <= 0) return; // mudo
    const pool = this.pools.get(key);
    if (!pool || pool.length === 0) return;
    try {
      const next = ((this.cursor.get(key) ?? 0) + 1) % pool.length;
      this.cursor.set(key, next);
      const p = pool[next];
      p.volume = Math.max(0, Math.min(1, vol * settings.volume));
      p.playbackRate = rate;
      p.seekTo(0);
      p.play();
    } catch {
      // áudio nunca derruba o jogo
    }
  }

  /** Zumbido do subsolo (loop) — liga quando a partida começa. */
  ambient(on: boolean) {
    this.ambientOn = on;
    try {
      if (on) {
        if (!this.ambientPlayer) {
          this.ambientPlayer = this.pools.get('hum')?.[0] ?? null;
        }
        if (this.ambientPlayer) {
          this.ambientPlayer.loop = true;
          this.ambientPlayer.volume = AMBIENT_LEVEL * settings.volume;
          this.ambientPlayer.play();
        }
      } else if (this.ambientPlayer) {
        this.ambientPlayer.pause();
      }
    } catch {
      // idem
    }
  }

  /** Volume mestre mudou (botão SOM) — o hum acompanha em tempo real. */
  onVolumeChanged() {
    if (this.ambientPlayer && this.ambientOn) {
      try {
        this.ambientPlayer.volume = AMBIENT_LEVEL * settings.volume;
      } catch {
        // idem
      }
    }
  }
}

export const SFX = new SfxEngine();
