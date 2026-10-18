CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL CHECK (char_length(btrim(name)) > 0),
    email VARCHAR(150) NOT NULL,
    password_hash VARCHAR(72) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_email_lowercase CHECK (email = lower(email)),
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_role_valid CHECK (role IN ('student', 'admin'))
);

CREATE TABLE IF NOT EXISTS students (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL CHECK (char_length(btrim(name)) > 0),
    email VARCHAR(150) NOT NULL,
    course VARCHAR(100) NOT NULL CHECK (char_length(btrim(course)) > 0),
    year SMALLINT NOT NULL CHECK (year BETWEEN 1 AND 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT students_email_lowercase CHECK (email = lower(email)),
    CONSTRAINT students_email_unique UNIQUE (email)
);

CREATE OR REPLACE FUNCTION set_students_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS students_set_updated_at ON students;

CREATE TRIGGER students_set_updated_at
BEFORE UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION set_students_updated_at();

CREATE TABLE IF NOT EXISTS tasks (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL CHECK (char_length(btrim(title)) > 0),
    subject VARCHAR(100) NOT NULL CHECK (char_length(btrim(subject)) > 0),
    due_date DATE NOT NULL,
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL CHECK (char_length(btrim(title)) > 0),
    content TEXT NOT NULL CHECK (char_length(btrim(content)) > 0),
    note_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
    id BIGSERIAL PRIMARY KEY,
    subject VARCHAR(100) NOT NULL UNIQUE CHECK (char_length(btrim(subject)) > 0),
    attended INTEGER NOT NULL CHECK (attended >= 0),
    total INTEGER NOT NULL CHECK (total > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT attendance_attended_not_greater_than_total CHECK (attended <= total)
);

CREATE TABLE IF NOT EXISTS focus_sessions (
    id BIGSERIAL PRIMARY KEY,
    duration_minutes SMALLINT NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION set_record_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_set_updated_at ON tasks;
CREATE TRIGGER tasks_set_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION set_record_updated_at();

DROP TRIGGER IF EXISTS notes_set_updated_at ON notes;
CREATE TRIGGER notes_set_updated_at
BEFORE UPDATE ON notes
FOR EACH ROW
EXECUTE FUNCTION set_record_updated_at();

DROP TRIGGER IF EXISTS attendance_set_updated_at ON attendance;
CREATE TRIGGER attendance_set_updated_at
BEFORE UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION set_record_updated_at();
