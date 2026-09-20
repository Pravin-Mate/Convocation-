-- Convocation System Database Schema
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. Users & Roles
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT CHECK(role IN ('ADMIN', 'REPORTING', 'HELPDESK', 'PRESTAGE', 'STAGECONTROL')) NOT NULL,
    full_name TEXT NOT NULL,
    desk_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Active User Sessions (Token-Based RBAC)
CREATE TABLE IF NOT EXISTS user_sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);

-- 2. Student Master
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prn_reg_id TEXT UNIQUE NOT NULL,
    student_name TEXT NOT NULL,
    school_institute TEXT NOT NULL,
    programme_degree TEXT NOT NULL,
    specialization TEXT,
    award_medal TEXT,
    sequence_no INTEGER NOT NULL,
    email TEXT,
    mobile TEXT,
    photo_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index on search & ordering fields
CREATE INDEX IF NOT EXISTS idx_students_prn ON students(prn_reg_id);
CREATE INDEX IF NOT EXISTS idx_students_seq ON students(sequence_no);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_institute);

-- 3. Opaque QR Tokens
CREATE TABLE IF NOT EXISTS qr_tokens (
    token TEXT PRIMARY KEY,
    student_id INTEGER UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_student ON qr_tokens(student_id);

-- 4. Reporting Transactions
CREATE TABLE IF NOT EXISTS reporting_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER UNIQUE NOT NULL,
    reported_at DATETIME NOT NULL,
    desk_id TEXT NOT NULL,
    operator_id INTEGER NOT NULL,
    is_late INTEGER DEFAULT 0,
    reporting_type TEXT CHECK(reporting_type IN ('QR_SCAN', 'MANUAL_OVERRIDE')) DEFAULT 'QR_SCAN',
    override_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(operator_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_reporting_student ON reporting_records(student_id);

-- 5. Pre-Stage Queue
CREATE TABLE IF NOT EXISTS stage_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER UNIQUE NOT NULL,
    queued_at DATETIME NOT NULL,
    queue_order INTEGER NOT NULL,
    status TEXT CHECK(status IN ('QUEUED', 'CURRENT', 'CONFERRED', 'SKIPPED')) DEFAULT 'QUEUED',
    FOREIGN KEY(student_id) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_stage_queue_status ON stage_queue(status);

-- 6. Stage Events & Conferred Log
CREATE TABLE IF NOT EXISTS stage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    displayed_at DATETIME,
    completed_at DATETIME,
    status TEXT CHECK(status IN ('CONFERRED', 'SKIPPED')) NOT NULL,
    skip_reason TEXT,
    operator_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(operator_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_stage_events_student ON stage_events(student_id);

-- 7. Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    student_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(student_id) REFERENCES students(id)
);

-- 8. Event Settings
CREATE TABLE IF NOT EXISTS event_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL
);
