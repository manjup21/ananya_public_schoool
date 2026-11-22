CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    type VARCHAR(30) NOT NULL CONSTRAINT notification_logs_type_check CHECK (type IN ('attendance', 'exam_result', 'fee_due')),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'whatsapp')),

    reference_date DATE,
    reference_id UUID,

    class_id UUID NOT NULL,
    section_id UUID,

    recipient_count INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('processing', 'sent', 'partial', 'failed')),

    payload_preview TEXT,

    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS sent_count INT DEFAULT 0;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS failed_count INT DEFAULT 0;

-- Older databases have an auto-named type CHECK without 'fee_due'; replace it.
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  FOR v_conname IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'notification_logs'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%type%attendance%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%fee_due%'
  LOOP
    EXECUTE format('ALTER TABLE notification_logs DROP CONSTRAINT %I', v_conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'notification_logs' AND c.conname = 'notification_logs_type_check'
  ) THEN
    ALTER TABLE notification_logs
      ADD CONSTRAINT notification_logs_type_check
      CHECK (type IN ('attendance', 'exam_result', 'fee_due'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_class_section ON notification_logs(class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_reference ON notification_logs(reference_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);

-- Per-recipient delivery tracking
CREATE TABLE IF NOT EXISTS notification_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    log_id UUID NOT NULL,
    student_id UUID NOT NULL,
    guardian_phone VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_reason TEXT,
    sent_at TIMESTAMPTZ,
    notified_slots TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_recipients ADD COLUMN IF NOT EXISTS notified_slots TEXT[];

CREATE INDEX IF NOT EXISTS idx_notif_recipients_log_id ON notification_recipients(log_id);
CREATE INDEX IF NOT EXISTS idx_notif_recipients_student_id ON notification_recipients(student_id);
CREATE INDEX IF NOT EXISTS idx_notif_recipients_status ON notification_recipients(log_id, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'notification_recipients'
      AND c.conname = 'fk_notif_recipients_log'
  ) THEN
    ALTER TABLE notification_recipients
      ADD CONSTRAINT fk_notif_recipients_log
      FOREIGN KEY (log_id) REFERENCES notification_logs(id) ON DELETE CASCADE;
  END IF;
END $$;
