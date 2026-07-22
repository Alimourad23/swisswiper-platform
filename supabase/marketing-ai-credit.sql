-- Adds a prepaid-credit balance to the AI budget row so the app can show
-- "≈ credit left" (credit − all-time estimated spend). Run once in the
-- Supabase SQL editor. Safe to re-run.

alter table public.ai_budget
  add column if not exists credit_usd numeric not null default 0;

-- Optional: seed the balance you bought from Google (e.g. 10.00). You can also
-- set it in the app on Marketing → Plan → "AI credit" → Set credit.
-- update public.ai_budget set credit_usd = 10 where id = 'budget';
