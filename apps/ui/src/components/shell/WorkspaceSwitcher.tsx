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
        "mb-2 flex items-center rounded-md py-2 text-left",
        collapsed ? "mx-2 justify-center px-0" : "mx-3 w-[calc(100%-1.5rem)] gap-2 px-2.5",
      )}
      aria-label={collapsed ? `${name} workspace` : undefined}
      title={collapsed ? `${name} workspace` : undefined}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-ht-green-accent/20 text-[11px] font-semibold text-ht-green-accent">
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
            className="block w-full truncate bg-transparent text-[13px] font-medium text-sidebar-foreground outline-none"
          >
            {workspaces.length === 0 && <option value="">Fashion Retailer</option>}
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <span className="block truncate text-[11px] capitalize text-sidebar-foreground/50">
            {selected?.role ?? "owner"} workspace
          </span>
        </span>
      )}
    </div>
  );
}
