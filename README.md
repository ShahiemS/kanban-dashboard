# Kanban Board

A Trello-like kanban board built with:

- **Frontend:** Svelte + Vite
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Deployment:** Docker + GitHub Actions to your VPS

## Quick start (local)

```bash
cp .env.example .env
cd backend && cp .env.example .env
cd ../frontend && cp .env.example .env

cd ../backend
npm install
npm run migrate
npm run dev

cd ../frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Run with Docker

```bash
cp .env.example .env
docker compose up --build -d
```

The app will be available on port `8080` (frontend) and the API on port `3000`.

## VPS auto-deploy

1. Push this repo to GitHub.
2. Add these GitHub Secrets:
   - `VPS_HOST` — your server IP
   - `VPS_USER` — SSH user
   - `VPS_SSH_KEY` — private SSH key
3. On every push to `main`, the `.github/workflows/deploy.yml` action will SSH into the VPS, pull the latest code, and run `docker compose up --build -d`.

You can also run `./deploy.sh` manually on the VPS.

## Project structure

- `backend/` — Express API with PostgreSQL
- `frontend/` — Svelte kanban UI
- `docker-compose.yml` — orchestrates DB, backend, and frontend
- `.github/workflows/deploy.yml` — auto-deploy pipeline
