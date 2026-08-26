"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, ChevronsUpDown, LogOut, Settings } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import type { WorkspaceSummary } from "@/lib/investigations";

const FALLBACK_WORKSPACE = "Fashion Retailer";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "W"
  );
}

/**
 * Footer identity block: the signed-in account, with workspace switching folded
 * into the same menu. The /api/workspaces read + POST-then-reload flow is
 * carried over unchanged from the standalone switcher this replaces - only the
 * chrome is new.
 */
export function NavUser() {
  const { isMobile } = useSidebar();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [account, setAccount] = useState<{ email: string; role: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const selected = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedId) ?? workspaces[0],
    [selectedId, workspaces],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/workspaces", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          payload: {
            workspaces: WorkspaceSummary[];
            selectedWorkspaceId: string;
            account?: { email: string; role: string };
          } | null,
        ) => {
          if (!active || !payload) return;
          setWorkspaces(payload.workspaces);
          setSelectedId(payload.selectedWorkspaceId);
          setAccount(payload.account ?? null);
        },
      )
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function selectWorkspace(workspaceId: string) {
    setOpen(false);
    setSelectedId(workspaceId);
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    if (response.ok) window.location.reload();
  }

  async function signOut() {
    setSigningOut(true);
    setOpen(false);
    try {
      const { createSupabaseBrowserClient } = await import("@/lib/supabase-browser");
      await createSupabaseBrowserClient().auth.signOut();
    } catch {
      // Not configured (local demo) - fall through to /login either way.
    }
    window.location.assign("/login");
  }

  const workspaceName = selected?.name ?? FALLBACK_WORKSPACE;
  // Render nothing rather than a wrong identity until /api/workspaces answers.
  const accountEmail = account?.email ?? "";
  const accountInitial = accountEmail.trim()[0]?.toUpperCase() ?? "?";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="cursor-pointer hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
              tooltip={accountEmail || workspaceName}
            >
              <Avatar className="size-8 rounded-full">
                <AvatarFallback>{accountInitial}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-semibold text-foreground">{workspaceName}</span>
                <span className="truncate text-[11px] text-sidebar-foreground/65">{accountEmail}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel>Signed in</DropdownMenuLabel>
            <DropdownMenuItem className="gap-2" disabled>
              <Avatar className="size-7">
                <AvatarFallback>{accountInitial}</AvatarFallback>
              </Avatar>
              <span className="truncate text-sm text-foreground">{accountEmail || "Loading…"}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            <DropdownMenuGroup>
              {workspaces.length === 0 && (
                <DropdownMenuItem disabled>
                  <span className="truncate">{FALLBACK_WORKSPACE}</span>
                </DropdownMenuItem>
              )}
              {workspaces.map((workspace) => (
                <DropdownMenuItem key={workspace.id} onSelect={() => void selectWorkspace(workspace.id)}>
                  <Avatar className="size-5">
                    <AvatarFallback className="text-[9px]">{initials(workspace.name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">{workspace.name}</span>
                  <span className="text-[11px] capitalize text-muted-foreground">{workspace.role}</span>
                  {workspace.id === selected?.id && <Check className="size-4 text-primary" strokeWidth={3} aria-hidden />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings aria-hidden />
                  Settings &amp; Guardrails
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/how-it-works">
                  <BookOpen aria-hidden />
                  Docs &amp; support
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={signingOut} onSelect={() => void signOut()}>
                <LogOut aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
