import { Rag, RagTenancy, SqliteFtsConnector, type SqliteFtsOptions } from "@agboss/core/rag";
import { InjectionToken } from "@agboss/core";

/** Where the notes are and where their index lives. */
export const NOTES_INDEX = new InjectionToken<SqliteFtsOptions>("NOTES_INDEX");

/**
 * The user's notes about companies — the reference full-text connector (SQLite FTS5, BM25). Per
 * tenant (agbossjs/agboss#796): the connector keys every chunk by the tenant, so each tenant
 * indexes and reads its own copy (one tenant here, `default`: the application declares no tenant
 * context).
 */
@Rag({
  name: "company-notes-rag",
  description: "The user's notes about companies: stack, culture, what people say",
  tenancy: RagTenancy.PerTenant,
  topK: 3,
  deps: [NOTES_INDEX],
})
export class CompanyNotes extends SqliteFtsConnector {}
