# intercom dashboard

Next.js web app: username/password auth, live view of agents and messages for
whichever workspace(s) your account has been granted access to.

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in DATABASE_URL / SESSION_SECRET / INTERCOM_API_URL
npm run dev
```

Requires the main repo's `postgres` and `api` services running (`docker compose up`
from the repo root).

## Provisioning an account

Accounts aren't self-service — create one from the repo root:

```bash
DATABASE_URL=postgres://intercom:<password>@localhost:5432/intercom \
  bun scripts/create-user.ts <username> <password> <workspace>
```

This mints a fresh workspace token and links it to the account. Run it again with the
same username and a different workspace to grant access to another workspace — one
account can access several.

## Deployment

Built and run as part of the repo-root `docker-compose.yml` (`web` service). See the
main [README](../README.md) for the VPS deployment flow.
