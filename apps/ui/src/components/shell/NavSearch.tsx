"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Command, Search } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { BOTTOM_ITEMS, NAV_GROUPS } from "./nav-items";

/**
 * Quick actions rail entry plus its ⌘K palette. Both read from NAV_GROUPS, so
 * the palette can never drift out of sync with the rail it mirrors.
 */
export function NavSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const groups = [
    ...NAV_GROUPS.map((group, index) => ({
      label: group.label ?? "Go to",
      items: group.items,
      key: group.label ?? `group-${index}`,
    })),
    {
      label: "Workspace",
      key: "workspace",
      items: [...BOTTOM_ITEMS, { href: "/how-it-works", label: "Docs & support", icon: BookOpen }],
    },
  ];

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="w-full cursor-pointer rounded-lg border border-border bg-white py-4.5 hover:border-neutral-300 hover:bg-neutral-100"
                onClick={() => setOpen(true)}
                tooltip="Quick actions"
              >
                <Search aria-hidden />
                <span className="text-[15px] text-neutral-500">Quick actions</span>
                <span className="ml-auto flex items-center">
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center justify-center gap-0.5 rounded-md border border-neutral-300 px-1.5 font-mono text-[13px] font-medium text-neutral-500">
                    <Command className="size-3.5" aria-hidden />
                    <span className="text-[13px] font-light text-neutral-500">K</span>
                  </kbd>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <CommandDialog open={open} onOpenChange={setOpen} title="Quick actions" description="Jump to any part of the workspace.">
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {groups.map((group, index) => (
            <div key={group.key}>
              <CommandGroup heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                    <item.icon aria-hidden />
                    <span>{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {index < groups.length - 1 && <CommandSeparator />}
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
