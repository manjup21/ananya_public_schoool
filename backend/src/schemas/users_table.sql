CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) CHECK (role IN ('admin', 'lecturer')) NOT NULL DEFAULT 'lecturer',
    can_manage_fees BOOLEAN NOT NULL DEFAULT FALSE,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Capability flags (independent; stack on default staff/lecturer profile)
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_fees BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Production migration (run once after deploy):
-- UPDATE users SET is_super_admin = TRUE, is_admin = TRUE, role = 'lecturer' WHERE role = 'admin';
