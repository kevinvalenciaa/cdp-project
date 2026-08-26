import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#e9eef5] p-6">
      <div className="flex max-w-md flex-col items-center rounded-[24px] border border-white/80 bg-card p-8 text-center shadow-ht-md">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ht-teal-tint text-ht-teal">
          <Compass className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          That page does not exist. The opportunity board is the best place to pick things back up.
        </p>
        <Button asChild className="mt-5">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
}
