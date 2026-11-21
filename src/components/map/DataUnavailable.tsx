/**
 * Shown instead of the map and the table when the figures can't be loaded
 * (`error`) or the database has none yet (`empty`). The page around it
 * stays intact.
 */
export function DataUnavailable({ reason }: { reason: "error" | "empty" }) {
  return (
    <div
      role="status"
      className="rounded-md border border-line bg-surface p-6 text-center"
    >
      <p className="font-medium">
        {reason === "error" ? "Data unavailable" : "No data yet"}
      </p>
      <p className="mt-1 text-muted">
        {reason === "error"
          ? "The latest figures can’t be loaded at the moment. Please try again later."
          : "There’s no data to show yet."}
      </p>
    </div>
  );
}
