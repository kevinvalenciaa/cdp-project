import { Activity, Inbox, Rocket, Brain, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Opportunities", icon: Inbox },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/launched", label: "Launched", icon: Rocket },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/settings", label: "Settings", icon: Settings },
];
