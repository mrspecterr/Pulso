// Arte do cliente (Etapa 15) — splash arts dos operadores CORO e o fundo
// da tela de título. Geradas por IA de arte (direção: hero shooter tático,
// paleta gelo/teal/âmbar sobre subsolo escuro), sem texto queimado — todo
// texto do jogo é tipografia viva do React Native.
import type { ImageSourcePropType } from 'react-native';
import type { AgentId, WeaponId } from '../config/constants';

export const ART: Record<AgentId, ImageSourcePropType> = {
  MUDO: require('../../assets/art/mudo.jpg'),
  ECO: require('../../assets/art/eco.jpg'),
  GRAVE: require('../../assets/art/grave.jpg'),
  VIBRATO: require('../../assets/art/vibrato.jpg'),
};

/** fundo neutro (título, configurações) — estação vazia na neblina teal */
export const TITLE_BG: ImageSourcePropType = require('../../assets/art/title-bg.jpg');

// Etapa 20 — artes do ARSENAL: mesmas direção e paleta das artes dos
// operadores (aço escuro + madeira + anel teal de ressonância), fundo
// escuro à direita para a ficha técnica sobrepor sem perder leitura.
// Limitação conhecida: o modelo de arte insiste na escopeta de canos
// sobrepostos — a GLISSANDO do jogo é de corredera; trocar por arte
// desenhada a mão quando houver.
export const WEAPON_ART: Record<WeaponId, ImageSourcePropType> = {
  STACCATO: require('../../assets/art/arma-staccato.jpg'),
  TREMOLANDO: require('../../assets/art/arma-tremolando.jpg'),
  GLISSANDO: require('../../assets/art/arma-glissando.jpg'),
  LEGATO: require('../../assets/art/arma-legato.jpg'),
  FERMATA: require('../../assets/art/arma-fermata.jpg'),
};

export const TRAJE_ART: ImageSourcePropType = require('../../assets/art/traje.jpg');
