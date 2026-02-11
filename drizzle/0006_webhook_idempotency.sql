CREATE TABLE IF NOT EXISTS "webhook_idempotency" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" varchar(255) NOT NULL UNIQUE,
  "event_type" varchar(100) NOT NULL,
  "source" varchar(50) NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "payload" jsonb
);

CREATE INDEX IF NOT EXISTS "idx_webhook_idempotency_event_id" ON "webhook_idempotency" ("event_id");
CREATE INDEX IF NOT EXISTS "idx_webhook_idempotency_source_type" ON "webhook_idempotency" ("source", "event_type");
