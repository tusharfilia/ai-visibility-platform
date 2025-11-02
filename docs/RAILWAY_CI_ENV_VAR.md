# Railway CI Environment Variable Setup

## Issue
Nixpacks auto-detects pnpm and generates its own install commands with `--frozen-lockfile`, ignoring our custom `.nixpacks.toml` configuration. This causes build failures when the lockfile is missing or outdated.

## Solution
Set `CI=false` as an environment variable directly in Railway's dashboard (not just in `railway.toml`) to prevent pnpm from auto-enabling `--frozen-lockfile` in CI environments.

## Steps to Set in Railway Dashboard

1. Go to your Railway project dashboard
2. Navigate to your service (API service)
3. Click on the **"Variables"** tab
4. Click **"New Variable"**
5. Set:
   - **Variable Name**: `CI`
   - **Value**: `false`
6. Click **"Add"**
7. Redeploy your service

## Why This Works

- `CI=false` tells pnpm not to auto-enable `--frozen-lockfile` in CI environments
- Railway environment variables are available during the build phase (unlike `railway.toml` which applies to runtime only)
- This allows pnpm to generate/update the lockfile during install if it doesn't exist

## Alternative: Manual Lockfile Generation

If you prefer to have a lockfile committed:
1. Generate lockfile locally: `pnpm install`
2. Commit `pnpm-lock.yaml`
3. Railway will then use `--frozen-lockfile` successfully

However, since we removed the lockfile to avoid outdated lockfile issues, setting `CI=false` is the preferred solution for now.

