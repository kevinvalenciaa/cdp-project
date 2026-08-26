import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared fallback for the app routes. It mirrors the real page chrome - a bordered
 * header block, then content - so navigation does not visibly reflow when the page
 * lands. The previous version skipped the header entirely, which made every route
 * change jump.
 */
export default function Loading() {
  return (
    <>
      <div className="min-h-24 border-b border-border bg-card/70 px-5 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div className="app-page">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </>
  );
}
