# ELD Trip Planner Backend

Node.js + Express + MongoDB backend for the ELD Trip Planner.

## Local setup
1. Copy `.env.example` to `.env`.
2. Set `MONGO_URL` and a strong `JWT_SECRET`.
3. `npm install`
4. `npm run dev`
5. Verify `GET http://localhost:4000/api/health/`.

## API
- POST `/api/auth/signup/`
- POST `/api/auth/signin/`
- POST `/api/auth/logout/`
- GET `/api/auth/me/`
- GET/POST `/api/trip/`
- GET/DELETE `/api/trip/:id/`
- POST `/api/trip/:id/plan/`
- GET `/api/trip/:id/eld.pdf`

