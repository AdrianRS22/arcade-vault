# SPEC 03 — About page and contact email

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-05
> **Objective:** Add an About page at `/about` ported from `references/templates/home-about/home-about/about.jsx` (in English) whose contact form sends an email to the team through Resend using a Server Action.

## Why this spec exists

SPEC 02 ported the Home and explicitly deferred the About page. The prototype's About includes a contact form that only fakes a send. This spec ports the page and makes the form actually deliver the message to the team's inbox.

## Scope

**In:**

- Route `/about` with every section of `about.jsx`, same structure, classes and visuals, copy translated to English:
  1. About hero: kicker `▸ ABOUT`, title `ABOUT ARCADE VAULT`, mission paragraph, 3 highlights with pixel icons (HEART `MADE WITH ❤️ FOR PLAYERS`, BROWSER `HTML GAMES — RUN IN ANY BROWSER`, PLANT `A PROJECT THAT KEEPS GROWING`).
  2. Divider banner: two gradient bars and 24 blinking pixels.
  3. Contact: kicker `▸ CONTACT`, title `CONTACT US`, subtitle, 3 tips with LEDs (`REPLY WITHIN 24-48H`, `SUGGESTIONS WELCOME`, `NO SPAM, EVER`), and the form (NAME, EMAIL, MESSAGE, `▶ SEND MESSAGE`).
- Form states:
  - **Idle:** fields and submit button.
  - **Pending:** button disabled, label `TRANSMITTING…`.
  - **Validation error:** form shakes (`.shake`) and the message of each invalid field appears under it; typed values are kept.
  - **Success:** `VAULT-OS // TERMINAL` window with the `[OK]` lines and `> MESSAGE RECEIVED. WE'LL GET BACK TO YOU SOON. THANKS, {NAME}.` plus `SEND ANOTHER MESSAGE` (resets the form).
  - **Send error:** same terminal window with red border, `[ERR]` lines and `> TRANSMISSION FAILED. PLEASE TRY AGAIN LATER.` plus a `RETRY` button that returns to the form with the typed values kept.
- Server Action `sendContactMessage` that validates on the server and sends one email to the team with Resend.
- Email body built with React Email (`@react-email/components`), with a plain-text fallback.
- Anti-abuse: server-side validation (required, email format, max lengths) and a hidden honeypot field.
- Nav: `About` link after `Hall of Fame` (desktop and mobile panel), active on `/about`.
- Nav fix at ≤480px: the shared nav overflowed the viewport (hamburger button ended past the right edge, causing ~8px of horizontal scroll on every page). Tighten its gaps in `app/globals.css` so the 375px criterion can pass. Added during step 9 verification.
- Scroll reveal on the divider and contact section, reusing `app/_components/home/reveal.tsx`.
- About CSS ported from the reference `styles.css` into `app/globals.css`.
- New env vars documented in `.env.example`.

**Out of scope (for future specs):**

- Confirmation email to the user (needs a verified domain).
- Rate limiting per IP and CAPTCHA.
- Storing messages in a database or an admin inbox.
- Verifying a custom sending domain in Resend (operational task, not code).
- Changes to Home, Library, Detail, Player, Auth or Hall of Fame beyond the nav link and the nav overflow fix.

## Data model

No persisted data. New types and env vars:

```ts
// app/about/contact-schema.ts (shared by the action and the form)
export type ContactField = "name" | "email" | "message";

export type ContactFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<ContactField, string>>; values: Record<ContactField, string> }
  | { status: "sent"; name: string }
  | { status: "error"; values: Record<ContactField, string> };

export const CONTACT_LIMITS = { name: 80, email: 254, message: 2000 } as const;

export function validateContact(input: Record<ContactField, string>):
  Partial<Record<ContactField, string>>; // empty object = valid
```

```ts
// app/about/actions.ts
"use server";
export async function sendContactMessage(
  prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState>;
```

Validation rules (trimmed values):

