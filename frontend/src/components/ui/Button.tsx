import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={isLoading || props.disabled}
        aria-busy={isLoading}
        aria-label={props["aria-label"] || (isLoading ? "Loading" : undefined)}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-95",
          {
            "bg-accent-blue text-white hover:bg-accent-blue-hover shadow-sm hover:-translate-y-0.5":
              variant === "primary",
            "bg-input-bg text-text-primary hover:bg-bg-tertiary":
              variant === "secondary",
            "hover:bg-bg-tertiary text-text-secondary hover:text-text-primary":
              variant === "ghost",
            "bg-red-500/10 text-red-500 hover:bg-red-500/20": variant === "danger",
            "h-9 px-4 text-sm": size === "sm",
            "h-11 px-6 text-[15px]": size === "md",
            "h-14 px-8 text-lg": size === "lg",
          },
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };

