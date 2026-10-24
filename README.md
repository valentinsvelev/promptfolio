# Promptfolio

A collaborative library for creating, discovering, and improving AI prompts.

**Live app:** https://valentinsvelev.github.io/promptfolio/

## Features

- Personal and team prompt libraries with search, filters, tags, and favourites
- Prompt versions, improvement proposals, and team-manager approvals
- Email/password authentication through Supabase
- Read-only guest preview with sample prompts
- Optional email allowlist for invite-only registration

## Tech stack

React · TypeScript · Vite · Supabase (Auth + PostgreSQL)

## Run locally

```bash
git clone https://github.com/valentinsvelev/promptfolio.git
cd promptfolio
npm install
npm run dev
```

Without Supabase configuration, the app runs with local demo data. Run `npm run verify` before committing changes.

## Connect Supabase

1. Create a Supabase project and run the SQL files in `supabase/` in order: `001_schema.sql`, `002_phase1_completion.sql`, `003_guest_and_likes.sql`. For invite-only registration, also apply `004_signup_email_allowlist.sql` (if included in your local checkout).
2. Create `.env.local` at the project root:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```

3. In **Supabase Authentication → URL Configuration**, set the site URL to `https://valentinsvelev.github.io/promptfolio/` and allow the local development redirect URL `http://localhost:5173/promptfolio/`.
4. If using the allowlist, add approved addresses to the private table and enable the **Before User Created** Postgres hook in Supabase Authentication settings.

**Never put Supabase secret/service-role keys in frontend code or commit `.env.local`.** Test access-control policies with separate accounts before storing sensitive information.

## Deploy

This repository deploys automatically to GitHub Pages on pushes to `main` via `.github/workflows/deploy.yml`. Set these GitHub Actions **repository variables** for the connected app:

```bash
gh variable set VITE_SUPABASE_URL --body "https://YOUR_PROJECT.supabase.co"
gh variable set VITE_SUPABASE_PUBLISHABLE_KEY --body "YOUR_PUBLISHABLE_KEY"
```

Enable **Settings → Pages → GitHub Actions** if Pages is not already configured. Then push to `main` or run `gh workflow run deploy.yml`.

> **Proof-of-concept notice:** Guest mode uses sample data. Real sign-ups and shared prompts require Supabase configuration; additional email-provider configuration may be needed for invitations beyond your initial test accounts.
