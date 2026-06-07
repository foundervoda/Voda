# Mall Delivery App — Functional Prototype

Monorepo for the four-actor (Customer, Store, Mall Runner, Delivery Rider) mall
delivery prototype. See `Voda Dev_Handbook.pdf` for the full reference (architecture,
data models, API/socket reference, conventions) and `Voda - Division of Work & Timeline.pdf`
for the sprint plan.

## Stack

- **Mobile** — React Native (Expo), React Navigation, NativeWind/Tailwind, Zustand, React Query
- **Store dashboard** — React + Vite, Tailwind CSS
- **Backend** — Node.js + Express, Prisma ORM, Socket.io, JWT + bcrypt
- **Database** — PostgreSQL (Supabase)

## Structure

```
backend/   Express API + Prisma schema + Socket.io (port 3001)
mobile/    React Native app for Customer / Runner / Rider (Expo)
web/       Store dashboard (React + Vite)
```

## Getting started

Each sub-project has its own `.env.example` — copy it to `.env` and fill in the values
(Supabase `DATABASE_URL`, your machine's local IP for `EXPO_PUBLIC_API_URL`, etc).

```bash
# Backend
cd backend
npm install
npx prisma migrate dev   # creates all tables
npx prisma db seed       # 2-3 stores, products, one account per role
npm run dev              # http://localhost:3001

# Mobile
cd mobile
npm install
npx expo start           # scan the QR code with Expo Go

# Store dashboard
cd web
npm install
npm run dev
```

## Conventions

PascalCase components, camelCase functions/files, kebab-case API routes, snake_case
socket events. One feature branch per task (`feature/task-name`), small commits
(`feat: ...` / `fix: ...`), PR + review before merging to `main`. Full details in
the Developer Handbook §14.
