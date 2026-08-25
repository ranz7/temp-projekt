import { sql } from 'drizzle-orm'

/**
 * SQL expression generating a UUIDv7 primary key.
 * Defined by migration `0000__uuid_v7.sql`. Application code never invents entity ids.
 */
export const uuidv7 = sql`uuid_generate_v7()`
