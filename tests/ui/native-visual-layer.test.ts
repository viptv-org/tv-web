import { expect, it } from "vitest";
import { nativeVisualLayer } from "../../src/tv-solid/platform/native-visual-layer";

it("keeps explicit right-side artwork below both packaged scrims and foreground", () => {
  expect(nativeVisualLayer({kind:"poster",width:1440,height:810,src:"https://art.example/backdrop.jpg",paintBand:"backdrop"})).toBe("backdrop");
  for (const name of ["home-scrim.png","hero-scrim.png","topbar-scrim.png"])
    expect(nativeVisualLayer({kind:"poster",width:1920,height:name.startsWith("topbar")?132:1080,src:`pkg:/assets/${name}`})).toBe("scrim");
  expect(nativeVisualLayer({kind:"poster",width:1920,height:1080,src:"pkg:/assets/replacement-mask.png",paintBand:"scrim"})).toBe("scrim");
  expect(nativeVisualLayer({kind:"poster",width:640,height:180,src:"https://art.example/logo.png"})).toBe("visual");
});

it("retains legacy backdrops, welcome art, focus, dimming and modal precedence", () => {
  expect(nativeVisualLayer({kind:"poster",width:1920,height:1080,src:"https://art.example/backdrop.jpg"})).toBe("backdrop");
  expect(nativeVisualLayer({kind:"poster",width:1920,height:1080,src:"pkg:/assets/welcome-wall.webp"})).toBe("visual");
  expect(nativeVisualLayer({kind:"rect",width:1920,height:1080})).toBe("scrim");
  expect(nativeVisualLayer({kind:"rect",width:424,height:238,focusRing:true})).toBe("chrome");
  expect(nativeVisualLayer({kind:"poster",width:1440,height:810,paintBand:"backdrop",modal:true})).toBe("modal");
  expect(nativeVisualLayer({kind:"poster",width:1920,height:1080,src:"pkg:/assets/home-scrim.png",paintBand:"scrim",modal:true})).toBe("modal");
});
