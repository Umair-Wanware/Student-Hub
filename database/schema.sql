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