- `name`: required, ≤ 80 chars.
- `email`: required, ≤ 254 chars, matches a basic `x@y.z` regex.
- `message`: required, ≤ 2000 chars.
- Honeypot field `company` (hidden, `tabIndex={-1}`, `autoComplete="off"`): if not empty, return `{ status: "sent", name }` without calling Resend.

Env vars (server only, never `NEXT_PUBLIC_`):

| Var | Example | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | `re_xxx` | Resend API key |
| `CONTACT_TO_EMAIL` | `team@example.com` | Team inbox that receives messages |
| `CONTACT_FROM_EMAIL` | `Arcade Vault <onboarding@resend.dev>` | Sender; test sender works without a verified domain |

Email sent:

- `from`: `CONTACT_FROM_EMAIL`; `to`: `CONTACT_TO_EMAIL`; `replyTo`: the user's email.
- `subject`: `[Arcade Vault] New message from {name}`.
- `react`: `<ContactEmail name email message />`; plus `text` fallback.

## Implementation plan

1. Install `resend` and `@react-email/components`. Add `.env.example` with the 3 vars (empty values) and make sure `.env*.local` is in `.gitignore`.
2. Create `app/about/contact-schema.ts` with `ContactField`, `ContactFormState`, `CONTACT_LIMITS` and `validateContact`.
3. Create `emails/contact-email.tsx`: React Email component (dark arcade look, inline styles) showing name, email and message; user content rendered as text (React escapes it).
4. Create `app/about/actions.ts` with `sendContactMessage`: read FormData, check honeypot, validate, return `invalid` with errors + values if any; if env vars are missing, log server-side and return `error`; call `resend.emails.send(...)`; on `{ error }` or exception log and return `error`; otherwise return `sent`.
5. Port About CSS from `references/templates/home-about/home-about/styles.css` (lines ~1072–1146) into `app/globals.css`: `.about*`, `.highlight*`, `.div-bar`, `.div-pixels`, `@keyframes pxblink`, `.contact-*`, `.contact-form.shake` + `@keyframes shake`, `.btn.press`, `.terminal-success`, `.term-*`. Skip what exists (`.field`, `.reveal`, `.fade-in`, `@keyframes blink`). Add `.field textarea` / `.field-error` (red, small mono), a `.terminal-success.error` variant (red border/glow, red `[ERR]` lines), and `prefers-reduced-motion` rules for `pxblink` and `shake`.
6. Create `app/_components/about/highlight-icon.tsx` (HEART, BROWSER, PLANT SVGs from the template) and `app/_components/about/contact-form.tsx` (client, `useActionState(sendContactMessage, { status: "idle" })`, `useFormStatus`/`isPending` for the pending label, shake triggered when state becomes `invalid`, success/error terminals, `SEND ANOTHER MESSAGE` and `RETRY` reset to the form).
7. Create `app/about/page.tsx` (server page, `metadata` title `About · Arcade Vault`) rendering hero, highlights, divider, contact intro and `<ContactForm />`, plus `<Reveal />`.
8. Add the `About` link to `app/_components/nav.tsx` (desktop + mobile, `aboutActive = pathname.startsWith("/about")`).
8b. Fix the nav overflow at ≤480px in `app/globals.css` (smaller `gap` in `.av-nav`, no `margin-left` on `.auth-btn`); confirm `scrollWidth === clientWidth` at 375px on `/about`, `/login` and `/hall-of-fame`.
9. Run `npm run lint` and `npm run build`; verify acceptance criteria in the browser at desktop and 375px, and send one real test email with a valid key.

Before writing code, read `node_modules/next/dist/docs/` (Server Actions / forms, `useActionState`, Cache Components implications for a page with a form, environment variables). Use the `/frontend-design` skill for UI work.

## Acceptance criteria

