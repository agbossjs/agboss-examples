import { InjectionToken, Rag, SqliteFtsConnector, type FtsOptions } from "graphcompose";

/** Where the notes are and where their index lives. */
export const NOTES_INDEX = new InjectionToken<FtsOptions>("NOTES_INDEX");

/** The user's notes about companies — the reference full-text connector (SQLite FTS5, BM25). */
@Rag({
  name: "company_notes",
  description: "The user's notes about companies: stack, culture, what people say",
  k: 3,
  deps: [NOTES_INDEX],
})
export class CompanyNotes extends SqliteFtsConnector {}
