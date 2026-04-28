# Deployment Guide

## Backend (Render)

1. Create a **Web Service** and set the root directory to `backend` (or keep root and use the root `Procfile`).
2. Use this start command:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
3. Make sure environment variables are set:
   - `DATABASE_URL`
   - `SECRET_KEY` or `JWT_SECRET`
   - `REDIS_URL`
4. Run database migrations before starting the app:
   ```bash
   cd backend && python -m app.db.upgrade
   ```
5. The backend now fails fast during startup if the JWT secret is missing, empty, or left on an insecure placeholder value.
6. Verify after deploy:
   - `GET /health` returns `{"status":"ok"}`
   - `GET /matchmaking/quests` returns `401` (without token) or `200` (with token), not `404`

## Backend (Railway)

1. Connect the GitHub repository to Railway.
2. Create a new service and point it to the `backend` folder.
3. In project settings, set the service start command to:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
4. Add the PostgreSQL plugin and copy the generated `DATABASE_URL` into Railway environment variables.
5. Add required env vars:
   - `DATABASE_URL`
   - `SECRET_KEY` or `JWT_SECRET`
   - `API_URL` (e.g. `https://your-backend-url`)
   - `REDIS_URL` if using Redis
6. Run migrations before routing traffic to the service:
   ```bash
   cd backend && python -m app.db.upgrade
   ```
7. Railway will expose a public backend URL; save it for frontend configuration.

### Notes
- `backend/app/core/config.py` now supports `SECRET_KEY` via environment variable.
- CORS is configured with `allow_origins=["*"]` in `backend/main.py`.
- The `backend/Procfile` provides a deployment-ready start command.

## Frontend (Vercel)

1. Connect the same GitHub repository to Vercel.
2. Set the root directory for the project to `frontend`.
3. Set the build command to:
   ```bash
   npm run build
   ```
4. Set the output directory to `dist`.
5. Add environment variable:
   - `VITE_API_URL=https://your-backend-url`
6. Deploy the frontend.

### Notes
- `frontend/src/api/client.js` reads the backend URL from `import.meta.env.VITE_API_URL`.
- Use the Railway backend public URL for `VITE_API_URL`.

## Environment files

- `backend/.env.example` shows backend env vars for local development.
- `frontend/.env.example` shows frontend prod env var format.

## Migrations

- Alembic configuration lives in `backend/alembic.ini` and `backend/alembic/`.
- Apply the current schema with `cd backend && python -m app.db.upgrade`.
- The app startup no longer performs runtime `ALTER TABLE` fixes.

## HTTPS and custom domains

- Vercel provides HTTPS automatically for frontend.
- Railway provides HTTPS for backend by default.
- Optionally configure a custom domain in Vercel and in Railway for the API.

## Production checklist

- [ ] Backend deploys successfully to Railway
- [ ] Frontend deploys successfully to Vercel
- [ ] `VITE_API_URL` points to the Railway backend URL
- [ ] `DATABASE_URL` is set and PostgreSQL is connected
- [ ] `SECRET_KEY` or `JWT_SECRET` is set securely
- [ ] Public URL is accessible and API works
