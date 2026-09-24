/*
 * Chips and segmented controls (src/styles/primitives/chips.css, components.md §2).
 * Filter chips are toggle buttons (aria-pressed). On TV, style a TvButton with chipClass(...)
 * and render <ChipContent/> inside it.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function chipClass({ dropdown, set, drawer, className }: { dropdown?: boolean; set?: boolean; drawer?: boolean; className?: string } = {}) {
  return ["vx-chip", dropdown ? "vx-chip--dropdown" : "", set ? "vx-chip--set" : "", drawer ? "vx-chip--drawer" : "", className ?? ""].filter(Boolean).join(" ");
}

/** Chip label: "1080p 5" (count), "Genre: Any ⌄" (name + value + chevron), "Year Required ⌄". */
export function ChipContent({ name, children, count, required, requiredLabel = "Required", chevron }: {
  name?: ReactNode; children: ReactNode; count?: ReactNode; required?: boolean; requiredLabel?: ReactNode; chevron?: ReactNode;
}) {
  return (
    <>
      {name ? <span className="vx-chip__key">{name}</span> : null}
      <span>{children}</span>
      {count !== undefined && count !== null ? <span className="vx-chip__count">{count}</span> : null}
      {required ? <span className="vx-chip__tag">{requiredLabel}</span> : null}
      {chevron}
    </>
  );
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

/** Filter chip (toggle). */
export function Chip({ selected, count, drawer, className, children, type = "button", ...rest }: ButtonProps & {
  selected: boolean; count?: ReactNode; drawer?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <button type={type} className={chipClass({ drawer, className })} aria-pressed={selected} {...rest}>
      <ChipContent count={count}>{children}</ChipContent>
    </button>
  );
}

/** Dropdown chip: "Genre: Any ⌄"; set once it has a value ("Genre: [Comedy]"). Opens a popover / sheet. */
export function DropdownChip({ name, value, set, required, requiredLabel, chevron, drawer, className, type = "button", ...rest }: ButtonProps & {
  name?: ReactNode; value: ReactNode; set?: boolean; required?: boolean; requiredLabel?: ReactNode; chevron: ReactNode; drawer?: boolean; className?: string;
}) {
  return (
    <button type={type} className={chipClass({ dropdown: true, set, drawer, className })} aria-haspopup="dialog" {...rest}>
      <ChipContent name={name} required={required} requiredLabel={requiredLabel} chevron={chevron}>{value}</ChipContent>
    </button>
  );
}

/** 1 px vertical hairline between chip groups (type | sort). */
export function ChipDivider() {
  return <span className="vx-chip-divider" aria-hidden="true" />;
}

export type SegmentedItem<T extends string> = { value: T; label: ReactNode };

/** Segmented control: phone full width (44), desktop fits its content (40), drawer 36. */
export function Segmented<T extends string>({ items, value, onChange, label, drawer, className }: {
  items: SegmentedItem<T>[]; value: T; onChange: (value: T) => void; label: string; drawer?: boolean; className?: string;
}) {
  const classes = ["vx-segmented", drawer ? "vx-segmented--drawer" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <div className={classes} role="group" aria-label={label}>
      {items.map((item) => (
        <button key={item.value} type="button" className="vx-segmented__item" aria-pressed={item.value === value} onClick={() => onChange(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
