'use client';

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/useGameStore';

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const socketRef = useRef<Socket | null>(null);
  const { setRoom, setMyHand } = useGameStore();

  useEffect(() => {
    if (!socketRef.current) {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8080';
      socketRef.current = io(socketUrl);

      socketRef.current.on('connect', () => {
        console.log('Connected to socket server');
      });

      socketRef.current.on('room_state_update', (state) => {
        setRoom(state);
      });

      socketRef.current.on('private_hand', (hand) => {
        setMyHand(hand);
      });

      socketRef.current.on('error', (msg) => {
        alert(msg);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [setRoom, setMyHand]);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
