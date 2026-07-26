# M1 — Identity, Onboarding & Account: Remaining Work

Status as of this doc: US-01, US-03, US-04, US-05 (core auth), US-07,
US-09 (onboarding, password change), US-10/US-13 (sessions, email
preferences — simplified, see note below), and US-12 (account deletion —
request/restore only, see flag below) are fully built and functional.
US-08 is partially built — name/timezone/currency editing works, email
change is deferred. Everything below is what's left against the full
`M1_Identity_Module_Spec`.

## ⚠️ Blocking item before M1 can be considered done

The Account & Profile slice (US-07/08/09) is built but **not fully
manually verified** — the user deferred finishing this. Before declaring
M1 complete, confirm the remaining unchecked items in
`docs/M1_Manual_Test_Guide.md` under "Slice 2: Account & Profile,"
specifically:
- Password-changed notification email actually arrives (a silent-failure
  bug was found and fixed here — never independently confirmed working)
- Profile edits (name/currency/timezone) persist after a page refresh
- Changing password signs out a second session
- Signing back in with the new password works

The Sessions/Email-preferences slice (US-10/US-13, just built) also
hasn't been through a full manual pass yet — see
`docs/M1_Manual_Test_Guide.md` Slice 3 once it's added.

Account deletion (US-12, just built) also hasn't been manually walked
through yet.

**Do not mark M1 done without circling back to these.**

## 🚩 US-12's actual erasure is not automated — flagged for later

Account deletion's *request* and *restore* flow is fully real and working
(see "What's now built" below). The permanent, irreversible 30-day
erasure is **not**. A function for it exists —
`performScheduledErasureAction()` in `app/(auth)/actions.ts` — but nothing
calls it. It needs a scheduler (Supabase `pg_cron`, a Supabase Edge
Function on a timer, Vercel Cron, or similar) that doesn't exist in this
project yet.

This was deliberate, not an oversight: wiring an irreversible mass-delete
action to a scheduler chosen in a rush felt riskier than leaving it
disconnected until there's an actual deployment/hosting story to decide
which scheduler fits. It's grouped with two other things needing the same
kind of infra — see "Infra / background jobs" below.

**Before this can be considered truly done**: decide on a scheduler,
wire `performScheduledErasureAction()` to it, and test it against a real
expired request (not just call it manually once).

## Note: US-10 was built differently than the spec literally asks for

Supabase Auth's admin API has no supported way to list individual
sessions or revoke one specific session by ID (confirmed via their own
docs/community — the only workaround is directly manipulating undocumented
internal tables, which their community explicitly flags as fragile). User
decision: build an honest **sign-in history** (deduped by device+IP,
showing "last used") with a single **"sign out of every other session"**
action, rather than faking per-row revoke. This satisfies the spirit of
US-10 but not its literal acceptance criteria ("revoking ends that session
within 60s" — implies per-session granularity we can't actually deliver).

## Stories not yet built

| Story | What it needs | Screen | Status |
|---|---|---|---|
| **US-02** Google OAuth | Google Cloud OAuth client + enable provider in Supabase | — | Deferred (product decision) |
| **US-06** Intro slides "shown once" | Currently shows every time an unauthenticated user lands on `/sign-up` — spec requires it be tracked so a user who's completed it never sees it again | S01 (exists, not spec-complete) | Deferred until after M6/M7 (product decision) |
| **US-08** Email change (remainder) | Requires confirmation on both old and new address | part of S07 — built, email change not added | **Dropped — not needed** (product decision) |
| **US-11** Data export | JSON + CSV, 7-day expiring download link, background job | S09 — doesn't exist | **Dropped — not needed for v1** (product decision). Reconsider once M2/M3 exist and there's real trade/journal data worth exporting — right now it'd only cover profile + consent + sign-in history |
| **US-14** "Keep me signed in" | 15-minute access / 30-day refresh distinction, silent refresh — currently just Supabase's flat default session behavior (everyone stays persistently signed in, no checkbox, no session-only option) | — | Deferred for later (product decision) |

## What's now built

- `users` table (`display_name`, `timezone`, `display_currency`,
  `onboarded_at`) — RLS-scoped, no admin client needed for it
- `/onboarding` (M1-S06): browser-detected timezone (legacy-alias
  normalization, SSR/hydration-safe), currency picker, always writes a
  non-null timezone
- `/profile` (M1-S07, with S08's password-change and a simplified
  sessions view folded in per spec's own flexibility note):
  - Profile: display name / timezone / currency editing
  - Security: password change with current-password verification,
    other-session revocation, real notification email via Resend, with a
    now-fixed bug where the email was failing silently
  - Sessions: deduped sign-in history (device/IP/last-used) + "sign out
    of every other session" (see note above on why not per-session)
  - Email preferences: one marketing-email opt-in toggle, backed by the
    existing append-only `consent_records` table
- Dashboard/verify/sign-in routing all gate correctly on onboarding
  completion, not just email verification
- `/profile/delete` (M1-S10, US-12 — request/restore only, see 🚩 above):
  type-to-confirm deletion request, 30-day grace period tracked via
  `data_requests`, other-session revocation, app-level access blocking on
  every protected page while a deletion is pending, and a same-session
  restore path. The actual 30-day hard erasure is not automated (see
  flag above).

## Underlying data model gap (remaining)

`data_requests` table now exists (built for US-12; would have been
reused by US-11, but that's dropped for v1 — see table above). No gap
remains for sessions — deliberately not building a real `sessions` table
given the Supabase limitation above; the sign-in history reuses
`audit_events`.

## Infra / background jobs (need a cron, none set up yet)

- Auto-purge accounts stuck in `pending_verification` after 30 days
- Deletion sweep: hard-erase after the 30-day grace period — the
  function to call (`performScheduledErasureAction()`) already exists,
  see 🚩 above; just needs a scheduler wired to it
- ~~Export file cleanup after 7 days~~ — moot, US-11 dropped for v1

## Smaller open items

- 2FA schema readiness — spec: "schema and security screen accommodate
  TOTP from day one." No schema field for it yet.
- Recovery-link 60-minute expiry isn't independently enforced (Supabase's
  dashboard only exposes one shared email-link expiry, currently 24h,
  which satisfies the confirmation link but not the tighter recovery
  target). Fixable with an app-level issued-at check if it matters later.
- Access token still at Supabase's 1-hour default vs. the spec's 15-minute
  target (accepted deviation).

## Documentation (spec's own "definition of done" requires these)

Module README, decision log (ADRs), runbook, data inventory & retention
register, user-facing help articles — none written yet.

---

## Recommendation: what to build next

US-06, US-08's email change, US-11 (export), and US-14 (keep signed in)
are all deferred/dropped for now (see table above). US-12 (account
deletion request/restore) is done, with the erasure-automation gap
flagged separately. The only remaining open story is **US-02 (Google
OAuth)** — plus, whenever it makes sense, deciding on and wiring up a
scheduler to cover the two remaining deferred background jobs
(unverified-account purge, deletion erasure).

With US-02 also likely deferred until there's a real signup-friction
reason to prioritize it, **M1 is functionally close to done** for what's
actually being built in v1 — the main remaining work is the manual
verification pass across all four built slices (flagged throughout this
doc) plus the documentation deliverables at the bottom.
