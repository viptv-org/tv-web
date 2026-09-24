import { TvButton } from "../remote";
import { LEGACY_TV_SCALE } from "../tvCanvas";
import { DialogBackdrop } from "../DialogBackdrop";
import { CastController } from "../CastController";
import { TextEntry } from "../TextEntry";
import { ProfileEditor } from "../ProfileEditor";
import { connectionSummary } from "../errors";
import type { AppApi } from "./useTvApp";

export function AppDialogs({ app }: { app: AppApi }) {
  const { api, bootingHome, busy, items, responsive, casting, closeCast, connection, detail, editingProfile, entry, error, modal, player, preparing, profile, profiles, screen, setConnection, setEditingProfile, setEntry, setError, setModal, setProfiles, setStartupAttempt, sources, toast } = app;
  return (
    <>
        {/* The responsive shell renders HomeSkeleton instead. */}
        {!responsive && (bootingHome || screen === "startup") && (
          <div className="startup-cover" role="status">
            <img
              src={`${import.meta.env.BASE_URL}assets/viptv-mark.png`}
              alt=""
            />
            <p>Starting VIPTV…</p>
          </div>
        )}
        {preparing && screen !== "player" && screen !== "sources" && (
          <div className="loading" role="status">
            Preparing playback…
          </div>
        )}
        {/* The responsive player shows its own buffering ring instead. */}
        {busy && !preparing && screen !== "sources" && !(responsive && (screen === "player" || screen === "Search" || bootingHome || screen === "startup" || (screen === "Discover" && !items.length))) && (
          <div
            className={screen === "player" ? "playback-loading" : "loading"}
            role="status"
          >
            {screen === "player" ? "Preparing playback…" : "Loading…"}
          </div>
        )}
        {connection && (
          <div className="error connection" role="alert" data-focus-scope="error">
            <div className="error-title">Can't reach the backend</div>
            <div className="error-message">
              The connection was refused, so the backend is down or unreachable. Retrying
              every 10 seconds; this clears itself once the backend answers.
            </div>
            <div className="error-line">{connectionSummary(connection)}</div>
            <TvButton id="dismiss-error" onActivate={() => setConnection(undefined)}>
              Dismiss
            </TvButton>
          </div>
        )}

        {error && (
          <div className="error error-toast" role="alert" data-focus-scope="error">
            <span className="error-toast-text">{error}</span>
            <TvButton id="dismiss-error" className="error-dismiss-btn" onActivate={() => {
              setError("");
              if (screen === "startup") setStartupAttempt((attempt) => attempt + 1);
            }}>
              {screen === "startup" ? "Try again" : "Dismiss"}
            </TvButton>
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
        )}{" "}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
        {casting && <DialogBackdrop onCancel={closeCast}><div className="modal" role="dialog" aria-modal="true" aria-label="Watch on TV" data-focus-scope="cast"><CastController receiverUrl={import.meta.env.VITE_VIZIO_RECEIVER_URL} onClose={closeCast} /></div></DialogBackdrop>}
        {modal && (
          <DialogBackdrop onCancel={() => setModal(undefined)}>
            <div
              className={modal.body ? "source-detail-panel" : "modal"}
              data-focus-scope="modal"
              role="dialog"
              aria-modal="true"
              aria-label={modal.title}
            >
              <h2 className={modal.detail ? `modal-title kind-${modal.detail.kind}` : undefined}>
                {modal.title}
              </h2>
              {modal.message && <p className="modal-message">{modal.message}</p>}
              {modal.detail && modal.detail.lines.length > 0 && (
                <details className="modal-details">
                  <summary>Details</summary>
                  {modal.detail.lines.map((line) => (
                    <div className="modal-detail-line" key={line}>
                      {line}
                    </div>
                  ))}
                </details>
              )}
              {modal.body && (
                <div
                  className="source-detail-body"
                  tabIndex={0}
                  data-focus-id="source-detail-body"
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      event.stopPropagation();
                      // 100px per press, x1.5 on the 1920 x 1080 TV canvas.
                      const step = event.currentTarget.closest(".responsive-app") ? 100 : 100 * LEGACY_TV_SCALE;
                      event.currentTarget.scrollBy({
                        top: event.key === "ArrowDown" ? step : -step,
                      });
                    }
                  }}
                >
                  {modal.body}
                </div>
              )}
              <div className="modal-choices">
                {modal.choices.map((choice, i) => (
                  <TvButton
                    id={`modal-${i}`}
                    key={i}
                    onActivate={choice.action}
                  >
                    {choice.label}
                  </TvButton>
                ))}
              </div>
            </div>
          </DialogBackdrop>
        )}
    </>
  );
}
