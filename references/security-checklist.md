## Basic Security Checklist

- [ ] **RLS:** Row Level Security enabled on both tables: `games` and `scores`.
- [ ] **Minimum password length:** At least 8 characters.
- [ ] **Leaked password protection:** (Warning #4).
- [ ] **Max signup rate:** Limit signups per IP address (anti-bot protection).
- [ ] **Security headers in Next.js.**

Example:

```ts
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// In the Next.js configuration:
headers: async () => [
  { source: '/(.*)', headers: securityHeaders }
]
```

## On the Supabase Side

| name                                               | title                                                 | level | facing   | categories   | description                                                                                                                                                                                                              | detail                                                                                                                                                                                                                                                        | remediation                                                                                                            | metadata                                                                                                                             | cache_key                                                                                              | observed_at              |
| -------------------------------------------------- | ----------------------------------------------------- | ----- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------ |
| anon_security_definer_function_executable          | Public Can Execute SECURITY DEFINER Function          | WARN  | EXTERNAL | ["SECURITY"] | Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.       | Function `public.rls_auto_enable()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/rls_auto_enable`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.                                   | https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable          | {"schema":"public","name":"rls_auto_enable","language":"plpgsql","arguments":"","security_definer":true}                             | anon_security_definer_function_executable_public_rls_auto_enable_                                      | 2026-11-12T04:36:51.430Z |
| anon_security_definer_function_executable          | Public Can Execute SECURITY DEFINER Function          | WARN  | EXTERNAL | ["SECURITY"] | Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.       | Function `public.username_available(p text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/username_available`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.                       | https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable          | {"schema":"public","name":"username_available","language":"sql","arguments":"p text","security_definer":true}                        | anon_security_definer_function_executable_public_username_available_p text                             | 2026-11-12T04:36:51.430Z |
| authenticated_security_definer_function_executable | Signed-In Users Can Execute SECURITY DEFINER Function | WARN  | EXTERNAL | ["SECURITY"] | Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it. | Function `public.rls_auto_enable()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/rls_auto_enable`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.                          | https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable | {"schema":"public","name":"rls_auto_enable","language":"plpgsql","arguments":"","security_definer":true}                             | authenticated_security_definer_function_executable_public_rls_auto_enable_                             | 2026-11-12T04:36:51.430Z |
| authenticated_security_definer_function_executable | Signed-In Users Can Execute SECURITY DEFINER Function | WARN  | EXTERNAL | ["SECURITY"] | Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it. | Function `public.set_username(p text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/set_username`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.                          | https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable | {"schema":"public","name":"set_username","language":"plpgsql","arguments":"p text","security_definer":true}                          | authenticated_security_definer_function_executable_public_set_username_p text                          | 2026-11-12T04:36:51.430Z |
| authenticated_security_definer_function_executable | Signed-In Users Can Execute SECURITY DEFINER Function | WARN  | EXTERNAL | ["SECURITY"] | Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it. | Function `public.submit_score(p_game_id text, p_score integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/submit_score`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. | https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable | {"schema":"public","name":"submit_score","language":"plpgsql","arguments":"p_game_id text, p_score integer","security_definer":true} | authenticated_security_definer_function_executable_public_submit_score_p_game_id text, p_score integer | 2026-11-12T04:36:51.430Z |
| authenticated_security_definer_function_executable | Signed-In Users Can Execute SECURITY DEFINER Function | WARN  | EXTERNAL | ["SECURITY"] | Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it. | Function `public.username_available(p text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/username_available`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.              | https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable | {"schema":"public","name":"username_available","language":"sql","arguments":"p text","security_definer":true}                        | authenticated_security_definer_function_executable_public_username_available_p text                    | 2026-11-12T04:36:51.430Z |
| auth_leaked_password_protection                    | Leaked Password Protection Disabled                   | WARN  | EXTERNAL | ["SECURITY"] | Leaked password protection is currently disabled.                                                                                                                                                                        | Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security.                                                                                                                      | https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection               | {"entity":"Auth","type":"auth"}                                                                                                      | auth_leaked_password_protection                                                                        |                          |









































Thinking effortInstant