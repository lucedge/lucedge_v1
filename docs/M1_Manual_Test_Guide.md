# M1 — Manual Test Guide

Living checklist for manually testing what's actually been built in M1 so
far. Update this whenever a new slice ships — add a new section, don't
rewrite old ones (so it stays a record of what's been verified over time).

**How to use it**: work top to bottom, ticking boxes as you go. If
something fails, note it and stop there rather than continuing past a
broken step — later steps often depend on earlier ones working.

## Prerequisites

- [ ] Dev server running (`npm run dev`)
- [ ] `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`
- [ ] `supabase/sql/001_m1_core_auth.sql` has been run in Supabase Studio (`audit_events`, `consent_records` tables exist)
- [ ] `supabase/sql/002_m1_account_profile.sql` has been run (`users` table exists)
- [ ] Test email address matches whatever your Resend account is registered under (test-sender limitation — see note below)

---

## Slice 1: Core Auth (US-01, US-03, US-04, US-05)

### Sign up (US-01)
- [ ] Sign up with a real email + password ≥10 characters → succeeds
- [ ] Sign up again with the same email → clear "account already exists" message, no duplicate created
- [ ] Password under 10 characters → blocked client-side before submitting

### Email verification (US-03)
- [ ] After signup, lands on `/auth/verify` (not `/dashboard`)
- [ ] Verification email arrives; clicking the link verifies the account and lands you back in the app
- [ ] On `/auth/verify`, click "Resend" twice quickly → second attempt is rejected with a wait-time message
- [ ] An unverified account visiting `/dashboard` directly gets redirected to `/auth/verify`

### Sign in + lockout (US-04)
- [ ] Correct credentials → signs in successfully
- [ ] Wrong password → generic "Email or password is incorrect" (never reveals whether the account exists)
- [ ] Wrong password 5 times within 15 minutes → 6th attempt shows a locked-out countdown instead of the generic error
- [ ] Locked-out state offers a "reset your password" shortcut

### Password reset (US-05)
- [ ] "Forgot password?" with an email that exists → generic "check your inbox" response
- [ ] Same flow with an email that does **not** exist → identical response (no enumeration leak)
- [ ] Reset email arrives, link lands on `/auth/reset`
- [ ] Set a new password → confirm success screen, not stuck back on the form
- [ ] A second browser/incognito session signed into the same account gets signed out after the reset
- [ ] Sign in with the new password → works

---

## Slice 2: Account & Profile (US-07, US-08 partial, US-09)

### Onboarding / timezone (US-07)
- [ ] Fresh verified account lands on `/onboarding`, not `/dashboard`
- [ ] Timezone dropdown is pre-selected to your actual timezone (correct modern IANA name, e.g. "Asia/Kolkata" not "Asia/Calcutta")
- [ ] Currency defaults to USD, changeable
- [ ] Submit → lands on `/dashboard`
- [ ] Revisiting `/onboarding`, `/auth/verify`, or `/dashboard` afterward no longer bounces back to onboarding

### Onboarding gating
- [ ] A verified-but-not-yet-onboarded account visiting `/dashboard` directly → redirected to `/onboarding`
- [ ] Same account visiting `/profile` directly → redirected to `/onboarding`
- [ ] A pre-existing account created before the `users` table existed also correctly gets sent through onboarding once

### Profile editing (US-08 — name/timezone/currency only, email change not built yet)
- [ ] `/profile` shows current display name, timezone, currency correctly
- [ ] Change display name + currency → Save → shows Saving → Saved
- [ ] Refresh the page → changes persisted (not just visual)
- [ ] Change timezone → saves and persists on refresh

### Password change (US-09)
- [ ] Wrong current password → clear rejection, nothing changes
- [ ] Correct current password + new password (≥10 chars) → Saving → "Password updated"
- [ ] Notification email arrives ("your password was changed")
- [ ] A second signed-in session for the same account gets signed out
- [ ] Sign out and sign back in with the new password → works

---

## Slice 3: Sessions & Email Preferences (US-10 simplified, US-13)

**Note on US-10**: this is deliberately not per-session revoke — see
`docs/M1_Remaining_Work.md` for why. It's a deduped sign-in history
("last used" per device+IP) plus one "sign out everywhere else" action.

### Sessions (US-10)
- [ ] Sign in → `/profile` → Sessions section shows this sign-in with a sensible device label (e.g. "Chrome on Windows"), your IP, and "Last used [time]"
- [ ] Sign out and back in again from the same browser → still shows as **one** row (deduped), with the "Last used" time updated, not a second row
- [ ] Open a second browser/incognito, sign into the same account → click "Sign out of every other session" in the first browser → confirm the second browser gets signed out on its next request
- [ ] An account with no sign-in history recorded yet (e.g. very old test account) shows "No sign-ins recorded yet" rather than erroring

### Email preferences (US-13)
- [ ] Toggle "Product updates and tips" on → confirm it saves
- [ ] Refresh the page → toggle state persisted
- [ ] Toggle it back off → saves and persists correctly
- [ ] Check `consent_records` in Supabase Studio → confirm each toggle change appended a **new** row (purpose `marketing`), not an update to the signup-time `terms` row

---

## Not yet built — don't report these as bugs

- Google sign-in button exists but isn't wired up (US-02, deferred)
- Email change (part of US-08) — not built
- Intro-slide "shown once" tracking (US-06) — currently shows every visit
- True per-session revoke by ID (US-10's literal spec ask) — not feasible on Supabase without relying on undocumented internals; see the simplified version above instead
- Data export (US-11) — not built
- Account deletion (US-12) — not built
- "Keep me signed in" 15min/30-day split (US-14) — currently a flat session default
- Full pixel-accurate visual match to `M1_UI_Mockups.html` — functional only so far

See `docs/M1_Remaining_Work.md` for the full breakdown of what's left.

## Known environment quirks (not bugs)

- Using Resend's test sender (`onboarding@resend.dev`) — emails only deliver to the address your Resend account is registered under, not arbitrary test addresses
- Access token expiry is at Supabase's 1-hour default rather than the spec's 15-minute target (accepted deviation)
