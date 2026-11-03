import { expect, it } from "vitest";
import {
  ACCOUNT_SESSION_REQUIRED,
  ACCOUNT_SESSION_REQUIRED_ROW,
  NOT_AVAILABLE,
  OWNER_REQUIRED,
  PARENT_PIN_REQUIRED,
  offersHouseholdWrite,
  refusalMessage,
} from "../../src/tv-solid/remote/refusals";

/** The settings board may only offer a household write it can complete. An
 * unknown capability keeps the control, so the refusal has to explain itself. */
it("hides household writes only when the server says this session cannot make them", () => {
  expect(offersHouseholdWrite(false)).toBe(false);
  expect(offersHouseholdWrite(true)).toBe(true);
  expect(offersHouseholdWrite(undefined)).toBe(true);
});

it("never sends a device session to a PIN prompt it cannot satisfy", () => {
  const refusal = refusalMessage(403, "account_session_required");

  expect(refusal).toBe(ACCOUNT_SESSION_REQUIRED);
  expect(refusal).toMatch(/account session/i);
  expect(refusal).toMatch(/VIPTV website/i);
  expect(refusal).not.toBe(PARENT_PIN_REQUIRED);
  expect(refusal).not.toMatch(/^Unlock the parent PIN/i);
});

it("keeps the PIN prompt for the one refusal a PIN clears", () => {
  expect(refusalMessage(403, "parent_required")).toBe(PARENT_PIN_REQUIRED);
  expect(refusalMessage(403, "parent_pin_incorrect")).toBe(PARENT_PIN_REQUIRED);
});

it("gives the owner refusal its own remedy", () => {
  expect(refusalMessage(403, "owner_required")).toBe(OWNER_REQUIRED);
  expect(OWNER_REQUIRED).toMatch(/owner/i);
  expect(OWNER_REQUIRED).not.toBe(PARENT_PIN_REQUIRED);
});

it("states an unexplained refusal without promising a PIN unlock", () => {
  expect(refusalMessage(403, "forbidden")).toBe(NOT_AVAILABLE);
  expect(NOT_AVAILABLE).not.toMatch(/PIN/i);
});

it("keeps the settings row short and still denies the PIN remedy", () => {
  expect(ACCOUNT_SESSION_REQUIRED_ROW).toMatch(/VIPTV website/i);
  expect(ACCOUNT_SESSION_REQUIRED_ROW).toMatch(/parent PIN cannot unlock/i);
  expect(ACCOUNT_SESSION_REQUIRED_ROW.length).toBeLessThan(90);
});