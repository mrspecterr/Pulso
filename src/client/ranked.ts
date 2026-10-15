// Ranked (Etapa 19) — a PATENTE sazonal do PULSO. A escala é a própria
// física do jogo: o rating é medido em DECIBÉIS, de 30 (um sussurro) a
// 120 (o limiar da dor — e o nome do jogo). As patentes seguem a gradação
// da dinâmica musical, de pp a fff, coroando em PULSO.
//
// Tudo aqui é puro: dado o estado ranqueado e a partida, calcula o dB
// ganho/perdido e devolve o resumo para o MatchOver desenhar na hora.
// O perfil (profile.ts) é o dono do estado — este módulo só faz conta.
//
// TEMPORADA: a identidade vive aqui (número, nome, fim). Quando uma
// próxima temporada abrir, o profile reseta o rating e guarda o pico.

export interface Ranked {
  rating: number; // dB de combate (30..120)
  peak: number; // maior dB já alcançado na temporada
  wins: number;
  losses: number;
  streak: number; // positivo = sequência de vitórias
  bestStreak: number;
  played: number; // partidas contadas (inclui calibração)
}

/** Partidas de calibração: passos largos para achar a faixa certa. */
export const PLACEMENTS = 3;

/** Início de carreira: MEZZO III — nem silêncio, nem estrondo. */
export const START_RATING = 60;

export const RATING_MIN = 30;
export const RATING_MAX = 120;

// ------------------------------------------------------------- temporadas
export const SEASON = 1;
export const SEASON_NAME = 'RISSONÂNCIA';
export const SEASON_END = '2026-12-31'; // o dia em que a afinação vira

/** Dias até o fim da temporada (0 se já passou — a contagem nunca mente). */
export function seasonDaysLeft(): number {
  const end = new Date(`${SEASON_END}T23:59:59`).getTime();
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

// ------------------------------------------------------------- patentes
// A escada completa, do sussurro ao PULSO. Cada patente cobre 15 dB em
// três divisões (III → II → I, de baixo para cima); PULSO é o topo único
// da escala — exatamente 120 dB, o limiar da dor.

export interface Tier {
  min: number; // dB onde a patente começa
  nome: string;
  glyph: string; // dinâmica musical (pp..fff)
  corCss: string;
}

export const TIERS: Tier[] = [
  { min: 30, nome: 'SILENTE', glyph: 'pp', corCss: '#7A8B99' },
  { min: 45, nome: 'PIANO', glyph: 'p', corCss: '#9FD8E8' },
  { min: 60, nome: 'MEZZO', glyph: 'mp', corCss: '#2DE2C6' },
  { min: 75, nome: 'FORTE', glyph: 'mf', corCss: '#F2C94C' },
  { min: 90, nome: 'FORTISSIMO', glyph: 'f', corCss: '#FF6B4A' },
  { min: 105, nome: 'DIAPASÃO', glyph: 'ff', corCss: '#FF3D8E' },
  { min: 120, nome: 'PULSO', glyph: 'fff', corCss: '#F2FBFF' },
];

/** A patente à qual um dB pertence (a maior cujo piso o alcança). */
export function tierAt(rating: number): Tier {
  let t = TIERS[0];
  for (const tier of TIERS) if (rating >= tier.min) t = tier;
  return t;
}

/** Divisão dentro da patente (III baixa, I alta); PULSO não tem. */
export function divisionAt(rating: number): 'I' | 'II' | 'III' | null {
  if (rating >= RATING_MAX) return null;
  const into = rating - tierAt(rating).min; // 0..14 dentro da patente
  if (into < 5) return 'III';
  if (into < 10) return 'II';
  return 'I';
}

/** Rótulo completo: "MEZZO II", "FORTE I", "PULSO". */
export function tierLabel(rating: number): string {
  const div = divisionAt(rating);
  return div ? `${tierAt(rating).nome} ${div}` : tierAt(rating).nome;
}

/** Progresso (em dB) dentro da patente atual rumo à próxima. */
export function tierProgress(rating: number): { into: number; need: number } {
  if (rating >= RATING_MAX) return { into: 1, need: 1 };
  return { into: rating - tierAt(rating).min, need: 15 };
}

// ------------------------------------------------------------- a conta
// Vitória soma, derrota subtrai — o que muda é O QUANTO:
//   · margem de rodadas (7–0 pesa mais que 7–5);
//   · desempenho individual (abates vs. quedas, teto baixo);
//   · sequência de vitórias (o "embalo" — bônus pequeno e saturável).
// A vitória regular típica vale ~18–22 dB — uma patente (15 dB) a cada
// poucas partidas boas, não uma por partida. A assimetria leve (ganhar
// paga mais do que perder cobra) faz o operador mediano subir devagar —
// afinal, DIRACs também escalam com o placar. Na calibração os passos
// são largos de propósito: três partidas bastam para achar a faixa. O
// piso de 30 dB não deixa ninguém no silêncio absoluto — sempre há
// caminho de volta.

export interface RankedMatch {
  won: boolean;
  roundsWon: number;
  roundsLost: number;
  kills: number;
  deaths: number;
}

/** O resumo que o MatchOver desenha (preenchido ANTES do primeiro await). */
export interface RankedOutcome {
  delta: number; // dB aplicados (já limitado pelo piso/teto)
  ratingBefore: number;
  ratingAfter: number;
  labelBefore: string;
  labelAfter: string;
  corAfter: string; // cor da patente atual p/ o cartão
  promoted: boolean; // subiu de patente
  demoted: boolean; // caiu de patente
  calibrating: boolean; // ainda estava calibrando ao entrar
  placedNow: boolean; // esta partida ENCERROU a calibração
  placementsLeft: number; // 0 quando acabou
}

function clampRating(v: number): number {
  return Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(v)));
}

