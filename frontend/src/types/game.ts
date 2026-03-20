export type GameState = 'LOBBY' | 'BETTING' | 'PLAYING' | 'ENDED';

export interface Card {
  id: string;
  rank: string;
  suit: string;
  value: number;
  displayName: string;
  imagePath: string;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  isReady: boolean;
  chips: number;
  handCount?: number;
}

export interface EngineState {
  currentPlayerId: string | null;
  lastPlayedCards: Card[];
  lastPlayedBy: string | null;
  passedPlayers: string[];
  isNewRound: boolean;
  mustPlay3Spade: boolean;
  handsCount: Record<string, number>;
  gameOver: boolean;
  winner: string | null;
  bets: Record<string, number>;
}

export interface RoomState {
  roomId: string | null;
  players: Player[];
  gameState: GameState;
  engineState: EngineState | null;
}

export interface UserAccount {
  id: string;
  name: string;
  chips: number;
}
