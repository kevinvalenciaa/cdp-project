import * as React from "react";

import { cn } from "@/lib/utils";

interface InputProps extends React.ComponentProps<"input"> {
  suffix?: React.ReactNode;
  containerClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, containerClassName, type, suffix, ...props }, ref) => (
    <div className={cn("relative flex w-full items-center", containerClassName)}>
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "flex h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          suffix && "pr-10",
          className,
        )}
        {...props}
      />
      {suffix && (
        <div className="absolute right-1 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center">{suffix}</div>
      )}
    </div>
  ),
);
Input.displayName = "Input";

export { Input };
