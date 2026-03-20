---
description: How to deploy and run the Real-Time Multiplayer Casino
---

// turbo-all
1.  **Environment Setup**:
    - Ensure Node.js 18+ and Redis are installed.
    - Check if Redis is running locally: `redis-cli ping`.

2.  **Backend Startup**:
    - Open a terminal in the `backend` folder.
    - Run `npm install` to get the necessary dependencies (Socket.IO, Express, Redis, etc.).
    - Run `npm run dev` to start the Node.js server.

3.  **Frontend Startup**:
    - Open a terminal in the `frontend` folder.
    - Run `npm install` for Next.js, Framer Motion, and Tailwind.
    - Run `npm run dev` to start the Next.js dev server on `http://localhost:3000`.

4.  **Testing Environment**:
    - Open two browser tabs to `http://localhost:3000`.
    - Join the same Room ID in both tabs.
    - Use the Host tab to start the game and play.

5.  **Multiplayer Sync**:
    - Players see each other's actions (bets, card plays, turn passing) in real-time.
    - High-quality 3D animations and audio ensure high engagement.
