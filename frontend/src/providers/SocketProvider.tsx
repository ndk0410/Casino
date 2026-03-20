'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/useGameStore';

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket] = useState<Socket>(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8080';
    return io(socketUrl, {
      transports: ['websocket', 'polling'],
    });
  });
  const { setRoom, setMyHand } = useGameStore();

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to socket server');
    });

    socket.on('room_state_update', (state) => {
      setRoom(state);
    });

    socket.on('private_hand', (hand) => {
      setMyHand(hand);
    });

    socket.on('error_message', (msg) => {
      window.alert(msg);
    });

    return () => {
      socket.removeAllListeners('connect');
      socket.removeAllListeners('room_state_update');
      socket.removeAllListeners('private_hand');
      socket.removeAllListeners('error_message');
      socket.disconnect();
    };
  }, [setMyHand, setRoom, socket]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
