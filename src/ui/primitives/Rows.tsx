/*
 * Settings rows (src/styles/primitives/rows.css): group label + surface-1 card of rows,
 * desktop section nav, TV description panel.
 *
 * <SettingsGroup label="Playback">
 *   <SettingsRow icon={<CirclePlay/>} title="Playback preferences" note="Audio, subtitles and quality" onClick={…}/>
 *   <SettingsRow icon={<Info/>} title="About VIPTV" value="Version 0.1.0" chevron={false}/>
 * </SettingsGroup>
 * On TV wrap the content in the remote-aware button instead:
 *   <TvButton id="settings-playback" className="vx-settings-row" onActivate={…}>
 *     <SettingsRowContent icon={…} title="Playback preferences"/></TvButton>
 * Toggle rows: no chevron; pass the switch as `end` (or make the row itself role="switch").
 */
import { ChevronRight } from "lucide-react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export function SettingsGroup({ label, labelId, children, className }: { label?: ReactNode; labelId?: string; children: ReactNode; className?: string }) {
  return (
    <section className={join("vx-settings-group", className)} aria-labelledby={label ? labelId : undefined}>
      {label ? <h2 className="vx-settings-group__label" id={labelId}>{label}</h2> : null}
      <div className="vx-settings-card">{children}</div>
    </section>
  );
}

export type SettingsRowContentProps = {
  icon?: ReactNode;
  title: ReactNode;
  note?: ReactNode;
  value?: ReactNode;
  /** Trailing control (a switch) or extra content before the chevron. */
  end?: ReactNode;
  /** Defaults to true unless the row is destructive or has an `end` control. */
  chevron?: boolean;
  danger?: boolean;
};

export function SettingsRowContent({ icon, title, note, value, end, chevron, danger }: SettingsRowContentProps) {
  const showChevron = chevron ?? (!danger && !end);
  return (
    <>
      {icon ? <span className="vx-settings-row__icon" aria-hidden="true">{icon}</span> : null}
      <span className="vx-settings-row__text">
        <span className="vx-settings-row__title">{title}</span>
        {note ? <span className="vx-settings-row__note">{note}</span> : null}
      </span>
      {value || end || showChevron ? (
        <span className="vx-settings-row__end">
          {value ? <span className="vx-settings-row__value">{value}</span> : null}
          {end}
          {showChevron ? <ChevronRight className="vx-settings-row__chevron" strokeWidth={2.2} aria-hidden="true" /> : null}
        </span>
      ) : null}
    </>
  );
}

type RowBase = SettingsRowContentProps & { className?: string };
type RowAsButton = RowBase & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "value"> & { href?: undefined; as?: "button" };
type RowAsLink = RowBase & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "title"> & { href: string; as?: "a" };
type RowAsDiv = RowBase & Omit<HTMLAttributes<HTMLDivElement>, "title"> & { as: "div"; href?: undefined };

/** A settings row as a <button> (default), an <a href> or a static <div> (toggle rows that hold a switch). */
export function SettingsRow(props: RowAsButton | RowAsLink | RowAsDiv) {
  const { icon, title, note, value, end, chevron, danger, className, ...rest } = props;
  const classes = join("vx-settings-row", danger && "vx-settings-row--danger", className);
  const content = <SettingsRowContent icon={icon} title={title} note={note} value={value} end={end} chevron={chevron} danger={danger} />;
  if (rest.as === "div") {
    const { as: _as, ...div } = rest as Omit<RowAsDiv, keyof RowBase>;
    return <div {...div} className={classes}>{content}</div>;
  }
  if (typeof rest.href === "string") {
    const { as: _as, ...anchor } = rest as Omit<RowAsLink, keyof RowBase>;
    return <a {...anchor} className={classes}>{content}</a>;
  }
  const { as: _as, ...button } = rest as Omit<RowAsButton, keyof RowBase>;
  return <button type="button" {...button} className={classes}>{content}</button>;
}

/* Desktop settings section nav. */
export function SectionNav({ label = "Settings", children, className }: { label?: string; children: ReactNode; className?: string }) {
  return <nav className={join("vx-section-nav", className)} aria-label={label}>{children}</nav>;
}

export function SectionNavLabel({ children }: { children: ReactNode }) {
  return <span className="vx-section-nav__label">{children}</span>;
}

type NavItemProps = { icon?: ReactNode; current?: boolean; danger?: boolean; children: ReactNode; className?: string };
export function SectionNavItem({ icon, current, danger, children, className, ...rest }: NavItemProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children">) {
  return (
    <a {...rest} className={join("vx-section-nav__item", danger && "vx-section-nav__item--danger", className)} aria-current={current ? "page" : undefined}>
      {icon}
      {children}
    </a>
  );
}

/* TV description panel: explains the focused settings row. */
export function TvDescription({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <aside className={join("vx-tv-description", className)} aria-live="polite">
      <h2 className="vx-tv-description__title">{title}</h2>
      {children ? <p className="vx-tv-description__text">{children}</p> : null}
    </aside>
  );
}
