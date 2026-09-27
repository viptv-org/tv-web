import { expect, it } from "vitest";
import { selectRenderer } from "../../src/rendererSelection";
it("routes all public TV entry modes to SolidTV and desktop/web to React", () => {
  for (const platform of ["vizio", "tizen", "webos"]) expect(selectRenderer(`?platform=${platform}`, false)).toBe("solid");
  expect(selectRenderer("?layout=tv", false)).toBe("solid");
  expect(selectRenderer("", false)).toBe("react");
  expect(selectRenderer("?platform=vizio", true)).toBe("react");
  expect(selectRenderer("?platform=vizio&renderer=react", false)).toBe("react");
});
