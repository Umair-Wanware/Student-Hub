# Student-Hub

## Backend setup

1. Copy `.env.example` to `.env` and set the database values and a strong
   `JWT_SECRET`.
2. Create the database named by `DB_NAME`, then initialize its tables:

   ```sh
   psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f database/schema.sql
   ```

3. Start the API and frontend server:

   ```sh
   npm start
   ```

The API is available at `http://localhost:3000`. Check it with
`GET /api/health`.

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
