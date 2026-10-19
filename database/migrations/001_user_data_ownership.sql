BEGIN;

SELECT set_config('student_hub.legacy_owner_email', lower(btrim(:'legacy_owner_email')), true);

DO $$
DECLARE
    legacy_owner_id BIGINT;
BEGIN
    SELECT id INTO legacy_owner_id
    FROM users
    WHERE email = lower(current_setting('student_hub.legacy_owner_email'));

    IF legacy_owner_id IS NULL THEN
        RAISE EXCEPTION 'The configured legacy owner account was not found';
    END IF;
END;
$$;

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notes
    ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE focus_sessions
    ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;

UPDATE tasks
SET user_id = (SELECT id FROM users WHERE email = lower(current_setting('student_hub.legacy_owner_email')))
WHERE user_id IS NULL;
UPDATE notes
SET user_id = (SELECT id FROM users WHERE email = lower(current_setting('student_hub.legacy_owner_email')))
WHERE user_id IS NULL;
UPDATE attendance
SET user_id = (SELECT id FROM users WHERE email = lower(current_setting('student_hub.legacy_owner_email')))
WHERE user_id IS NULL;
UPDATE focus_sessions
SET user_id = (SELECT id FROM users WHERE email = lower(current_setting('student_hub.legacy_owner_email')))
WHERE user_id IS NULL;

ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE notes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE attendance ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE focus_sessions ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_subject_key;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_user_subject_unique
    ON attendance(user_id, subject);
CREATE INDEX IF NOT EXISTS tasks_user_due_date_idx ON tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS notes_user_note_date_idx ON notes(user_id, note_date);
CREATE INDEX IF NOT EXISTS focus_sessions_user_completed_at_idx
    ON focus_sessions(user_id, completed_at);

COMMIT;