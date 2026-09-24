/*
 * Overlay shells (src/styles/primitives/overlays.css). One markup renders as a phone bottom
 * sheet, a desktop centred dialog / right drawer, or a TV right panel.
 *
 * <Overlay onScrimClick={close}>          mount inside the desktop body row (under the title
 *   <Dialog title="Sign out of this device?" onClose={close}      bar, beside the rail) so the
 *     actions={<>…buttons…</>}>…</Dialog></Overlay>                scrim leaves them bright.
 * Buttons stay the caller's: plain <button className="vx-btn"> on phone / desktop, TvButton on TV
 * (remote activation). Cancel is neutral and gets default focus on desktop and TV.
 * The shells are presentational: focus entry / return and Esc / BACK stay with the owner
 * (RemoteRoot already routes Escape and BACK to onBack).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { KeyLegend, type LegendItem } from "./Keys";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export function Overlay({ children, onScrimClick, fixed, scrim = "default", className }: {
  children: ReactNode;
  onScrimClick?: () => void;
  /** position: fixed instead of absolute over the containing block. */
  fixed?: boolean;
  /** "fullscreen" = TV 0.94 cover (text panel); "solid" = opaque ground (TV text entry); "none". */
  scrim?: "default" | "fullscreen" | "solid" | "none";
  className?: string;
}) {
  return (
    <div className={join("vx-overlay", fixed && "vx-overlay--fixed", className)}>
      {scrim === "none" ? null : (
        <div className={join("vx-scrim", scrim === "fullscreen" && "vx-scrim--fullscreen", scrim === "solid" && "vx-scrim--solid")} aria-hidden="true" onClick={onScrimClick} />
      )}
      {children}
    </div>
  );
}

let dialogCount = 0;
function useStableId(prefix: string, given?: string) {
  const ref = useRef<string>();
  if (!ref.current) ref.current = given ?? `${prefix}-${++dialogCount}`;
  return given ?? ref.current;
}

