// Perfil do jogador (Etapa 15) — o que um jogo "real" guarda entre sessões:
// agente/mapa/clima favoritos, configurações e a CARREIRA (partidas,
// vitórias, abates, precisão, melhor partida). Tudo em AsyncStorage; o
// nível/XP é derivado da carreira (nada é comprado, tudo é jogado).
//
// Etapa 17 — PROGRESSÃO: a carreira ganha plantios/quedas/XP-bônus; em
// cima dela rodam as MISSÕES DIÁRIAS (3 por dia, sorteadas pela data —
// reiniciam à meia-noite) e as CONQUISTAS (marcos permanentes). O
// fim de partida alimenta tudo de uma vez (recordMatch) e devolve o
// resumo do que desbloqueou — o MatchOver mostra na hora.
//
// O objeto global `settings` e `sessionState` continuam sendo a fonte viva
// usada pelo motor — este módulo os hidrata ao carregar e os fotografa ao
// salvar. Assim o jogo nunca lê AsyncStorage no loop.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgentId, QualityId } from '../config/constants';
import type { MapId, WeatherId } from '../config/maps';
import { sessionState, settings } from '../core/state';
import {
  applyRanked,
  freshRanked,
  type Ranked,
  type RankedOutcome,
} from './ranked';

export interface Career {
  matches: number; // partidas concluídas
  wins: number; // partidas vencidas
  kills: number; // abates totais
  headshots: number; // headshots totais
  shots: number; // disparos totais (precisão de carreira)
  hits: number; // acertos totais
  bestKills: number; // melhor partida em abates
  plants: number; // plantios do Diapasão (Etapa 17)
  deaths: number; // quedas totais (Etapa 17)
  flawless: number; // vitórias sem cair (Etapa 17)
  bonusXp: number; // XP de missões/conquistas (fora da fórmula base)
}

export interface Profile {
  agent: AgentId;
  map: MapId;
  weather: WeatherId; // Etapa 17: clima favorito
  sens: number;
  quality: QualityId;
  volume: number;
  haptics: boolean;
  career: Career;
  daily: DailyState;
  ranked: Ranked; // Etapa 19: patente sazonal (dB 30..120)
}

// ------------------------------------------------------------- missões diárias
// O dia é local ('YYYY-MM-DD'): à meia-noite as missões viram a próxima
// safra. O sorteio é DETERMINÍSTICO pela data — todo mundo que jogar no
// mesmo dia vê o mesmo conjunto, e o mesmo aparelho nunca sorteia duas
// safas diferentes para o mesmo dia.

export type DailyCounter =
  | 'kills'
  | 'headshots'
  | 'plants'
  | 'wins'
  | 'matches'
  | 'hits'
  | 'shots';

export interface MissionDef {
  id: string;
  label: string;
  counter: DailyCounter;
  target: number;
  xp: number;
}

export const MISSION_POOL: MissionDef[] = [
  { id: 'm_abates', label: 'elimine 12 DIRACs', counter: 'kills', target: 12, xp: 150 },
  { id: 'm_headshots', label: 'acerte 4 headshots', counter: 'headshots', target: 4, xp: 120 },
  { id: 'm_plantas', label: 'plante o Diapasão 3 vezes', counter: 'plants', target: 3, xp: 150 },
  { id: 'm_vitorias', label: 'vença 2 partidas', counter: 'wins', target: 2, xp: 200 },
  { id: 'm_partidas', label: 'jogue 3 partidas', counter: 'matches', target: 3, xp: 100 },
  { id: 'm_acertos', label: 'acerte 40 tiros', counter: 'hits', target: 40, xp: 120 },
  { id: 'm_disparos', label: 'dispare 300 tiros', counter: 'shots', target: 300, xp: 100 },
];

export interface DailyState {
  day: string; // 'YYYY-MM-DD' a que o progresso pertence
  counters: Record<DailyCounter, number>;
  done: string[]; // ids das missões concluídas (XP já pago)
}

export interface MissionView {
  id: string;
  label: string;
  cur: number;
  target: number;
  done: boolean;
  xp: number;
}

function todayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** FNV-1a do dia — semente pequena e estável. */
function daySeed(day: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** As 3 missões do dia — mesmas para qualquer aparelho na mesma data. */
export function missionsForDay(day: string): MissionDef[] {
  let s = daySeed(day) || 1;
  const rnd = () => {
    // LCG mínimo — determinístico e suficiente para 3 escolhas
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const pool = [...MISSION_POOL];
  const out: MissionDef[] = [];
  while (out.length < 3 && pool.length > 0) {
    out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  }
  return out;
}

function freshDaily(day: string): DailyState {
  return {
    day,
    counters: { kills: 0, headshots: 0, plants: 0, wins: 0, matches: 0, hits: 0, shots: 0 },
    done: [],
  };
}

// ------------------------------------------------------------- conquistas
// Marcos permanentes da carreira — o resumo do operador. Progresso linear
// (atual/objetivo) para a tela desenhar barras honestas.

export interface AchievementDef {
  id: string;
  nome: string;
  desc: string;
  goal: number;
  progress: (c: Career) => number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'primeiro_pulso',
    nome: 'PRIMEIRO PULSO',
    desc: 'vença sua primeira partida',
    goal: 1,
    progress: (c) => c.wins,
  },
  {
    id: 'regente',
    nome: 'REGENTE',
    desc: 'vença 10 partidas',
    goal: 10,
    progress: (c) => c.wins,
  },
  {
    id: 'cirurgia',
    nome: 'CIRURGIA',
    desc: 'acerte 25 headshots',
    goal: 25,
    progress: (c) => c.headshots,
  },
  {
    id: 'tracao_fina',
    nome: 'TRAÇÃO FINA',
    desc: '100 headshots na carreira',
    goal: 100,
    progress: (c) => c.headshots,
  },
  {
    id: 'centuriao',
    nome: 'CENTURIÃO',
    desc: 'elimine 100 operadores DIRAC',
    goal: 100,
    progress: (c) => c.kills,
  },
  {
    id: 'legiao',
    nome: 'LEGIÃO',
    desc: 'elimine 500 operadores DIRAC',
    goal: 500,
    progress: (c) => c.kills,
  },
  {
    id: 'mao_de_diapasao',
    nome: 'MÃO DE DIAPASÃO',
    desc: 'plante o Diapasão 10 vezes',
    goal: 10,
    progress: (c) => c.plants,
  },
  {
    id: 'recital',
    nome: 'RECITAL',
    desc: '10 abates numa única partida',
    goal: 10,
    progress: (c) => c.bestKills,
  },
  {
    id: 'inquebravel',
    nome: 'INQUEBRÁVEL',
    desc: 'vença uma partida sem cair',
    goal: 1,
    progress: (c) => c.flawless,
  },
  {
    id: 'veterano',
    nome: 'VETERANO',
    desc: 'jogue 25 partidas',
    goal: 25,
    progress: (c) => c.matches,
  },
];

export interface AchievementView {
  id: string;
  nome: string;
  desc: string;
  cur: number;
  goal: number;
  done: boolean;
}

export function achievementViews(c: Career): AchievementView[] {
  return ACHIEVEMENTS.map((a) => ({
    id: a.id,
    nome: a.nome,
    desc: a.desc,
    cur: Math.min(a.progress(c), a.goal),
    goal: a.goal,
    done: a.progress(c) >= a.goal,
  }));
}

function unlockedIds(c: Career): Set<string> {
  const s = new Set<string>();
  for (const a of ACHIEVEMENTS) if (a.progress(c) >= a.goal) s.add(a.id);
  return s;
}

// ------------------------------------------------------------------ resumo
// O que a última partida desbloqueou — o MatchOver lê logo após o evento
// (recordMatch preenche TUDO de forma síncrona antes do primeiro await).

export interface MatchRewards {
  unlocked: string[]; // nomes das conquistas novas
  missionsDone: string[]; // labels das missões fechadas hoje
  xpGained: number; // XP de missões creditado nesta partida
  ranked: RankedOutcome | null; // Etapa 19: variação de patente (null = treino)
}

let lastRewards: MatchRewards = { unlocked: [], missionsDone: [], xpGained: 0, ranked: null };

export function getLastRewards(): Readonly<MatchRewards> {
  return lastRewards;
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
  plants: 0,
  deaths: 0,
  flawless: 0,
  bonusXp: 0,
};

const DEFAULTS: Profile = {
  agent: 'MUDO',
  map: 'SUBSOLO',
  weather: 'PADRAO',
  sens: 1,
  quality: 'MEDIO',
  volume: 1,
  haptics: true,
  career: { ...EMPTY_CAREER },
  daily: freshDaily(''),
  ranked: freshRanked(),
};

/** perfil em memória — leitura síncrona para as telas do hub */
let profile: Profile = {
  ...DEFAULTS,
  career: { ...EMPTY_CAREER },
  daily: freshDaily(''),
  ranked: freshRanked(),
};

export function getProfile(): Readonly<Profile> {
  return profile;
}

/** As missões de HOJE em forma de tela (progresso vivo). */
export function getDailyMissions(): MissionView[] {
  ensureDay();
  const set = missionsForDay(profile.daily.day);
  return set.map((m) => ({
    id: m.id,
    label: m.label,
    cur: Math.min(profile.daily.counters[m.counter], m.target),
    target: m.target,
    done: profile.daily.done.includes(m.id),
    xp: m.xp,
  }));
}

/** Troca de dia? A safra de missões renasce zerada. */
function ensureDay(): void {
  const today = todayKey();
  if (profile.daily.day !== today) {
    profile.daily = freshDaily(today);
  }
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
        daily: { ...freshDaily(''), ...(saved.daily ?? {}) },
        ranked: { ...freshRanked(), ...(saved.ranked ?? {}) },
      };
    }
  } catch {
    // storage corrompido → começa do zero, sem quebrar a entrada
  }
  // hidrata os globais que o motor e o HUD leem a cada frame
  sessionState.agent = profile.agent;
  sessionState.map = profile.map;
  sessionState.weather = profile.weather;
  settings.sensMultiplier = profile.sens;
  settings.quality = profile.quality;
  settings.volume = profile.volume;
  settings.haptics = profile.haptics;
  ensureDay();
}

