---
name: baseline
description: Accepted risks, known gaps and advisor baseline for Arcade Vault
metadata:
  type: project
---

Accepted risks (SPEC 15, 2026-11-11):

- submit_score(p_game_id, p_score): SECURITY DEFINER, authenticated only; player from session.
- set_username(p): SECURITY DEFINER, authenticated only; sets name once.
- username_available(p): anon + authenticated, returns boolean; needed by sign-up.
- Leaked password protection disabled (Free plan).

Known gaps: no CSP, no rate limit on submit_score/contact form, no anti-cheat, no MFA, no CAPTCHA, X-Frame-Options DENY blocks embedding.

Advisor baseline: security = anon_security_definer_function_executable (username_available), authenticated_security_definer_function_executable (set_username, submit_score, username_available), auth_leaked_password_protection. Performance: unused_index scores_user_idx (Info).

Expected DB state: rls_auto_enable not executable by anon/authenticated/public; 10 migrations, no drift (as of 2026-11-11).
