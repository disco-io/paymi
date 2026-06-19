# Paymi

Social bill-splitting app — assign items, split tax & tip fairly, save splits for your whole group.

**Stack:** React Native (Expo) · Supabase (Auth, Postgres, Storage)

## Current focus: backend + accounts

- **Phone sign-in** (enter phone + name, no SMS)
- **Groups** shared with everyone invited by phone
- **Saved splits** in Postgres, visible to all group members via RLS
- **Manual item entry** (receipt scanning / OCR comes later)

## Prerequisites

- Node.js **20+** (Expo SDK 54)
- [Supabase](https://supabase.com) project

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
2. **SQL Editor** → run both migrations in order:
   - `supabase/migrations/20240524000000_initial_schema.sql`
   - `supabase/migrations/20240619000000_auth_and_persistence.sql`
3. **Project Settings → API** → copy **Project URL** and **anon public** key into your local `.env`:

```bash
cp .env.example .env
# edit .env with your URL and anon key
```

4. **Authentication → Providers → Email** → enable, turn **off** “Confirm email” (no inbox needed).

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

### 3. Auth

1. Supabase → **Authentication** → **Providers** → **Email** → enable
2. Turn **off** “Confirm email” so sign-up works without an inbox
3. **Sign up:** phone, name, username, payment handle (Venmo / PayPal / Zelle)
4. **Log in:** phone only
5. Duplicate phone or username is blocked at sign-up

Run the latest migration (`supabase db push` or SQL in `supabase/migrations/20240620000000_profile_username_payment.sql`).

### 4. Storage

Migration creates the `receipts` bucket (for future receipt photos). Not required for manual splits.

### 5. Run the app

```bash
npx expo start
```

Scan the QR code in **Expo Go** (SDK 54). With `.env` configured, the app uses Supabase instead of preview mode.

## Project structure

```
app/                    Expo Router screens
  (auth)/               Phone + name sign-in
  (app)/                Groups home, group hub
  (app)/split/          Review → assign → summary (manual entry)
src/
  theme/                Colors (#787f17), cream, glass
  features/split/       Split math + draft store
  features/groups/      Group API
  features/receipt/     Split persistence API
supabase/
  migrations/           Schema + RLS + auth sync
```

## Core flow

1. Sign in with phone + name
2. Set your display name
3. Create a **group** and invite friends by phone
4. **Add items manually** → assign to people → save split
5. Everyone in the group sees saved splits; edits sync for all members

## Data model (shared by group)

| Table | Purpose |
|-------|---------|
| `profiles` | One row per user (phone, display name) |
| `groups` | Trip / brunch folders |
| `group_members` | Who's in each group (linked by `user_id` or pending `phone`) |
| `receipts` | Saved splits (merchant, tax, tip) |
| `receipt_items` | Line items on a split |
| `split_assignments` | Who owes what share of each item |

Row Level Security ensures only group members can read or write their group's data.

## Design

- Light mode, warm cream background
- Primary olive green `#787f17`
- Glass cards (blur on iOS)
- Gen-Z copy, Beli/Storytime-inspired social grouping

## Notes

- **Balances only** — no payment integrations in v1
- Pending members are added by phone until they sign up (auto-linked on first login)
- Receipt scanning / OCR is planned but not enabled yet
