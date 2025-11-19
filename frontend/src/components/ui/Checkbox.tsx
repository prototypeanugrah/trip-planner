import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label className="flex cursor-pointer items-center gap-3 group">
        <div className="relative flex items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            ref={ref}
            {...props}
          />
          <div
            className={cn(
              "h-5 w-5 rounded-md border-2 border-text-tertiary bg-transparent transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-accent-blue peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-primary peer-checked:border-accent-blue peer-checked:bg-accent-blue group-hover:border-text-secondary",
              className
            )}
          >
            <Check className="h-4 w-4 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
          </div>
        </div>
        {label && (
          <span className="text-[15px] font-medium text-text-primary select-none">
            {label}
          </span>
        )}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };

