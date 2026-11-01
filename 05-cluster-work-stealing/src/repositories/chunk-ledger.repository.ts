import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { Injectable, SqliteConnection } from "@agboss/core";

/** The DDL of the ledger's table, applied once per connection. */
const SCHEMA: string = readFileSync(new URL("../sql/chunk-commits.sql", import.meta.url), "utf8");

/** What a chunk's commit writes: the chunk, the worker's summary, the step that committed it. */
export interface ChunkCommit {
  readonly chunkId: string;
  readonly summary: string;
  readonly stepKey: string;
}

/** One row of the ledger: a commit and its number. */
export interface ChunkCommitRow extends ChunkCommit {
  readonly commitNumber: number;
}

/** A row read back from SQLite, checked field by field. */
function commitRowOf(row: Record<string, unknown> | undefined): ChunkCommitRow {
  const { commitNumber, chunkId, summary, stepKey } = row ?? {};
  if (
    typeof commitNumber !== "number" ||
    typeof chunkId !== "string" ||
    typeof summary !== "string" ||
    typeof stepKey !== "string"
  )
    throw new Error("chunk_commits: a row without its number, chunk, summary or step key");
  return { commitNumber, chunkId, summary, stepKey };
}

/**
 * The cluster's books of committed chunks, in the application's SQLite file — the file every
 * instance shares. `recordCommit` writes one row on the database a fenced effect gives it
 * (`SqliteFencedEffectRepository`, #500): synchronously, inside the effect's transaction, so the
 * row and the effect's stored result commit together. A worker that lost its lease is refused
 * before it writes; a chunk committed again replays the first commit. The ledger keeps no
 * idempotency key and no fencing table of its own.
 */
@Injectable({ deps: [SqliteConnection] })
export class ChunkLedgerRepository {
  constructor(private readonly sqliteConnection: SqliteConnection) {
    sqliteConnection.ensureSchema("chunk-commits", SCHEMA);
  }

  /** One commit, written in the effect's transaction. */
  recordCommit(database: DatabaseSync, commit: ChunkCommit): ChunkCommitRow {
    const { lastInsertRowid } = database
      .prepare("INSERT INTO chunk_commits (chunk_id, summary, step_key) VALUES (?, ?, ?)")
      .run(commit.chunkId, commit.summary, commit.stepKey);
    return { ...commit, commitNumber: Number(lastInsertRowid) };
  }

  /** Every commit, oldest first. */
  commits(): readonly ChunkCommitRow[] {
    return this.sqliteConnection.database
      .prepare(
        "SELECT commit_number AS commitNumber, chunk_id AS chunkId, summary, step_key AS stepKey " +
          "FROM chunk_commits ORDER BY commit_number",
      )
      .all()
      .map(commitRowOf);
  }
}