export type DialogProps = {
  title: ReactNode;
  titleId?: string;
  /** Right of the title (phone list sheet: "12 sources"). */
  meta?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  /** "drawer": phone tall sheet / desktop right drawer / TV panel with head, tools, scroll, footer. */
  variant?: "dialog" | "drawer";
  role?: "dialog" | "alertdialog";
  /** Drawer: under the header (status line). */
  head?: ReactNode;
  /** Drawer: chips row. */
  tools?: ReactNode;
  /** Drawer: kbd hints footer (desktop only). */
  footer?: ReactNode;
  /** Stacked actions (phone 54, desktop 48, TV 80 rows). */
  actions?: ReactNode;
  /** TV key legend inside the panel. */
  legend?: LegendItem[];
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Dialog({ title, titleId, meta, onClose, closeLabel = "Close", variant = "dialog", role = "dialog", head, tools, footer, actions, legend, children, className, style }: DialogProps) {
  const id = useStableId("vx-dialog-title", titleId);
  const drawer = variant === "drawer";
  const header = (
    <div className="vx-dialog__header">
      <h2 className="vx-dialog__title" id={id}>{title}</h2>
      {meta ? <span className="vx-dialog__meta">{meta}</span> : null}
      {onClose ? (
        <button type="button" className="vx-close" aria-label={closeLabel} onClick={onClose}>
          <X aria-hidden="true" strokeWidth={2.2} />
        </button>
      ) : null}
    </div>
  );
  return (
    <section className={join("vx-dialog", drawer && "vx-dialog--drawer", className)} role={role} aria-modal="true" aria-labelledby={id} tabIndex={-1} style={style}>
      {onClose ? (
        <button type="button" className="vx-dialog__grabber" aria-label={closeLabel} onClick={onClose}><span /></button>
      ) : null}
      {drawer ? (
        <>
          <div className="vx-dialog__head">{header}{head}</div>
          {tools ? <div className="vx-dialog__tools">{tools}</div> : null}
          <div className="vx-dialog__scroll">{children}</div>
          {actions ? <div className="vx-dialog__actions">{actions}</div> : null}
          {footer ? <div className="vx-dialog__footer">{footer}</div> : null}
        </>
      ) : (
        <>
          {header}
          {children}
          {actions ? <div className="vx-dialog__actions">{actions}</div> : null}
        </>
      )}
      {legend ? <KeyLegend items={legend} corner /> : null}
    </section>
  );
}

/** Body copy inside a dialog; `detail` = pre-line body text (Source details). */
export function DialogText({ children, detail }: { children: ReactNode; detail?: boolean }) {
  return <p className={join("vx-dialog__text", detail && "vx-dialog__text--detail")}>{children}</p>;
}

export function Menu({ children, label, role = "menu", className }: { children: ReactNode; label?: string; role?: "menu" | "listbox" | "group"; className?: string }) {
  return <div className={join("vx-menu", className)} role={role} aria-label={label}>{children}</div>;
}

export type MenuItemContentProps = { icon?: ReactNode; children: ReactNode; note?: ReactNode; current?: boolean; currentLabel?: string };

export function MenuItemContent({ icon, children, note, current, currentLabel = "Current" }: MenuItemContentProps) {
  return (
    <>
      {icon ? <span className="vx-menu__icon" aria-hidden="true">{icon}</span> : null}
      <span className="vx-menu__label">
        <span>{children}</span>
        {note ? <span className="vx-menu__note">{note}</span> : null}
      </span>
      {current ? <span className="vx-menu__current"><Check aria-hidden="true" strokeWidth={2.4} />{currentLabel}</span> : null}
    </>
  );
}

/** A menu row as a <button>. On TV use TvButton with className="vx-menu__item" + MenuItemContent. */
export function MenuItem({ icon, children, note, current, currentLabel, danger, className, role = "menuitem", ...rest }: MenuItemContentProps & { danger?: boolean; role?: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button type="button" role={role} {...rest} className={join("vx-menu__item", danger && "vx-menu__item--danger", className)} aria-current={current ? "true" : undefined}>
      <MenuItemContent icon={icon} note={note} current={current} currentLabel={currentLabel}>{children}</MenuItemContent>
    </button>
  );
}

/** Anchored popover (desktop): no scrim; the owner positions it with `style` (top / left). */
export function Popover({ label, children, style, className, id, role = "menu" }: { label?: ReactNode; children: ReactNode; style?: CSSProperties; className?: string; id?: string; role?: string }) {
  return (
    <div className={join("vx-popover", className)} role={role} id={id} style={style}>
      {label ? <div className="vx-popover__label" aria-hidden="true">{label}</div> : null}
      {children}
    </div>
  );
}

/**
 * TV full-screen text panel (More info, Source details): an opaque surface-1 box that scrolls
 * with ▲▼ while focused; at either end the arrow falls through to the remote (focus moves on,
 * e.g. down to Close). Give the box a focus id so the D-pad reaches it.
 */
export function TvTextPanel({ title, titleId, meta, children, actions, boxLabel, boxFocusId, boxProps, legend = [{ key: "▲ ▼", label: "Scroll" }, { key: "BACK", label: "Close" }], className }: {
  title: ReactNode;
  titleId?: string;
  meta?: ReactNode;
  /** Paragraphs (<p>) of the long text. */
  children: ReactNode;
  actions?: ReactNode;
  boxLabel?: string;
  boxFocusId?: string;
  /** Extra attributes for the scroll box (e.g. data-nav-down to reach Close). */
  boxProps?: HTMLAttributes<HTMLDivElement> & { [data: `data-${string}`]: string | undefined };
  legend?: LegendItem[];
  className?: string;
}) {
  const id = useStableId("vx-text-panel-title", titleId);
  const content = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);
  const measure = () => {
    const element = content.current;
    if (!element || element.scrollHeight <= element.clientHeight + 1) return setThumb(null);
    const track = element.clientHeight;
    const height = Math.max(track * 0.15, (element.clientHeight / element.scrollHeight) * track);
    const top = (element.scrollTop / (element.scrollHeight - element.clientHeight)) * (track - height);
    setThumb({ top, height });
  };
  useLayoutEffect(measure, [children]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const element = content.current;
    if (!element || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    const down = event.key === "ArrowDown";
    const room = down ? element.scrollHeight - element.clientHeight - element.scrollTop : element.scrollTop;
    if (room <= 1) return; // at the end: let the remote move focus
    event.preventDefault();
    event.stopPropagation();
    element.scrollTop += (down ? 1 : -1) * Math.min(room, Math.round(element.clientHeight * 0.4));
    measure();
  };
  return (
    <>
      <section className={join("vx-text-panel", className)} role="dialog" aria-modal="true" aria-labelledby={id}>
        <h2 className="vx-text-panel__title" id={id}>{title}</h2>
        {meta ? <div className="vx-text-panel__meta">{meta}</div> : null}
        <div {...boxProps} className="vx-text-panel__box" tabIndex={0} data-focus-id={boxFocusId} aria-label={boxLabel} onKeyDown={onKeyDown}>
          <div className="vx-text-panel__content" ref={content} onScroll={measure}>{children}</div>
          <span
            className="vx-text-panel__bar"
            aria-hidden="true"
            style={thumb ? { transform: `translateY(${Math.round(thumb.top)}px)`, height: Math.round(thumb.height) } : undefined}
          />
        </div>
        {actions ? <div className="vx-text-panel__actions">{actions}</div> : null}
      </section>
      <KeyLegend items={legend} corner />
    </>
  );
}

/** TV full-screen text entry: field (left) + on-screen keyboard or PIN keypad (right). */
export function TvTextEntry({ title, titleId, field, hint, count, keys, digits, legend = [{ key: "OK", label: "Type" }, { key: "BACK", label: "Delete" }, { key: "▶▶", label: "Done" }], className }: {
  title: ReactNode;
  titleId?: string;
  field: ReactNode;
  hint?: ReactNode;
  count?: ReactNode;
  keys: ReactNode;
  digits?: boolean;
  legend?: LegendItem[];
  className?: string;
}) {
  const id = useStableId("vx-entry-title", titleId);
  return (
    <>
      <section className={join("vx-tv-entry", digits && "vx-tv-entry--digits", className)} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="vx-tv-entry__main">
          <h2 className="vx-tv-entry__title" id={id}>{title}</h2>
          {field}
          {hint || count ? (
            <div className="vx-tv-entry__hints">
              <span>{hint}</span>
              {count ? <span className="vx-tv-entry__count">{count}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="vx-tv-entry__keys">{keys}</div>
      </section>
      <KeyLegend items={legend} corner />
    </>
  );
}
