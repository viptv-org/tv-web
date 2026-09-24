/*
 * App-wide dialogs and feedback (dialogs family; src/styles/screens/dialogs.css):
 * the TV startup cover, "Preparing playback…" / loading indicators, the
 * backend-unreachable banner, error and notice toasts, the Watch on TV shell and
 * the generic modal every setModal request renders through (unless a family
 * renders its own `view`).
 *
 * Reference screens: PhStates / DeskStates / TvStates (app-wide states), and the
 * overlay screens the generic modal draws (Ph/Desk/TvSignOut, Ph/Desk/TvPlayerError,
 * Ph/Desk/TvLiveDetails, PhItemMenuLive, DeskPlayerRestore, Ph/TvDiscoverFilter,
 * TvPlayerSubs, …): phone bottom sheet, desktop centred 460 dialog over the body
 * row (or an anchored popover), TV right panel 820 / full-screen text panel.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, CircleAlert, CloudOff, X } from "lucide-react";
import { TvButton } from "../remote";
import { DialogBackdrop } from "../DialogBackdrop";
import { CastController } from "../CastController";
import { TextEntry } from "../TextEntry";
import { ProfileEditor } from "../ProfileEditor";
import { connectionSummary, type ErrorDetail } from "../errors";
import { usePhoneLayout } from "../usePhoneLayout";
import { KeyLegend, type LegendItem } from "../primitives/Keys";
import { MenuItemContent, TvTextPanel } from "../primitives/Overlays";
import { Banner, Preparing, StartupCover, StatusLine } from "../primitives/Feedback";
import type { Choice, ModalOptions } from "./appShared";
import { isCurrentChoice, isDismissChoice, modalLayout, type ModalRequest } from "./dialogModel";
import type { AppApi } from "./useTvApp";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export function AppDialogs({ app }: { app: AppApi }) {
  const { api, bootingHome, busy, items, responsive, casting, closeCast, connection, editingProfile, entry, error, modal, preparing, profiles, screen, setConnection, setEditingProfile, setEntry, setError, setModal, setProfiles, setStartupAttempt, toast } = app;
  const phone = usePhoneLayout(responsive);
  const startup = screen === "startup";
  // The responsive shell shows skeletons (booting, Discover) and the player its
  // own buffering ring instead of a loading indicator.
  const loading = busy && !preparing && screen !== "sources" && !(responsive && (screen === "player" || screen === "Search" || bootingHome || startup || (screen === "Discover" && !items.length)));
  const dismissError = () => {
    setError("");
    if (startup) setStartupAttempt((attempt) => attempt + 1);
  };
  const banner = connection ? (
    <Banner
      title="Can’t reach the backend"
      titleId="vx-backend-banner-title"
      icon={<CloudOff aria-hidden="true" strokeWidth={2} />}
      meta={connectionSummary(connection)}
      center={!responsive}
      actions={
        <TvButton id="dismiss-error" className="vx-btn" onActivate={() => setConnection(undefined)}>
          Dismiss
        </TvButton>
      }
    >
      The connection was refused, so the backend is down or unreachable. Retrying every 10 seconds; this clears itself once the backend answers.
    </Banner>
  ) : null;
  const errorToast = error ? (
    <div className="vx-toast vx-toast--error" role="alert" data-focus-scope="error">
      <CircleAlert className="vx-toast__icon" aria-hidden="true" strokeWidth={2.2} />
      <span className="vx-toast__text">{error}</span>
      <TvButton id="dismiss-error" className="vx-toast__action" onActivate={dismissError}>
        {startup ? "Try again" : "Dismiss"}
      </TvButton>
    </div>
  ) : null;
  const notice = toast ? <div className="vx-toast" role="status"><span className="vx-toast__text">{toast}</span></div> : null;

  return (
    <>
      {/* TV has no skeletons: a cover until Home is ready (the responsive shell renders HomeSkeleton). */}
      {!responsive && (bootingHome || startup) && <StartupCover />}
      {preparing && screen !== "player" && screen !== "sources" && (
        responsive ? <div className="vx-dialogs-status"><Preparing /></div> : <Preparing placement="center" />
      )}
      {loading && (
        screen === "player" ? (
          <Preparing placement="center" />
        ) : responsive ? (
          <div className="vx-dialogs-status"><Preparing label="Loading…" /></div>
        ) : (
          <StatusLine className="vx-dialogs-loading">Loading…</StatusLine>
        )
      )}
      {/* TV: the backend panel is a centred alert over a 0.6 scrim; phone / desktop stack it with the toasts. */}
      {banner && !responsive && (
        <div className="vx-overlay vx-dialogs-alert" data-focus-scope="error">
          <div className="vx-scrim" aria-hidden="true" />
          {banner}
        </div>
      )}
      {((banner && responsive) || errorToast || notice) && (
        <div className="vx-toast-region">
          {responsive ? banner : null}
          {errorToast}
          {notice}
        </div>
      )}
      {editingProfile && (
        <ProfileEditor
          api={api}
          profile={editingProfile.profile}
          primary={editingProfile.profile?.id === profiles[0]?.id}
          onCancel={() => setEditingProfile(undefined)}
          onDone={async () => {
            setProfiles(await api.profiles());
            setEditingProfile(undefined);
          }}
        />
      )}
      {entry && (
        <TextEntry
          title={entry.title}
          initialValue={entry.initialValue}
          secret={entry.secret}
          onSubmit={entry.save}
          onCancel={() => setEntry(undefined)}
        />
      )}
      {/* Watch on TV owns its dialog layer (settings family: CastController). */}
      {casting && <CastController receiverUrl={import.meta.env.VITE_VIZIO_RECEIVER_URL} onClose={closeCast} />}
      {modal && <AppModal modal={modal} responsive={responsive} phone={phone} onClose={() => setModal(undefined)} />}
    </>
  );
}

