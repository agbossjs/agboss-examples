-- One row per committed chunk: the cluster's books of finished work (05-cluster-work-stealing).
-- No idempotency key and no fencing token here: the fenced effect (#500) keeps those, in the
-- same transaction as this row.
CREATE TABLE IF NOT EXISTS chunk_commits (
  commit_number INTEGER PRIMARY KEY AUTOINCREMENT,
  chunk_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  step_key TEXT NOT NULL
);
