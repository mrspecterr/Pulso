// Arte do cliente (Etapa 15) — splash arts dos operadores CORO e o fundo
// da tela de título. Geradas por IA de arte (direção: hero shooter tático,
// paleta gelo/teal/âmbar sobre subsolo escuro), sem texto queimado — todo
// texto do jogo é tipografia viva do React Native.
import type { ImageSourcePropType } from 'react-native';
import type { AgentId } from '../config/constants';

export const ART: Record<AgentId, ImageSourcePropType> = {
  MUDO: require('../../assets/art/mudo.jpg'),
  ECO: require('../../assets/art/eco.jpg'),
  GRAVE: require('../../assets/art/grave.jpg'),
  VIBRATO: require('../../assets/art/vibrato.jpg'),
};

/** fundo neutro (título, configurações) — estação vazia na neblina teal */
export const TITLE_BG: ImageSourcePropType = require('../../assets/art/title-bg.jpg');
