// Perfil do jogador (Etapa 15) — o que um jogo "real" guarda entre sessões:
// agente e mapa favoritos, configurações e a CARREIRA (partidas, vitórias,
// abates, precisão, melhor partida). Tudo em AsyncStorage; o nível/XP é
// derivado da carreira (nada é comprado, tudo é jogado).
//
// O objeto global `settings` e `sessionState` continuam sendo a fonte viva
// usada pelo motor — este módulo os hidrata ao carregar e os fotografa ao
// salvar. Assim o jogo nunca lê AsyncStorage no loop.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgentId, QualityId } from '../config/constants';
import type { MapId } from '../config/maps';
import { sessionState, settings } from '../core/state';

export interface Career {
  matches: number; // partidas concluídas
  wins: number; // partidas vencidas
  kills: number; // abates totais
  headshots: number; // headshots totais
  shots: number; // disparos totais (precisão de carreira)
  hits: number; // acertos totais
  bestKills: number; // melhor partida em abates
}

export interface Profile {
  agent: AgentId;
  map: MapId;
  sens: number;
  quality: QualityId;
  volume: number;
  haptics: boolean;
  career: Career;
}

const KEY = 'pulso.profile.v1';

const EMPTY_CAREER: Career = {
  matches: 0,
  wins: 0,
  kills: 0,
  headshots: 0,
  shots: 0,
  hits: 0,
  bestKills: 0,
};

const DEFAULTS: Profile = {
  agent: 'MUDO',
  map: 'SUBSOLO',
  sens: 1,
  quality: 'MEDIO',
  volume: 1,
  haptics: true,
  career: { ...EMPTY_CAREER },
};

/** perfil em memória — leitura síncrona para as telas do hub */
let profile: Profile = {
  ...DEFAULTS,
  career: { ...EMPTY_CAREER },
};

export function getProfile(): Readonly<Profile> {
  return profile;
}

/** Carrega do storage (splash dá tempo); hidrata o estado global do jogo. */
export async function loadProfile(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Profile>;
      profile = {
        ...DEFAULTS,
        ...saved,
        career: { ...EMPTY_CAREER, ...(saved.career ?? {}) },
      };
    }
  } catch {
    // storage corrompido → começa do zero, sem quebrar a entrada
  }
  // hidrata os globais que o motor e o HUD leem a cada frame
  sessionState.agent = profile.agent;
  sessionState.map = profile.map;
  settings.sensMultiplier = profile.sens;
  settings.quality = profile.quality;
  settings.volume = profile.volume;
  settings.haptics = profile.haptics;
}

/** Fotografa os globais vivos + carreira para o storage. */
export async function saveProfile(): Promise<void> {
  profile.agent = sessionState.agent;
  profile.map = sessionState.map;
  profile.sens = settings.sensMultiplier;
  profile.quality = settings.quality;
  profile.volume = settings.volume;
  profile.haptics = settings.haptics;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // sem espaço/permissão — o jogo segue, só não persiste
  }
}

/** Registra uma partida encerrada (chamado uma vez por 'matchOver'). */
export async function recordMatch(winner: 'CORO' | 'DIRAC', stats: {
  kills: number;
  headshots: number;
  shots: number;
  hits: number;
}): Promise<void> {
  const c = profile.career;
  c.matches += 1;
  if (winner === 'CORO') c.wins += 1;
  c.kills += stats.kills;
  c.headshots += stats.headshots;
  c.shots += stats.shots;
  c.hits += stats.hits;
  if (stats.kills > c.bestKills) c.bestKills = stats.kills;
  await saveProfile();
}

/** Apaga tudo (o usuário pediu no painel de configurações). */
export async function resetProfile(): Promise<void> {
  profile = { ...DEFAULTS, career: { ...EMPTY_CAREER } };
  sessionState.agent = profile.agent;
  sessionState.map = profile.map;
  settings.sensMultiplier = profile.sens;
  settings.quality = profile.quality;
  settings.volume = profile.volume;
  settings.haptics = profile.haptics;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignora — o próximo save regrava por cima
  }
}

// ---------------------------------------------------------------- nivel/XP
// XP de carreira: cada partida vale 100, vitória +150, abate +5, headshot
// +10. Cada nível custa 250×nível de XP acumulado — sobe rápido no começo
// (efeito "primeiras vitórias valem patente") e desacelera depois.

export function careerXp(c: Career): number {
  return c.matches * 100 + c.wins * 150 + c.kills * 5 + c.headshots * 10;
}

export function levelInfo(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let spent = 0;
  while (xp >= spent + 250 * level && level < 99) {
    spent += 250 * level;
    level += 1;
  }
  return { level, into: xp - spent, need: 250 * level };
}

const RANKS: Array<[min: number, title: string]> = [
  [1, 'RECRUTA'],
  [4, 'SINAL'],
  [7, 'OPERADOR'],
  [10, 'VETERANO'],
  [15, 'MAESTRO'],
  [20, 'LENDA DO SUBSOLO'],
];

export function rankTitle(level: number): string {
  let title = RANKS[0][1];
  for (const [min, t] of RANKS) if (level >= min) title = t;
  return title;
}
