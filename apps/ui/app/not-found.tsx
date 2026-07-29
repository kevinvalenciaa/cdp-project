import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Compass className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          That page does not exist. The opportunity board is the best place to pick things back up.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-ht-teal-hover"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
