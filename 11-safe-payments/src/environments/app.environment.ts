/**
 * What the shop's own repositories read: the SQLite file they share with the framework's stores
 * (`SqliteConnection` declares it as a field of the contract — the same `SQLITE_PATH` the storage's driver reads).
 */
export class AppEnvironment {
  sqlitePath!: string;
}
