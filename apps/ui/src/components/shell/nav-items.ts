import { Activity, BarChart3, Home, Rocket, Settings, Sparkles, type LucideIcon } from "lucide-react";

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
  { items: [{ href: "/", label: "Home", icon: Home }] },
  {
    label: "Customer Studio",
    items: [
      { href: "/opportunities", label: "Opportunities", icon: Sparkles },
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
