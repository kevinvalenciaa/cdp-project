import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The reference system's filled call-to-action is a radial gradient with an
 * inset top highlight and a 1px colour ring - not a flat fill. Proofloop's
 * primary CTA is teal, so the gradient stops are the teal ramp:
 * oklch(0.6544 …) → oklch(0.4544 …) around the #007A92 primary.
 *
 * Note the variant mapping. In the reference, `default` is text-only and the
 * filled CTA is `special`. Proofloop's existing call sites expect `default` to
 * be filled, so `default` carries the gradient here and the text-only style is
 * exposed as `plain`. `special` stays available as an explicit alias for the
 * places that read better naming it (the composer send button).
 */
const GRADIENT_CTA =
  "bg-[radial-gradient(228.59%_228.57%_at_50%_0%,_oklch(0.6544_0.0956_218.6)_0%,_oklch(0.4544_0.0956_218.6)_100%)] text-primary-foreground shadow-[0px_0.75px_0px_0px_rgba(255,255,255,0.20)_inset,0px_1px_2px_0px_rgba(0,0,0,0.40),0px_0px_0px_1px_oklch(0.5044_0.0956_218.6)] transition-colors hover:brightness-110";

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: GRADIENT_CTA,
        special: GRADIENT_CTA,
        plain: "text-foreground hover:text-foreground/80",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        destructiveOutline:
          "border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/30",
        outline:
          "border border-border bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-12 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        data-slot="button"
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
