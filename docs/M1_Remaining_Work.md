# M1 — Identity, Onboarding & Account: Remaining Work

Status as of this doc: US-01, US-03, US-04, US-05 (core auth), US-07,
US-09 (onboarding, password change), and US-10/US-13 (sessions, email
preferences — simplified, see note below) are fully built and functional.
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

**Do not mark M1 done without circling back to these.**

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

| Story | What it needs | Screen |
|---|---|---|
| **US-02** Google OAuth | Google Cloud OAuth client + enable provider in Supabase (deferred by product decision) | — |
| **US-06** Intro slides "shown once" | Currently shows every time an unauthenticated user lands on `/sign-up` — spec requires it be tracked so a user who's completed it never sees it again | S01 (exists, not spec-complete) |
| **US-08** Email change (remainder) | Requires confirmation on both old and new address (Supabase's "secure email change" dashboard setting handles the dual-confirmation mechanics) | part of S07 — built, email change not added |
| **US-11** Data export | JSON + CSV, 7-day expiring download link, background job | S09 — doesn't exist |
| **US-12** Account deletion | Type-to-confirm, 30-day restorable grace period, immediate broker-connection revocation | S10 — doesn't exist |
| **US-14** "Keep me signed in" | 15-minute access / 30-day refresh distinction, silent refresh — currently just Supabase's flat default session behavior | — |

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

## Underlying data model gap (remaining)

`data_requests` table (US-11/US-12 job tracking) still doesn't exist. No
gap remains for sessions — deliberately not building a real `sessions`
table given the Supabase limitation above; the sign-in history reuses
`audit_events`.

## Infra / background jobs (need a cron, none set up yet)

- Auto-purge accounts stuck in `pending_verification` after 30 days
- Deletion sweep: hard-erase after the 30-day grace period
- Export file cleanup after 7 days

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

**US-06 (intro-slide "shown once") + US-08 remainder (email change)** —
both small, both close out stories that are otherwise done. US-06 is a
one-field flag check; email change reuses Supabase's built-in
dual-confirmation flow (same pattern as the SMTP/email-provider work
already done), so it's mostly wiring, not new mechanics.

Runner-up candidates:
- **Google OAuth (US-02)** — if reducing signup friction matters more
  than closing out the smaller remaining stories.
- **US-11/US-12 (export/deletion)** together — the biggest remaining
  lift (new `data_requests` table, background jobs, 30-day sweep). Better
  suited once more product modules exist and accounts actually accumulate
  data worth exporting or deleting.
- **US-14** (keep signed in) — a session/cookie config change more than a
  UI feature; low effort but also low visibility.
