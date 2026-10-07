# Database design (Phase 3, Step 3)

The first migration (Step 4) implements exactly this. Later phases change the
schema only through new migrations, never by editing this design after the fact
without a note.

## The three tables

```
videos 1 ──── many jobs 1 ──── many job_events
(the file)       (one transcode)     (every status change, append-only)
```

### videos: one row per uploaded source file

| Column | Type | Rule | Why |
|---|---|---|---|
| `id` | `uuid` | primary key, default `uuidv7()` | appears in URLs; time-ordered (see below) |
| `original_filename` | `text` | not null | what the user called it; shown in the UI, never used as a path |
| `storage_key` | `text` | not null, unique | where the bytes live (disk in Phase 4, then MinIO); two rows must never claim the same object |
| `size_bytes` | `bigint` | not null, `>= 0` | `integer` tops out at about 2.1 GB, videos do not |
| `created_at` | `timestamptz` | not null, default `now()` | |

### jobs: one row per transcode request, holding the CURRENT state

| Column | Type | Rule | Why |
|---|---|---|---|
| `id` | `uuid` | primary key, default `uuidv7()` | becomes the BullMQ job id in Phase 7 |
| `video_id` | `uuid` | not null, references `videos(id)` | a job without a video is meaningless |
| `status` | `text` | not null, default `'queued'`, one of the four states | |
| `attempts` | `integer` | not null, default 0, `>= 0` | how many times a worker has started it |
| `last_error` | `text` | nullable | why it failed, for the UI |
| `created_at`, `updated_at` | `timestamptz` | not null, default `now()` | |

### job_events: the history, one row per status change, never updated or deleted

| Column | Type | Rule | Why |
|---|---|---|---|
| `id` | `bigint` identity | primary key | gives a strict order to events |
| `job_id` | `uuid` | not null, references `jobs(id)` | |
| `from_status` | `text` | nullable (null for the very first event) | |
| `to_status` | `text` | not null | |
| `attempt` | `integer` | not null | which attempt this event belongs to |
| `worker_id` | `text` | nullable (null when the API did it) | `hostname:pid` of the worker process |
| `message` | `text` | nullable | |
| `created_at` | `timestamptz` | not null, default `now()` | |

## A job's states

```
            API creates job
                  │
                  ▼
             ┌─────────┐
             │ queued  │◀──────────────┐ retry (Phase 10)
             └────┬────┘               │
     worker picks │                    │
                  ▼                    │
            ┌────────────┐             │
            │ processing │─────────────┘
            └─────┬──────┘
          ┌───────┴────────┐
          ▼                ▼
    ┌───────────┐    ┌────────┐
    │ completed │    │ failed │   (terminal: no way out)
    └───────────┘    └────────┘
```

Four states. No `uploading` (the job row is only created after the upload has
finished, so that state can never be observed) and no `stalled` (a stall is not
a resting place: BullMQ moves a stalled job straight back to waiting, so in our
history it shows up as a SECOND `processing` event by a different worker, which
is exactly what Experiment D needs to see).

Which transitions are legal is enforced in application code (Step 8), not by the
database: the CHECK constraint only guarantees the value is one of the four.

## Designed for Experiment D

When a worker's event loop is blocked, BullMQ cannot renew its lock, a second
worker takes the same job, and the video is transcoded twice. With this schema
the evidence is a plain query: one job, two `processing` events, two different
`worker_id`s:

```sql
SELECT j.id, count(DISTINCT e.worker_id) AS workers
FROM jobs j
JOIN job_events e ON e.job_id = j.id AND e.to_status = 'processing'
GROUP BY j.id
HAVING count(DISTINCT e.worker_id) > 1;
```

Tested in Step 3 against a hand-simulated Experiment D in a throwaway database
(worker A stalls, worker B takes over, both finish): the query returned the job
with `workers = 2`. The same test confirmed every constraint above rejects bad
rows (unknown status, missing video, null filename, duplicate storage key,
negative size, deleting a video that still has a job).

## Decisions

| Decision | Alternative | Why this one |
|---|---|---|
| `uuid` keys | `bigint` auto-increment | ids appear in URLs; sequential numbers let anyone guess other jobs and count our traffic; uuids can be made before the insert |
| `uuidv7()` (new in Postgres 18) | `gen_random_uuid()` (v4, fully random) | v7 starts with a timestamp, so new ids land at the end of the index instead of at random places in it |
| `status` as `text` + `CHECK` | a Postgres `ENUM` type; a lookup table | a CHECK is changed with one migration; enum values cannot be removed or renamed easily; a lookup table is a join for four fixed words |
| current state in `jobs` AND history in `job_events` | history only, derive the state from the latest event ("event sourcing") | "list all queued jobs" stays a simple, indexable query; the two are kept in step by a transaction (Step 8) |
| `job_events` append-only | update rows in place | history that can be rewritten is not evidence |
| foreign keys without `ON DELETE CASCADE` | cascade deletes | deleting a video must not silently erase the history that proves Experiment D; you must delete deliberately, children first |
| `timestamptz` | `timestamp` (without time zone) | `timestamptz` stores an exact instant; plain `timestamp` stores wall-clock digits with no zone, which goes wrong as soon as two machines disagree on the zone |
| `text` | `varchar(255)` | in Postgres they are stored the same way; the 255 is an arbitrary limit that only causes errors |

## Left out on purpose (each arrives with the phase that needs it)

- Video metadata from ffprobe (duration, resolution, codecs): Phase 5.
- Renditions and output locations (720p / 480p playlists): Phase 6.
- A content hash of the upload: Phase 4 / Experiment C.
- Preventing two jobs for the same video (idempotency): Phase 10.
- Progress percentage: lives in Redis, not Postgres (Phase 8). It changes many
  times per second; writing that to the database would be the wrong tool.