/**
 * Aplica o resultado da partida no estado ranqueado (muta `r`, como o
 resto do perfil) e devolve o resumo para a tela. Determinístico, sem
 * RNG — mesmo jogo, mesmo dB.
 */
export function applyRanked(r: Ranked, m: RankedMatch): RankedOutcome {
  const ratingBefore = r.rating;
  const labelBefore = tierLabel(ratingBefore);
  const calibrating = r.played < PLACEMENTS;
  const margin = m.roundsWon - m.roundsLost; // vencedor: positivo
  const perf = Math.max(-4, Math.min(8, Math.round((m.kills - m.deaths) * 1.2)));

  let delta: number;
  if (calibrating) {
    // passos largos: a faixa se revela rápido
    delta = m.won ? 36 + Math.min(10, margin) : -(26 + Math.min(6, -margin));
    delta += perf;
  } else if (m.won) {
    const streak = r.streak; // vitórias ANTES desta
    const embalo = streak >= 2 ? Math.min(6, (streak - 1) * 2) : 0;
    const margem = Math.min(6, Math.round(Math.max(0, margin) * 1.2));
    delta = 16 + margem + embalo + Math.max(0, Math.min(4, Math.round((m.kills - m.deaths) * 0.6)));
  } else {
    delta = -(13 + Math.round(Math.min(7, Math.max(0, -margin) * 1.5)));
  }

  // livro-caixa
  r.played += 1;
  if (m.won) {
    r.wins += 1;
    r.streak = r.streak >= 0 ? r.streak + 1 : 1; // derrota quebra a sequência
  } else {
    r.losses += 1;
    r.streak = r.streak <= 0 ? r.streak - 1 : -1;
  }
  if (Math.abs(r.streak) > r.bestStreak) r.bestStreak = Math.abs(r.streak);

  r.rating = clampRating(ratingBefore + delta);
  delta = r.rating - ratingBefore; // o que SOBROU após o piso/teto
  if (r.rating > r.peak) r.peak = r.rating;

  const labelAfter = tierLabel(r.rating);
  const idxBefore = TIERS.findIndex((t) => t.nome === tierAt(ratingBefore).nome);
  const idxAfter = TIERS.findIndex((t) => t.nome === tierAt(r.rating).nome);

  return {
    delta,
    ratingBefore,
    ratingAfter: r.rating,
    labelBefore,
    labelAfter,
    corAfter: tierAt(r.rating).corCss,
    promoted: idxAfter > idxBefore,
    demoted: idxAfter < idxBefore,
    calibrating,
    placedNow: calibrating && r.played === PLACEMENTS,
    placementsLeft: Math.max(0, PLACEMENTS - r.played),
  };
}

/** Estado zerado de temporada (também usado pelo reset do perfil). */
export function freshRanked(): Ranked {
  return {
    rating: START_RATING,
    peak: START_RATING,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    played: 0,
  };
}
