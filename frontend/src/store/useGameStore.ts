import { create } from 'zustand';
import { RoomState, UserAccount, Card } from '../types/game';

interface GameStore {
  user: UserAccount | null;
  room: RoomState;
  myHand: Card[];
  
  // Actions
  setUser: (user: UserAccount) => void;
  setRoom: (room: Partial<RoomState>) => void;
  setMyHand: (hand: Card[]) => void;
  resetRoom: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  user: null,
  room: {
    roomId: null,
    players: [],
    gameState: 'LOBBY',
    engineState: null,
  },
  myHand: [],

  setUser: (user) => set({ user }),
  setRoom: (roomUpdate) => set((state) => ({ 
    room: { ...state.room, ...roomUpdate } 
  })),
  setMyHand: (myHand) => set({ myHand }),
  resetRoom: () => set({
    room: {
      roomId: null,
      players: [],
      gameState: 'LOBBY',
      engineState: null,
    },
    myHand: [],
  }),
}));
