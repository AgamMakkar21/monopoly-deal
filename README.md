# Monopoly Deal (Next.js + Socket.io)

Real-time multiplayer Monopoly Deal web app for 2-5 players.

## Prerequisites

- Node.js 18+ (Node 20+ recommended)
- npm 9+

## Setup

```bash
npm install
```

## Run (web + game server together)

```bash
npm run dev
```

This starts:
- Next.js frontend: `http://localhost:3000`
- Socket.io game server: `http://localhost:4000`

## Play Instructions

1. Open `http://localhost:3000` in browser tab/window A.
2. Enter a player name and room ID, then click `Create Room`.
3. Open tab/window B (or another device), go to `http://localhost:3000`.
4. Enter a different player name and same room ID, then click `Join Room`.
5. Host clicks `Start Game`.
6. On your turn:
   - You auto-draw (2 cards, or 5 if your hand was empty at turn start).
   - Play up to 3 cards using `To Property`, `To Bank`, or `Play Action`.
   - Click `End Turn`.
7. If an action targets you, a 10-second reaction panel appears. Click `Just Say No` if you have that card in hand.
8. First player with 3 full property sets of different colors wins.

## Separate Commands (optional)

Run backend only:
```bash
npm run dev:server
```

Run frontend only:
```bash
npm run dev:web
```
