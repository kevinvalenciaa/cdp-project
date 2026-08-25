import {
  Activity,
  BarChart3,
  LayoutDashboard,
  MessageSquareText,
  Rocket,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Customer Studio",
    items: [
      { href: "/opportunities", label: "Opportunities", icon: Sparkles },
      { href: "/investigations", label: "Investigations", icon: MessageSquareText },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    label: "AI Decisioning",
    items: [
      { href: "/launched", label: "Launched", icon: Rocket },
      { href: "/memory", label: "Insights", icon: BarChart3 },
    ],
  },
];

export const BOTTOM_ITEMS: NavItem[] = [{ href: "/settings", label: "Settings", icon: Settings }];
