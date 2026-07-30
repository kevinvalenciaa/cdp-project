import { cn } from "@/lib/utils";

/**
 * The workspace this session is scoped to.
 *
 * Rendered as static identity rather than a switcher: there is exactly one workspace,
 * and a chevron that opens nothing is a worse affordance than no chevron.
 */
export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "mb-2 flex items-center rounded-md py-2 text-left",
        collapsed ? "mx-2 justify-center px-0" : "mx-3 w-[calc(100%-1.5rem)] gap-2 px-2.5",
      )}
      aria-label={collapsed ? "Fashion Retailer — Production workspace" : undefined}
      title={collapsed ? "Fashion Retailer — Production workspace" : undefined}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-ht-green-accent/20 text-[11px] font-semibold text-ht-green-accent">
        FR
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-sidebar-foreground">Fashion Retailer</span>
          <span className="block truncate text-[11px] text-sidebar-foreground/50">Production workspace</span>
        </span>
      )}
    </div>
  );
}
