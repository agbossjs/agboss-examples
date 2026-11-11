/** The local twin's settings: one SQLite file in place of MongoDB and Redis. */
export class LocalEnvironment {
  /** The stores' SQLite file (`:memory:` in tests). */
  sqlitePath!: string;
}
