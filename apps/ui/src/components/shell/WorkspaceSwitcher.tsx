"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorkspaceSummary } from "@/lib/investigations";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const selected = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedId) ?? workspaces[0],
    [selectedId, workspaces],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/workspaces", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { workspaces: WorkspaceSummary[]; selectedWorkspaceId: string } | null) => {
        if (!active || !payload) return;
        setWorkspaces(payload.workspaces);
        setSelectedId(payload.selectedWorkspaceId);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function selectWorkspace(workspaceId: string) {
    setSelectedId(workspaceId);
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    if (response.ok) window.location.reload();
  }

  const name = selected?.name ?? "Fashion Retailer";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "mb-4 flex items-center rounded-2xl border border-sidebar-border bg-card py-3 text-left shadow-ht-xs",
        collapsed ? "mx-3 justify-center px-0" : "mx-4 w-[calc(100%-2rem)] gap-3 px-3",
      )}
      aria-label={collapsed ? `${name} workspace` : undefined}
      title={collapsed ? `${name} workspace` : undefined}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ht-teal-tint text-[11px] font-semibold text-ht-teal">
        {initials || "W"}
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="workspace-select">
            Workspace
          </label>
          <select
            id="workspace-select"
            value={selectedId}
            onChange={(event) => void selectWorkspace(event.target.value)}
            className="block w-full truncate bg-transparent text-[13px] font-semibold text-foreground outline-none"
          >
            {workspaces.length === 0 && <option value="">Fashion Retailer</option>}
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <span className="mt-0.5 block truncate text-[11px] capitalize text-sidebar-foreground/55">
            {selected?.role ?? "owner"} workspace
          </span>
        </span>
      )}
    </div>
  );
}
