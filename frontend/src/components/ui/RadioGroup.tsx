import * as React from "react";
import { cn } from "@/lib/utils";

interface RadioCardGroupProps {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function RadioCardGroup({ value, onChange, children, className }: RadioCardGroupProps) {
  return (
    <div className={cn("grid gap-4", className)} role="radiogroup">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          const props = child.props as { value: string };
          return React.cloneElement(child as React.ReactElement<{ checked: boolean; onChange: () => void } & React.HTMLAttributes<HTMLElement>>, {
            checked: props.value === value,
            onChange: () => onChange(props.value),
          });
        }
        return child;
      })}
    </div>
  );
}

interface RadioCardProps {
  value: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  checked?: boolean;
  onChange?: () => void;
  children?: React.ReactNode;
}

export function RadioCard({ value, title, description, icon, checked, onChange, children }: RadioCardProps) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer flex-col rounded-xl border p-3 transition-all hover:bg-[#8e8e93]/10",
        checked
          ? "border-accent-blue bg-accent-blue/10"
          : "border-border bg-input-bg"
      )}
    >
      <input
        type="radio"
        className="sr-only"
        value={value}
        checked={checked}
        onChange={onChange}
      />
      {icon ? (
        <div className="flex flex-col h-full justify-between gap-3">
             <div className={cn("mb-1", checked ? "text-accent-blue" : "text-text-primary")}>
                {icon}
             </div>
             <div className="space-y-1">
                <span
                    className={cn(
                    "block text-base font-semibold leading-none",
                    checked ? "text-accent-blue" : "text-text-primary"
                    )}
                >
                    {title}
                </span>
                {description && (
                    <span className="block text-sm text-text-secondary">
                    {description}
                    </span>
                )}
                {children}
            </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
            <div
            className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
                checked
                ? "border-accent-blue"
                : "border-text-tertiary"
            )}
            >
            {checked && <div className="h-2.5 w-2.5 rounded-full bg-accent-blue" />}
            </div>
            <div className="flex-1 space-y-1">
            <span
                className={cn(
                "block text-[15px] font-semibold leading-none",
                checked ? "text-accent-blue" : "text-text-primary"
                )}
            >
                {title}
            </span>
            {description && (
                <span className="block text-sm text-text-secondary">
                {description}
                </span>
            )}
            {children}
            </div>
        </div>
      )}
    </label>
  );
}
