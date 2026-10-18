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
