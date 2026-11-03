/**
 * A paired TV holds a `device` session. The server's household guard refuses
 * every write from one with `account_session_required`, and no parent PIN
 * changes a session role. A refusal therefore has to name the remedy that can
 * work: an account session. Only the PIN family may ask for a PIN.
 */

/** Household writes refused because this is a paired device, not an account. */
export const ACCOUNT_SESSION_REQUIRED =
  "Change this from an account session on the VIPTV website. A parent PIN cannot unlock it on this TV.";

/** Household writes refused because the account session is not the owner. */
export const OWNER_REQUIRED =
  "Only the account owner can change household settings. Ask the owner to sign in on the website.";

/** A write refused until the parent PIN is unlocked. */
export const PARENT_PIN_REQUIRED = "Unlock the parent PIN to continue.";

/** Any other refusal, stated without promising a remedy that may not exist. */
export const NOT_AVAILABLE = "This isn’t available for this account.";

/** The settings-board line that replaces a household write this session cannot
 * make. Short enough for one row; the full refusal is shown on selection. */
export const ACCOUNT_SESSION_REQUIRED_ROW =
  "Change this on the VIPTV website — a parent PIN cannot unlock it here.";

const parentPinCodes = [
  "parent_required",
  "parent_pin_invalid",
  "parent_pin_incorrect",
];

/** The user-facing message for a refused request. */
export function refusalMessage(status: number, code: string): string {
  if (status === 401) return "Sign in again to continue.";
  if (status === 403) {
    if (code === "account_session_required") return ACCOUNT_SESSION_REQUIRED;
    if (code === "owner_required") return OWNER_REQUIRED;
    if (parentPinCodes.includes(code)) return PARENT_PIN_REQUIRED;
    return NOT_AVAILABLE;
  }
  if (status === 409)
    return "This changed on another device. Refresh and try again.";
  if (status === 429) return "Too many requests. Try again shortly.";
  return "Couldn’t connect. Try again.";
}

/**
 * Whether the settings board may offer a household write. `undefined` means the
 * capability is not known yet (bootstrap omits it), so the control stays and a
 * refusal explains itself rather than the board guessing.
 */
export function offersHouseholdWrite(manageAccount: boolean | undefined) {
  return manageAccount !== false;
}