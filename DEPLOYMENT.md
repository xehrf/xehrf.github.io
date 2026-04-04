# Deployment Guide

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
   - `SECRET_KEY`
   - `API_URL` (e.g. `https://your-backend-url`)
   - `REDIS_URL` if using Redis
6. Railway will expose a public backend URL; save it for frontend configuration.

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

## HTTPS and custom domains

- Vercel provides HTTPS automatically for frontend.
- Railway provides HTTPS for backend by default.
- Optionally configure a custom domain in Vercel and in Railway for the API.

## Production checklist

- [ ] Backend deploys successfully to Railway
- [ ] Frontend deploys successfully to Vercel
- [ ] `VITE_API_URL` points to the Railway backend URL
- [ ] `DATABASE_URL` is set and PostgreSQL is connected
- [ ] `SECRET_KEY` is set securely
- [ ] Public URL is accessible and API works
