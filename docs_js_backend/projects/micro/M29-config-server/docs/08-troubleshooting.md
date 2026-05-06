# Troubleshooting: Config Server

## Dev Config Overwrites Prod

**Symptom:** Setting config for `dev` changes what `prod` returns.

**Cause:** Config is stored only by app name, not by environment.

**Solution:** Update storage to nest by environment: `store[app][env]`.

## Invalid Values Accepted

**Symptom:** Negative port numbers, empty strings, or `null` values are stored.

**Cause:** No validation before storing config.

**Solution:** Add validation middleware in `src/validator.ts`.

## Config Returns Empty Object

**Symptom:** `GET /config/myapp/dev` returns `{}`.

**Cause:** No config has been set for that app and environment.

**Solution:** Set config first with `POST /config/myapp/dev`.

## Tests Fail on Isolation

**Symptom:** `npm test` shows dev and prod configs are identical.

**Cause:** This is expected due to the bug. Environment is ignored in storage.

**Solution:** Fix the bug by updating `src/config.ts` to store by `app` and `env`.
