import Link from "next/link";
import { datasetHref } from "@/lib/datasets/routes";
import type { DatasetDef } from "@/lib/datasets/types";
import { textLink } from "./link-styles";

/**
 * A line under a dataset's view strip that points to its "Things to know"
 * (the caveats on the dataset's own page), so they are one click from the
 * figures. It renders nothing for a dataset with no caveats.
 */
export function CaveatsLink({ dataset }: { dataset: DatasetDef }) {
  if (!dataset.caveats || dataset.caveats.length === 0) return null;
  return (
    <p className="mb-6 text-sm text-muted">
      Reporting changes and other limits affect these figures.{" "}
      <Link href={`${datasetHref(dataset)}#things-to-know`} className={textLink}>
        Read the things to know
      </Link>
      .
    </p>
  );
}
