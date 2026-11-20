import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";

/**
 * Health check. Confirms that the database is reachable and returns the
 * PostGIS version. On failure it returns a generic error, never connection
 * details.
 */
export async function GET() {
  // Wait for a real request, so the database is never queried during the build.
  await connection();
  try {
    const result = await getDb().execute<{ version: string }>(
      sql`select postgis_lib_version() as version`,
    );
    return Response.json(
      { status: "ok", postgis: result.rows[0].version },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Health check failed:", error);
    return Response.json(
      { status: "error", message: "Database unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
