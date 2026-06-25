import { ChevronsUpDown } from "lucide-react";

/** Workspace switcher in the rail (visual — mirrors Hightouch's app). */
export function WorkspaceSwitcher() {
  return (
    <button
      type="button"
      className="mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent/60"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-ht-green-accent/20 text-[11px] font-semibold text-ht-green-accent">
        FR
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-sidebar-foreground">Fashion Retailer</span>
        <span className="block truncate text-[11px] text-sidebar-foreground/50">Production workspace</span>
      </span>
      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" aria-hidden />
    </button>
  );
}
