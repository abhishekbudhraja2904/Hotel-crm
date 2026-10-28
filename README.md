# Hotel Access CRM — setup
1. supabase.com → New project. SQL Editor → paste & run `supabase/migrations/0001_foundation.sql`.
2. Authentication → Users → Add user (owner email + password). Copy its UUID.
3. SQL Editor: run the bootstrap block at the bottom of the migration (uncomment, paste UUID).
4. Copy `.env.example` → `.env.local`, fill URL + anon key (Project Settings → API).
5. `npm install && npm run dev` to test locally.
6. Push to GitHub → import in vercel.com → add the same two env vars → Deploy.
7. Supabase → Authentication → URL Configuration: set Site URL to your Vercel URL (needed for password reset).
8. Open the Vercel URL on Android → menu → Install app.
Add employees for now: Auth → Add user, then insert a row in `employees` (role: sales). An admin screen + Edge Function is next.

## Update (v0.2)
- Also run `supabase/migrations/0002_staff_privacy.sql` (staff only see their own customers).
- Deploy the employee function: install Supabase CLI, `supabase link`, `supabase functions deploy create-employee`. Admins can then add staff in the app's Team tab.
- Boss (role `admin`) sees everything and can reassign; staff see only inquiries assigned to or created by them.
- Not yet run against a live Supabase project — test every role before use.
