# Frontend

Ung dung nay la giao dien Next.js cho game bai realtime.

## Chay local

```bash
copy .env.example .env.local
npm install
npm run dev
```

Dat `NEXT_PUBLIC_SOCKET_URL` tro den backend Socket.IO, mac dinh local la:

```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:8080
```

## Deploy Vercel

- Import repo len Vercel
- Dat `Root Directory` = `frontend`
- Dat env `NEXT_PUBLIC_SOCKET_URL=https://your-backend-domain`
