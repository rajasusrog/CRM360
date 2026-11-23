/** Isolated Supabase schema and storage bucket for the CRM application. */
export const CRM_SCHEMA = "crmpro" as const;
export const CRM_STORAGE_BUCKET = "crmpro_documents" as const;

/** Shared untyped database generic matching Supabase's default while scoping queries to CRM_SCHEMA. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CrmDatabase = any;

/** Shared cookie name so the browser and the server read the same session. */
export const supabaseCookieOptions = { name: "sb-unikorn360-auth" };
