"use client";

import { useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const EMPTY_VALUE = "__worship_flow_empty__";

type ProductionSelectProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  label?: string;
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  name?: string;
};

export function ProductionSelect<T extends string>({
  value,
  onValueChange,
  options,
  label,
  ariaLabel,
  className,
  triggerClassName,
  disabled,
  name,
}: ProductionSelectProps<T>) {
  const labelId = useId();

  return (
    <div className={className}>
      {label ? <span id={labelId} className="technical-label mb-1 block">{label}</span> : null}
      <Select
        value={value || EMPTY_VALUE}
        onValueChange={(nextValue) => onValueChange((nextValue === EMPTY_VALUE ? "" : nextValue) as T)}
        disabled={disabled}
        name={name}
      >
        <SelectTrigger
          aria-label={label ? undefined : ariaLabel}
          aria-labelledby={label ? labelId : undefined}
          className={cn(
            "h-10 w-full border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 text-[var(--text-primary)] hover:bg-[var(--surface-panel-strong)]",
            triggerClassName,
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          className="border border-[var(--border-default)] bg-[var(--surface-panel-elevated)] p-1.5 shadow-[var(--elevation-raised)]"
        >
          {options.map((option) => (
            <SelectItem
              key={option.value || EMPTY_VALUE}
              value={option.value || EMPTY_VALUE}
              className="min-h-9 px-2 py-2 pr-8 font-medium"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
