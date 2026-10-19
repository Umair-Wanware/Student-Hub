# Student-Hub

## Backend setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Configure local PostgreSQL values in your environment. The app loads
   `.env.local` before `.env`; keep local secrets in the ignored `.env.local`
   file and do not overwrite an existing `.env`. Generate a session secret with
   `openssl rand -base64 48`, and use a different secret in each environment.
3. Create the database named by `DB_NAME`, then initialize its tables:

   ```sh
   psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f database/schema.sql
   ```

4. On an existing database, use the account that should own its current study
   records. On a fresh local database, start the server once, register that
   account at `/register.html`, then stop the server without logging in. Apply
   the ownership migration before normal use:

   ```sh
   psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
     -v legacy_owner_email="account@example.com" \
     -f database/migrations/001_user_data_ownership.sql
   ```

   The migration preserves existing rows, assigns them to that account, adds
   ownership constraints, and changes attendance subject uniqueness to be per
   account. It aborts if the account is missing. Apply this migration before
   deploying the version that requires owned records. On Render, run the same
   migration against the Render database URL before the web service deploy:

   ```sh
   psql "$DATABASE_URL" -v legacy_owner_email="account@example.com" \
     -f database/migrations/001_user_data_ownership.sql
   ```

5. Start the API and frontend server:

   ```sh
   npm start
   ```

The API is available at `http://localhost:3000`. Check it with
`GET /api/health`.

## Authentication and deployment

Authentication uses PostgreSQL-backed Express sessions. Set `SESSION_SECRET`
to a randomly generated value of at least 32 bytes and `NODE_ENV=production` on
the Render web service. Set `DATABASE_URL` to the Render PostgreSQL connection
string; Render provides `PORT`. The app trusts one reverse proxy hop in
production and sends secure, HTTP-only, SameSite=Lax cookies. The session table
is created automatically by `connect-pg-simple`, and sessions expire after 12
hours without a persistent “remember me” cookie. Do not set `JWT_SECRET`; JWT
authentication has been removed. Keep the service and browser same-origin; no
CORS credentials configuration is needed.

Login and registration are limited to 10 combined attempts per IP per 15
minutes per running Node process. If the service is scaled to multiple
instances, replace the in-memory limiter with a shared store.

All study APIs require authentication. Tasks, notes, attendance, focus sessions,
and dashboard results are filtered by the session user ID. The Students
directory API is admin-only because its current records are a shared directory,
not private profile data. Public registration always receives the `student`
role. Promote an administrator only through a trusted database operation.

## Manual authentication checks

The repository has no automated HTTP/database test framework. After the schema
and ownership migration are applied, verify the following locally or against a
staging deployment:

1. Register a new account with a valid password; confirm the stored value is a
   bcrypt hash and the API response contains no hash.
2. Try the same email again, malformed email, weak password, and mismatched
   confirmation; verify useful errors and no duplicate row.
3. Log in successfully and inspect that the cookie is HTTP-only; try an invalid
   password and confirm the response says only “Invalid email or password.”
4. While logged out, request `/api/auth/me`, `/api/tasks`, and
   `/api/dashboard`; each should return 401.
5. While logged in, load the dashboard, create records, and verify they appear
   only in that account. Log in as a second user and try reading/updating those
   record IDs; the other account should receive 404 or an empty list.
6. Update the profile, attempt to include `role: "admin"`, and confirm the role
   remains unchanged. Change password with a wrong current password and with
   mismatched confirmation, then verify a valid change signs out other sessions.
7. Log out and verify the cookie is cleared and protected endpoints return
   401. Submit a state-changing request without a CSRF token and verify 403.
8. Exercise existing dashboard, tasks, notes, attendance, focus, and analytics
   flows to confirm each remains functional under the signed-in account.
9. On Render, confirm the migration ran before deployment, the service has
   `DATABASE_URL`, `SESSION_SECRET`, and `NODE_ENV=production`, and HTTPS login,
   refresh, and logout all work.

For deployment, commit the code and migration, apply the migration to the
Render database before deploying the app version that requires `user_id`, then
deploy the web service. Example Git commands:

```sh
git add .env.example README.md database/migrations src public package.json package-lock.json
git commit -m "Add secure account authentication"
git push
```

## StudySphere API

The backend mirrors the data used by the current StudySphere frontend. List
endpoints return `{ success, count, total, page, limit, totalPages, data }`;
individual responses return `{ success, data }`.

| Frontend feature | Endpoints | Data fields |
| --- | --- | --- |
| Assignments & Tasks | `/api/tasks` | `title`, `subject`, `dueDate` (`YYYY-MM-DD`), `priority` (`High`, `Medium`, or `Low`), `completed` |
| Quick Notes | `/api/notes` | `title`, `content`, `date` (`YYYY-MM-DD`) |
| Attendance & CGPA | `/api/attendance` | `subject`, `attended`, `total` |
| Focus Flow Timer | `/api/focus-sessions` | `durationMinutes`, optional `completedAt` |
| Dashboard cards | `GET /api/dashboard` | pending tasks, note count, attendance average, today's focus minutes, and upcoming tasks |

Tasks, notes, and attendance records support `GET`, `POST`, `PUT /:id`,
`PATCH /:id`, and `DELETE /:id`. Focus sessions support `GET`, `POST`, and
`DELETE /:id`. List endpoints accept `page` and `limit`; tasks, notes, and
attendance also accept a `search` query. Tasks can additionally be filtered
with `completed=true` or `completed=false`.
