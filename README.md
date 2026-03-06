# AI Restaurant Copilot

AI-powered restaurant intelligence platform with end-to-end backend APIs, Supabase data storage, authentication, POS sync flows, and Twilio phone-call ordering.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind
- Backend: Vercel serverless API routes (`/api/*`)
- Database/Auth: Supabase
- Telephony: Twilio Voice (`/api/voice`, `/api/process-order`)
- Analytics: `src/lib/aiEngine.ts` reused on server and client

## Environment Variables

Copy values from `.env.example`.

Required:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Twilio call ordering:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `RESTAURANT_FALLBACK_PHONE`
- Optional: `RESTAURANT_ID`

## Run

```bash
npm install
npm run dev
```

For full local API + frontend behavior, run via Vercel dev in environments where `/api/*` routes are not proxied by Vite.

## Core API Endpoints

- `GET /api/auth/session`
- `GET|POST|PUT|DELETE /api/menu`
- `POST /api/menu/upload`
- `GET|POST /api/orders`
- `POST /api/orders/create`
- `POST /api/orders/upload`
- `GET|POST|DELETE /api/channels`
- `GET|PUT /api/restaurants/profile`
- `GET|POST /api/restaurants/setup`
- `GET|POST /api/pos/sync`
- `GET /api/analytics/intelligence`
- `GET /api/insights`
- `GET /api/combo-engine`
- `GET /api/price-optimization`
- `POST /api/voice`
- `POST /api/process-order`
- `GET /api/calls/recent`

## Database Schema

Run [`supabase/schema.sql`](supabase/schema.sql) to create required tables:

- `users`
- `restaurants`
- `menu_items`
- `orders`
- `channels`
- `call_logs`

## Twilio Webhook Setup

1. Deploy the project to a public URL.
2. In Twilio Console for your phone number, set voice webhook:
   - `POST https://<your-domain>/api/voice`
3. Twilio will continue speech turns through:
   - `POST https://<your-domain>/api/process-order`

## Optional Call Logs SQL (standalone)

```sql
create table if not exists call_logs (
  id bigint generated always as identity primary key,
  call_sid text unique not null,
  restaurant_id text,
  caller_phone text,
  to_phone text,
  language text,
  status text,
  transcript jsonb,
  order_json jsonb,
  order_id text,
  total numeric,
  is_transferred boolean default false,
  started_at timestamptz,
  updated_at timestamptz default now()
);

create index if not exists idx_call_logs_restaurant_started_at
  on call_logs (restaurant_id, started_at desc);
```
