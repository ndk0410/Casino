# Card Game Monorepo

Repo nay duoc tach thanh 3 phan:

- `frontend`: ung dung Next.js de deploy len Vercel.
- `backend`: server Node.js + Socket.IO de deploy len Render, Railway, Fly.io, hoac VPS.
- `legacy`: ma nguon cu de tham khao, khong nam trong luong deploy moi.

## Cau truc deploy

`frontend` va `backend` khong nen deploy cung nhau tren Vercel vi backend dang dung Socket.IO server chay lien tuc. Vercel phu hop cho frontend, con backend nen dua len mot dich vu Node.js rieng.

## Chay local

Frontend:

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

Backend:

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

Gia tri can dat:

- `frontend/.env.local`
  - `NEXT_PUBLIC_SOCKET_URL=http://localhost:8080`
- `backend/.env`
  - `PORT=8080`
  - `CORS_ORIGIN=http://localhost:3000`

## Deploy len GitHub

```bash
git add .
git commit -m "Sync frontend and backend for deployment"
git push origin main
```

## Deploy frontend len Vercel

1. Import repo GitHub vao Vercel.
2. Chon `Root Directory` la `frontend`.
3. Framework se tu nhan la Next.js.
4. Dat Environment Variable:
   - `NEXT_PUBLIC_SOCKET_URL=https://your-backend-domain`
5. Deploy.

## Deploy backend

Tren Render/Railway/Fly.io:

1. Chon service cho thu muc `backend`.
2. Build/install command: `npm install`
3. Start command: `npm start`
4. Dat env:
   - `PORT=8080` hoac de platform cap
   - `CORS_ORIGIN=https://your-vercel-domain`

## Ghi chu

- Frontend da duoc noi vao giao dien game that thay vi trang mac dinh Next.js.
- Frontend doc URL backend qua `NEXT_PUBLIC_SOCKET_URL`.
- `.gitignore` da bo qua dependency va build output cua ca frontend/backend.
