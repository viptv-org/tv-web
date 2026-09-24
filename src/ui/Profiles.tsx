import { Check, ChevronLeft, ChevronRight, Lock, Pencil, Plus, Settings } from "lucide-react";
import type { TvProfile } from "../api";
import { TvButton } from "./remote";
import { ProfileAvatar, profileLocked } from "./ProfileEditor";
import { buttonClass } from "./primitives/Button";
import { KeyLegend } from "./primitives/Keys";

const PER_PAGE = 5;
const MAX_PROFILES = 12;

/**
 * Who's watching? / Manage profiles (PhProfiles, DeskProfiles, DeskProfilesPaged, TvProfiles,
 * PhProfilesManage, WebProfilesManage, TvProfilesManage, TvManageCue). Five profiles a page plus
 * the dashed Add profile tile (disabled at 12). Protected profiles carry the lock badge; on TV the
 * manage mode puts a pencil cue on every tile so OK clearly opens the editor.
 */
export function ProfilesScreen({ profiles, managing, onManage, page, onPage, onChoose, onEdit, tv }: {
  profiles: readonly TvProfile[];
  managing: boolean;
  onManage: () => void;
  page: number;
  onPage: (update: (page: number) => number) => void;
  onChoose: (id: string) => void;
  onEdit: (profile?: TvProfile) => void;
  tv: boolean;
}) {
  const pages = Math.ceil(profiles.length / PER_PAGE);
  return (
    <section className={`vx-profiles${managing ? " vx-profiles--managing" : ""}`} aria-labelledby="profiles-title">
      <span className="vx-profiles__wordmark" aria-hidden="true">VIPTV</span>
      <div className="vx-profiles__body">
        <h1 id="profiles-title" className="vx-profiles__title">
          {managing ? "Manage profiles" : "Who's watching?"}
        </h1>
        <div className="vx-profiles__tiles">
          {profiles.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).map((profile, i) => {
            const locked = profileLocked(profile);
            const cue = tv && managing;
            return (
              <TvButton
                id={`profile-${i}`}
                key={profile.id}
                className="vx-profile"
                onActivate={() => (managing ? onEdit(profile) : onChoose(profile.id))}
                onHold={() => onEdit(profile)}
              >
                <span className="vx-profile__frame">
                  <span className="vx-profile__avatar">
                    <ProfileAvatar profile={profile} />
                  </span>
                  {locked && (
                    <span className="vx-lock-badge" role="img" aria-label="Parent PIN required">
                      <Lock aria-hidden="true" strokeWidth={2.4} />
                    </span>
                  )}
                  {cue && (
                    <span className="vx-pencil-cue" aria-hidden="true">
                      <Pencil strokeWidth={2.2} />
                    </span>
                  )}
                </span>
                <span className="vx-profile__name">{profile.name}</span>
              </TvButton>
            );
          })}
          <TvButton
            id="add-profile"
            className="vx-profile vx-profile--add"
            disabled={profiles.length >= MAX_PROFILES}
            onActivate={() => onEdit()}
          >
            <span className="vx-profile__avatar">
              <Plus aria-hidden="true" strokeWidth={1.8} />
            </span>
            <span className="vx-profile__name">Add profile</span>
          </TvButton>
        </div>
        {profiles.length > PER_PAGE && (
          <div className="vx-profiles__pager">
            <TvButton
              id="profiles-previous"
              className={buttonClass({ size: "small", icon: true })}
              disabled={page === 0}
              onActivate={() => onPage((p) => p - 1)}
            >
              <ChevronLeft aria-hidden="true" />
              Previous
            </TvButton>
            <span className="vx-profiles__page">
              {page + 1} / {pages}
            </span>
            <TvButton
              id="profiles-next"
              className={buttonClass({ size: "small", icon: true })}
              disabled={(page + 1) * PER_PAGE >= profiles.length}
              onActivate={() => onPage((p) => p + 1)}
            >
              <ChevronRight aria-hidden="true" />
              Next
            </TvButton>
          </div>
        )}
        <TvButton id="manage-profiles" className={buttonClass({ icon: true, className: "vx-profiles__manage" })} onActivate={onManage}>
          {managing ? <Check aria-hidden="true" /> : <Settings aria-hidden="true" />}
          {managing ? "Done" : "Manage profiles"}
        </TvButton>
      </div>
      {tv && (
        <KeyLegend
          corner
          items={[{ key: "OK", label: managing ? "Edit" : "Select" }, { key: "◀ ▶", label: "Move" }]}
        />
      )}
    </section>
  );
}
