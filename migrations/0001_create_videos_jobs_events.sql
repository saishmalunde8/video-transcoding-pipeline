-- 0001: the first schema. Design and reasons: docs/schema-design.md
-- Never edit this file after it has been applied. Change the schema with a new file.

CREATE TABLE videos (
  id                uuid        PRIMARY KEY DEFAULT uuidv7(),
  original_filename text        NOT NULL,
  storage_key       text        NOT NULL UNIQUE,
  size_bytes        bigint      NOT NULL CHECK (size_bytes >= 0),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE jobs (
  id         uuid        PRIMARY KEY DEFAULT uuidv7(),
  video_id   uuid        NOT NULL REFERENCES videos (id),
  status     text        NOT NULL DEFAULT 'queued'
                         CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  attempts   integer     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Append-only history. processing -> processing is legal: it is what a stall looks like.
CREATE TABLE job_events (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id      uuid        NOT NULL REFERENCES jobs (id),
  from_status text        CHECK (from_status IN ('queued', 'processing', 'completed', 'failed')),
  to_status   text        NOT NULL
                          CHECK (to_status IN ('queued', 'processing', 'completed', 'failed')),
  attempt     integer     NOT NULL CHECK (attempt >= 0),
  worker_id   text,
  message     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