- [ ] `npm run lint` finishes with no errors.
- [ ] `npm run build` finishes with no errors.
- [ ] `/about` shows, in order: hero (kicker, title, mission), 3 highlights with icons, divider with 24 pixels, contact intro with 3 tips, and the form.
- [ ] Layout and styles match `about.jsx` + `styles.css` (same classes, colors, grid 1fr/1.2fr on desktop).
- [ ] No visible text on `/about` is in Spanish.
- [ ] Nav shows Home, Library, Hall of Fame, About (desktop and mobile); About is active on `/about`.
- [ ] Submitting with any empty field shakes the form and shows the error under that field; no email is sent.
- [ ] Submitting `not-an-email` in EMAIL shows an email error under the field.
- [ ] A message over 2000 chars is rejected with an error under MESSAGE.
- [ ] Typed values are kept after a validation error.
- [ ] While sending, the button is disabled and reads `TRANSMITTING…`.
- [ ] With valid env vars, a valid submit shows the success terminal with the name in uppercase, and the team inbox receives an email with subject `[Arcade Vault] New message from {name}`, the three fields in the body, and reply-to set to the user's email.
- [ ] `SEND ANOTHER MESSAGE` returns to an empty form.
- [ ] With `RESEND_API_KEY` missing or invalid, a valid submit shows the error terminal; `RETRY` returns to the form with values kept; the server log shows the cause; the API key never appears in client code or responses.
- [ ] Filling the honeypot field (via devtools) shows success and sends no email.
- [ ] Divider and contact fade in on scroll; with reduced motion emulated they are visible and pixels/shake don't animate.
- [ ] At 375px there is no horizontal scroll; highlights and contact grid collapse to one column.
- [ ] `.env.example` lists the 3 vars and no real secret is committed.

## Decisions

- **Yes:** English copy, same structure/classes as the template. Consistent with SPEC 01/02.
- **No:** literal Spanish copy. Would leave one page in a different language.
- **Yes:** Server Action + `useActionState`. API key stays on the server; no public endpoint.
- **No:** Route Handler `POST /api/contact`. More code and public surface with no other consumer.
- **Yes:** one email to the team only, `replyTo` = user. Works with `onboarding@resend.dev` without a verified domain.
- **No:** confirmation email to the user. Requires a verified domain; deferred.
- **Yes:** React Email for the body, with plain-text fallback. Chosen by the user over raw HTML.
- **Yes:** server-side validation + honeypot. No new deps, zero friction.
- **No:** rate limiting and CAPTCHA. Need external infra/keys; their own spec.
- **Yes:** shake + per-field errors. Keeps the template's feel and tells the user what is wrong.
- **Yes:** terminal-style error state with RETRY. Matches the success state's visual language.
- **Yes:** reuse `app/_components/home/reveal.tsx` and port CSS into `app/globals.css`, consistent with SPEC 02.

## Risks

| Risk | Mitigation |
| --- | --- |
| Without a verified domain, Resend only delivers to the account owner's email | `CONTACT_TO_EMAIL` must be the Resend account email until a domain is verified; documented in `.env.example`. |
| Missing env vars in production break sending | Action checks vars, logs, and returns the `error` state instead of throwing. |
| Spam bots flood the inbox | Honeypot now; rate limit/CAPTCHA in a future spec. |
| HTML injection through the message | React Email renders user content as text (escaped); never `dangerouslySetInnerHTML`. |
| Server Actions/forms behave differently in Next 16 with Cache Components | Read `node_modules/next/dist/docs/` before step 4; the page itself has no dynamic data. |
| `@react-email/components` incompatible with React 19.3 | Check peer deps on install; fall back to plain HTML string if it blocks the build (record the change). |
| Ported CSS collides with existing classes (`.field`, `.reveal`, `blink`) | Port only missing selectors; diff against `globals.css`. |

## What is **not** in this spec

- Confirmation email to the user.
- Rate limiting or CAPTCHA.
- Storing contact messages.

Each one of those, if it lands, goes in its own spec.
