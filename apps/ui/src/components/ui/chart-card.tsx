"use client";

import type * as React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The standard content panel: a Card with a divided header row. Used by every
 * list/table/chart section so titles, actions and the rule beneath them line up
 * identically across routes.
 */
function ChartCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return <Card className={cn("bg-white shadow-none", className)} {...props} />;
}

function ChartCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    // flex-wrap lets the actions drop below the title on narrow cards rather
    // than overflowing the border.
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border px-6 pb-4",
        className,
      )}
      {...props}
    />
  );
}

function ChartCardTitle({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-1", className)} {...props}>
      {children}
    </div>
  );
}

function ChartCardHeading({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />;
}

function ChartCardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function ChartCardActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />;
}

function ChartCardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-6", className)} {...props} />;
}

export {
  ChartCard,
  ChartCardActions,
  ChartCardContent,
  ChartCardDescription,
  ChartCardHeader,
  ChartCardHeading,
  ChartCardTitle,
};