/** Fotografa os globais vivos + carreira para o storage. */
export async function saveProfile(): Promise<void> {
  profile.agent = sessionState.agent;
  profile.map = sessionState.map;
  profile.weather = sessionState.weather;
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

/**
 * Registra uma partida encerrada (chamado uma vez por 'matchOver') e
 * alimenta a carreira, as missões diárias, as conquistas e a PATENTE
 * sazonal de uma vez. Tudo que é memória acontece ANTES do primeiro
 * await — o resumo já está pronto quando o MatchOver desenha.
 */
export async function recordMatch(
  winner: 'CORO' | 'DIRAC',
  stats: {
    kills: number;
    headshots: number;
    shots: number;
    hits: number;
    plants: number; // plantios DESTE jogador (Etapa 17)
    deaths: number; // quedas desta partida (Etapa 17)
    roundsWon: number; // placar final (Etapa 19 — patente)
    roundsLost: number;
  }
): Promise<void> {
  const c = profile.career;
  const before = unlockedIds(c);
  ensureDay();

  // --- carreira ---
  c.matches += 1;
  if (winner === 'CORO') c.wins += 1;
  c.kills += stats.kills;
  c.headshots += stats.headshots;
  c.shots += stats.shots;
  c.hits += stats.hits;
  c.plants += stats.plants;
  c.deaths += stats.deaths;
  if (stats.kills > c.bestKills) c.bestKills = stats.kills;
  if (winner === 'CORO' && stats.deaths === 0) c.flawless += 1;

  // --- missões diárias: contadores engolem a partida ---
  const d = profile.daily;
  d.counters.kills += stats.kills;
  d.counters.headshots += stats.headshots;
  d.counters.plants += stats.plants;
  d.counters.wins += winner === 'CORO' ? 1 : 0;
  d.counters.matches += 1;
  d.counters.hits += stats.hits;
  d.counters.shots += stats.shots;

  const missionsDone: string[] = [];
  let xpGained = 0;
  for (const m of missionsForDay(d.day)) {
    if (d.done.includes(m.id)) continue;
    if (d.counters[m.counter] >= m.target) {
      d.done.push(m.id);
      missionsDone.push(m.label);
      xpGained += m.xp;
      c.bonusXp += m.xp;
    }
  }

  // --- patente sazonal (Etapa 19): o dB de combate da temporada ---
  const rankedOutcome = applyRanked(profile.ranked, {
    won: winner === 'CORO',
    roundsWon: stats.roundsWon,
    roundsLost: stats.roundsLost,
    kills: stats.kills,
    deaths: stats.deaths,
  });

  // --- conquistas: o que cruzou a linha AGORA ---
  const after = unlockedIds(c);
  const unlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (after.has(a.id) && !before.has(a.id)) unlocked.push(a.nome);
  }

  lastRewards = { unlocked, missionsDone, xpGained, ranked: rankedOutcome };
  await saveProfile();
}

/** Apaga tudo (o usuário pediu no painel de configurações). */
export async function resetProfile(): Promise<void> {
  profile = {
    ...DEFAULTS,
    career: { ...EMPTY_CAREER },
    daily: freshDaily(''),
    ranked: freshRanked(),
  };
  lastRewards = { unlocked: [], missionsDone: [], xpGained: 0, ranked: null };
  sessionState.agent = profile.agent;
  sessionState.map = profile.map;
  sessionState.weather = profile.weather;
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
// +10. Missões e conquistas creditam bonusXp (Etapa 17). Cada nível custa
// 250×nível de XP acumulado — sobe rápido no começo (efeito "primeiras
// vitórias valem patente") e desacelera depois.

export function careerXp(c: Career): number {
  return c.matches * 100 + c.wins * 150 + c.kills * 5 + c.headshots * 10 + c.bonusXp;
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