type AppModalRequest = ModalRequest & ModalOptions & { detail?: ErrorDetail };

/**
 * The generic modal (components.md §8). Choices keep their `modal-N` focus ids
 * (useDialogs focuses one on open and restores the invoker on close); Back /
 * Escape close through RemoteRoot; the layer traps Tab and cancels on a
 * backdrop press.
 *   actions  confirmations: stacked buttons (P 54, D 48; TV 80-tall rows)
 *   list     choice rows (✓ Current; TV "· Current") or a menu when rows carry
 *            icons; Cancel / Close is the button under the rows (TV: the last row)
 *   text     long text: a sheet / dialog with a scrolling body; TV full-screen text panel
 * Desktop lists with `view.anchor` open as a popover under their control.
 */
function AppModal({ modal, responsive, phone, onClose }: { modal: AppModalRequest; responsive: boolean; phone: boolean; onClose: () => void }) {
  const layout = modalLayout(modal);
  const titleId = "vx-app-modal-title";
  const indexed = modal.choices.map((choice, index) => ({ choice, id: `modal-${index}` }));
  const dismiss = modal.choices.find(isDismissChoice);
  // BACK always closes a modal (RemoteRoot → setModal(undefined)); a short "dialog"
  // view (Removed from Continue Watching) names only OK, as TvHidden draws it.
  const legend: LegendItem[] = modal.legend ?? (
    layout === "text"
      ? [{ key: "▲ ▼", label: "Scroll" }, { key: "BACK", label: dismiss?.label ?? "Close" }]
      : modal.view?.kind === "dialog"
        ? [{ key: "OK", label: "Select" }]
        : [{ key: "OK", label: "Select" }, { key: "BACK", label: dismiss?.label ?? "Close" }]
  );
  const current = (choice: Choice) => layout === "list" && isCurrentChoice(modal, choice);

  // TV long text: the full-screen text panel (More info, Source details).
  if (!responsive && layout === "text") {
    return (
      <DialogBackdrop onCancel={onClose} scrim="fullscreen" scope="modal" className={modal.className}>
        <TvTextPanel
          title={modal.title}
          titleId={titleId}
          meta={modal.view?.meta}
          boxFocusId="source-detail-body"
          boxLabel={`${modal.title}, scroll with up and down`}
          legend={legend}
          actions={indexed.map(({ choice, id }) => (
            <TvButton key={id} id={id} className="vx-btn" onActivate={choice.action}>{choice.label}</TvButton>
          ))}
        >
          {paragraphs(modal.body ?? modal.message ?? "").map((text, index) => <p key={index}>{text}</p>)}
        </TvTextPanel>
      </DialogBackdrop>
    );
  }

  // Desktop value lists and menus anchored to their control.
  if (responsive && !phone && layout === "list" && modal.view?.anchor) {
    return <AppPopover modal={modal} anchor={modal.view.anchor} onClose={onClose} />;
  }

  const row = ({ choice, id }: { choice: Choice; id: string }) => (
    <TvButton
      key={id}
      id={id}
      className={join("vx-menu__item", choice.tone === "destructive" && "vx-menu__item--danger", choice.unavailable && "vx-dialogs-row--unavailable")}
      aria-current={current(choice) ? "true" : undefined}
      onActivate={choice.action}
    >
      <MenuItemContent icon={choice.icon} note={choice.note} current={current(choice)}>
        {choice.label}
        {choice.unavailable ? <span className="vx-dialogs-row__unavailable"> · unavailable</span> : null}
      </MenuItemContent>
    </TvButton>
  );
  const button = ({ choice, id }: { choice: Choice; id: string }) => (
    <TvButton
      key={id}
      id={id}
      className={join("vx-btn", choice.tone === "primary" && "vx-btn--primary", choice.tone === "destructive" && "vx-btn--destructive", !!choice.icon && "vx-btn--lead")}
      onActivate={choice.action}
    >
      {choice.icon}
      {choice.label}
    </TvButton>
  );
  // TV lists keep Cancel as the last row (one scrolling list); phone / desktop
  // put the dismiss choice under the rows as a button.
  const rows = layout === "list" ? indexed.filter(({ choice }) => !responsive || !isDismissChoice(choice)) : [];
  const buttons = layout === "list" ? (responsive ? indexed.filter(({ choice }) => isDismissChoice(choice)) : []) : indexed;
  const text = layout === "text";

  return (
    <DialogBackdrop onCancel={onClose}>
      <section
        className={join("vx-dialog", "vx-app-modal", `vx-app-modal--${layout}`, modal.className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={modal.hideTitle ? undefined : titleId}
        aria-label={modal.hideTitle ? modal.title : undefined}
        data-focus-scope="modal"
      >
        {responsive ? (
          <button type="button" className="vx-dialog__grabber" aria-label="Close" tabIndex={-1} onClick={onClose}><span /></button>
        ) : null}
        {modal.hideTitle ? null : (
          <div className="vx-dialog__header">
            <h2 className="vx-dialog__title" id={titleId}>{modal.title}</h2>
            {responsive ? (
              <button type="button" className="vx-close" aria-label="Close" onClick={onClose}><X aria-hidden="true" strokeWidth={2.2} /></button>
            ) : null}
          </div>
        )}
        {modal.view?.meta ? <p className="vx-dialogs-meta">{modal.view.meta}</p> : null}
        {modal.message ? <p className="vx-dialog__text">{modal.message}</p> : null}
        {text && modal.body !== undefined ? <DialogBody body={modal.body} /> : null}
        {responsive && modal.detail && modal.detail.lines.length > 0 ? <DetailsBlock lines={modal.detail.lines} /> : null}
        {rows.length ? <div className="vx-menu" role="group" aria-labelledby={modal.hideTitle ? undefined : titleId}>{rows.map(row)}</div> : null}
        {buttons.length ? <div className="vx-dialog__actions">{buttons.map(button)}</div> : null}
        {responsive ? null : <KeyLegend items={legend} corner />}
      </section>
    </DialogBackdrop>
  );
}

function paragraphs(body: string) {
  return body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
}

/** Long body text on phone / desktop: pre-line, scrolls inside the dialog; ↑ ↓ scroll it when focused. */
function DialogBody({ body }: { body: string }) {
  return (
    <p
      className="vx-dialog__text vx-dialog__text--detail vx-dialogs-body"
      tabIndex={0}
      data-focus-id="source-detail-body"
      onKeyDown={(event: KeyboardEvent<HTMLParagraphElement>) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.scrollBy({ top: (event.key === "ArrowDown" ? 1 : -1) * Math.round(event.currentTarget.clientHeight * 0.4) });
      }}
    >
      {body}
    </p>
  );
}

/** "Details" disclosure with the raw diagnostics in a monospace box (phone / desktop; TV shows none). */
function DetailsBlock({ lines }: { lines: readonly string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="vx-dialogs-details">
      <button type="button" className="vx-dialogs-details__toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <ChevronDown aria-hidden="true" strokeWidth={2.2} />
        Details
      </button>
      {open ? (
        <div className="vx-dialogs-details__lines">
          {lines.map((line) => <span key={line}>{line}</span>)}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Desktop popover (components.md §8): belongs to one control, no scrim; a press
 * outside closes it. Anchored at `anchor` (viewport px; "end" right-aligns it),
 * kept 8 px inside the body row. The label repeats the title; Cancel / Close is
 * the last row after a hairline.
 */
function AppPopover({ modal, anchor, onClose }: { modal: AppModalRequest; anchor: { x: number; y: number; align?: "start" | "end" }; onClose: () => void }) {
  const popover = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  useLayoutEffect(() => {
    const element = popover.current;
    const layer = element?.parentElement;
    if (!element || !layer) return;
    const box = layer.getBoundingClientRect();
    const margin = 8;
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const x = (anchor.align === "end" ? anchor.x - width : anchor.x) - box.left;
    const y = anchor.y - box.top;
    setStyle({
      left: Math.max(margin, Math.min(x, box.width - width - margin)),
      top: Math.max(margin, Math.min(y, box.height - height - margin)),
    });
  }, [anchor.x, anchor.y, anchor.align, modal]);
  const titleId = "vx-app-popover-title";
  const items = modal.choices.map((choice, index) => ({ choice, id: `modal-${index}` }));
  const rows = items.filter(({ choice }) => !isDismissChoice(choice));
  const dismissRows = items.filter(({ choice }) => isDismissChoice(choice));
  const item = ({ choice, id }: { choice: Choice; id: string }): ReactNode => {
    const isCurrent = isCurrentChoice(modal, choice);
    return (
      <TvButton
        key={id}
        id={id}
        className={join("vx-menu__item", choice.tone === "destructive" && "vx-menu__item--danger")}
        aria-current={isCurrent ? "true" : undefined}
        onActivate={choice.action}
      >
        <MenuItemContent icon={choice.icon} note={choice.note} current={isCurrent}>{choice.label}</MenuItemContent>
      </TvButton>
    );
  };
  return (
    <DialogBackdrop onCancel={onClose} scrim="clear">
      <div
        ref={popover}
        className={join("vx-popover", "vx-app-popover", modal.choices.some((choice) => choice.icon) && "vx-app-popover--menu", modal.className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-focus-scope="modal"
        style={style}
      >
        <div className="vx-popover__label" id={titleId}>{modal.title}</div>
        <div className="vx-menu" role="group" aria-labelledby={titleId}>
          {rows.map(item)}
          {dismissRows.length ? <span className="vx-dialogs-rule" aria-hidden="true" /> : null}
          {dismissRows.map(item)}
        </div>
      </div>
    </DialogBackdrop>
  );
}
