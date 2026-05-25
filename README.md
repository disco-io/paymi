# Paymi

Social bill-splitting app — scan receipts, assign items, split tax & tip fairly.

**Stack:** React Native (Expo) · Supabase (Auth, Postgres, Storage, Edge Functions)

## Prerequisites

- Node.js **20+** (Expo SDK 54)
- [Supabase](https://supabase.com) project
- [Twilio](https://twilio.com) (or other SMS provider) for phone OTP
- [OpenAI API key](https://platform.openai.com) for receipt OCR (Edge Function)

## Connect GitHub + Supabase (recommended)

You need **two** links — they do different jobs:

| Connection | What it does |
|------------|----------------|
| **App → Supabase** (`.env`) | Your phone app talks to auth, database, storage |
| **GitHub → Supabase** (dashboard) | Supabase reads `supabase/migrations/` and edge functions from your repo |

### A. Version control on GitHub

1. On [github.com](https://github.com) → **New repository** → name it `paymi` (private is fine).
2. In your project folder, commit and push:

```bash
cd ~/Documents/paymi
git add .
git commit -m "Initial Paymi app — Expo, Supabase schema, split flow"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/paymi.git
git push -u origin main
```

Never commit `.env` — only `.env.example` (already in `.gitignore`).

### B. Supabase project + database

1. [Supabase Dashboard](https://supabase.com/dashboard) → **New project** (or open an existing one for Paymi).
2. **SQL Editor** → paste and run `supabase/migrations/20240524000000_initial_schema.sql`.
3. **Project Settings → API** → copy **Project URL** and **anon public** key into your local `.env`:

```bash
cp .env.example .env
# edit .env with your URL and anon key
```

4. **Authentication → Providers → Phone** → enable + connect Twilio for SMS codes.

### C. GitHub integration in Supabase dashboard

This is the **GitHub connection** you see in the dashboard — it wires your repo to that Supabase project:

1. Push your code to GitHub first (step A).
2. In Supabase: **Project Settings → Integrations → GitHub** (or **Connect GitHub**).
3. Authorize Supabase, then select your **`paymi`** repository.
4. Set **production branch** to `main` and point **Supabase directory** to `supabase` (where `migrations/` and `functions/` live).

After that, schema changes you add under `supabase/migrations/` can be applied from the dashboard or CI instead of copy-pasting SQL by hand.

Optional (CLI): install [Supabase CLI](https://supabase.com/docs/guides/cli), then:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF   # ref is in Project Settings → General
supabase db push
```

`YOUR_PROJECT_REF` is the short id in your project URL (`https://supabase.com/dashboard/project/abcdefghij` → `abcdefghij`).

---

## Setup

### 1. Clone & install

```bash
cd paymi
npm install
cp .env.example .env
```

Fill `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 2. Supabase database

Install [Supabase CLI](https://supabase.com/docs/guides/cli), link your project, then:

```bash
supabase db push
# or run supabase/migrations/20240524000000_initial_schema.sql in the SQL editor
```

### 3. Phone auth

In Supabase Dashboard → **Authentication** → **Providers** → enable **Phone**.

Connect **Twilio** (or MessageBird / Vonage) under SMS settings.

### 4. Storage

Migration creates the `receipts` bucket. Confirm in **Storage** that policies applied.

### 5. Receipt OCR (Edge Function)

```bash
supabase functions deploy parse-receipt
supabase secrets set OPENAI_API_KEY=sk-...
```

The function uses `gpt-4o-mini` vision to return line items, tax, tip, and merchant name.

### 6. Run the app (iOS)

```bash
npx expo start --ios
```

Use a physical device for camera + SMS OTP.

## Project structure

```
app/                    Expo Router screens
  (auth)/               Phone OTP + onboarding
  (app)/                Groups home, group hub
  (app)/split/          Camera → review → assign → summary
src/
  theme/                Colors (#787f17), cream, glass
  features/split/       Split math + draft store
  features/groups/      Group API
  features/receipt/     Upload + OCR + persistence
supabase/
  migrations/           Schema + RLS
  functions/parse-receipt/
```

## Core flow

1. Sign in with phone (Partiful-style OTP)
2. Create or open a **group** (trip, brunch, etc.)
3. **Scan receipt** (full-screen camera) → OCR → edit items
4. **Assign** items to people (tap person → tap item; long-press = everyone)
5. **Summary** — proportional tax/tip, save to Supabase

## Design

- Light mode, warm cream background
- Primary olive green `#787f17`
- Glass cards (blur on iOS)
- Gen-Z copy, Beli/Storytime-inspired social grouping

## Notes

- **Balances only** — no payment integrations in v1
- Pending members are added by phone until they sign up
- Receipt images kept until splits are settled (status on `receipts` table)
