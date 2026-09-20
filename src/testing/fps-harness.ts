/**
 * Dev-only FPS harness for the real client shells (desktop WebKitGTK and web).
 *
 * The webview itself owns the measurement: a requestAnimationFrame loop
 * records frame timestamps, scenarios drive real UI interactions (nav
 * clicks, wheel scrolling, carousel paging), and every report is printed
 * with console.log("[fps] …") which Tauri forwards to the dev-process
 * stdout. The suite never self-starts: it runs only when the vite dev
 * server serves /fps-trigger.json (drop the file in tv-web/public/) or the
 * URL carries ?fps=auto, so e2e runs stay clean.
 */

interface TriggerConfig {
  run?: number | string;
  signin?: { username: string; password: string };
}

interface FpsStats {
  scenario: string;
  ms: number;
  frames: number;
  avgFps: number;
  p99Fps: number;
  worstFrameMs: number;
  framesOver50ms: number;
  longTasks: number;
  note?: string;
  eventLoopMaxMs: number;
  eventLoopP99Ms: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function percentile(sorted: readonly number[], fraction: number) {
  if (!sorted.length) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(fraction * sorted.length) - 1),
  );
  return sorted[index];
}

export function initFpsHarness(): void {
  if (typeof window === "undefined") return;
  const frameTimes: number[] = [];
  let collecting = false;
  const tick = (time: number) => {
    if (collecting) frameTimes.push(time);
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);

  // An event-loop heartbeat records main-thread stalls even while the window
  // is not being composited (locked screen or blanked display): the freeze
  // visible as dropped frames during navigation is exactly a long beat.
  const beats: number[] = [];
  let lastBeat = 0;
  const beat = () => {
    const now = performance.now();
    if (collecting) {
      if (lastBeat) beats.push(now - lastBeat);
      lastBeat = now;
    } else {
      lastBeat = 0;
    }
    window.setTimeout(beat, 8);
  };
  void beat();

  let longTaskCount = 0;
  let observer: PerformanceObserver | undefined;
  try {
    observer = new PerformanceObserver((list) => {
      longTaskCount += list.getEntries().length;
    });
    observer.observe({ type: "longtask", buffered: false });
  } catch {
    /* longtask unsupported in this engine; frame deltas still tell the story */
  }

  const invoke = (
    window as unknown as {
      __TAURI_INTERNALS__?: {
        invoke: (cmd: string, args: Record<string, unknown>) => Promise<unknown>;
      };
    }
  ).__TAURI_INTERNALS__?.invoke;
  const log = (payload: object) => {
    const line = `[fps] ${JSON.stringify(payload)}`;
    console.log(line);
    // WebKitGTK does not forward console output to the dev-process stdout;
    // the desktop shell's test_log command is the proven channel.
    void invoke?.("test_log", { message: line });
  };

  async function measure(
    name: string,
    ms: number,
    drive?: () => Promise<void> | void,
    note?: string,
  ): Promise<void> {
    frameTimes.length = 0;
    longTaskCount = 0;
    beats.length = 0;
    lastBeat = 0;
    collecting = true;
    const started = performance.now();
    if (drive) {
      try {
        await drive();
      } catch (error) {
        log({ scenario: name, error: String(error) });
      }
    }
    while (performance.now() - started < ms) await sleep(50);
    collecting = false;
    const times: number[] = [];
    for (let i = 1; i < frameTimes.length; i++)
      times.push(frameTimes[i] - frameTimes[i - 1]);
    times.sort((a, b) => a - b);
    const mean = times.reduce((sum, value) => sum + value, 0) / (times.length || 1);
    const stats: FpsStats = {
      scenario: name,
      ms: Math.round(performance.now() - started),
      frames: frameTimes.length,
      avgFps: Math.round(1000 / (mean || 16.7)),
      p99Fps: Math.round(1000 / (percentile(times, 0.99) || 16.7)),
      worstFrameMs: Math.round(times[times.length - 1] ?? 0),
      framesOver50ms: times.filter((value) => value > 50).length,
      longTasks: longTaskCount,
      note,
      eventLoopMaxMs: beats.length ? Math.round(Math.max(...beats)) : 0,
      eventLoopP99Ms: Math.round(percentile([...beats].sort((a, b) => a - b), 0.99)),
    };
    log(stats);
  }

  function reportState(label: string) {
    log({
      scenario: "state",
      label,
      screen: document.querySelector(".home")
        ? "Home"
        : document.querySelector(".browse")
          ? "Browse"
          : document.querySelector('[data-focus-id="profile-0"]')
            ? "profiles"
            : document.querySelector(".responsive-auth-card")
              ? "signin"
              : document.querySelector(".player")
                ? "player"
                : "other",
      nodes: document.getElementsByTagName("*").length,
      cards: document.querySelectorAll(".media-card").length,
      images: document.querySelectorAll("img").length,
      contentVisibility: CSS.supports("content-visibility: auto"),
      backdropFilter:
        CSS.supports("backdrop-filter: blur(1px)") ||
        CSS.supports("-webkit-backdrop-filter: blur(1px)"),
      dpr: window.devicePixelRatio,
      visibility: document.visibilityState,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      ua: navigator.userAgent,
    });
  }

  function navButton(name: string) {
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Main navigation"]');
    if (!nav) return undefined;
    const byId = nav.querySelector<HTMLElement>(`[data-focus-id="nav-${name}"]`);
    if (byId) return byId;
    return Array.from(nav.querySelectorAll<HTMLElement>("button")).find(
      (button) => button.textContent?.trim() === name,
    );
  }

  function scroller() {
    return (
      document.querySelector<HTMLElement>(".responsive-app") ??
      (document.scrollingElement as HTMLElement | null)
    );
  }

  function wheelScroll(deltaY: number): "wheel" | "fallback" {
    const root = scroller();
    if (!root) return "fallback";
    const target = root.querySelector(".shelves") ?? root;
    const before = root.scrollTop;
    target.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY,
        deltaMode: 0,
        bubbles: true,
        cancelable: true,
      }),
    );
    if (root.scrollTop !== before) return "wheel";
    root.scrollBy({ top: deltaY, behavior: "smooth" });
    return "fallback";
  }

  function setNativeValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function signIn(username: string, password: string) {
    const user = document.querySelector<HTMLInputElement>(
      'input[autocomplete="username"], input[aria-label="Username"]',
    );
    const pass = document.querySelector<HTMLInputElement>('input[type="password"]');
    if (!user || !pass) return;
    setNativeValue(user, username);
    setNativeValue(pass, password);
    await sleep(120);
    const submit = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".responsive-auth-card button"),
    ).find((button) => /sign in/i.test(button.textContent ?? ""));
    submit?.click();
  }

  async function ensureHome(): Promise<boolean> {
    if (document.querySelector(".home")) return true;
    const profile = document.querySelector<HTMLElement>('[data-focus-id="profile-0"]');
    profile?.click();
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      if (document.querySelector(".home")) return true;
    }
    return false;
  }

  async function runSuite(config: TriggerConfig) {
    reportState("boot");
    if (config.signin) {
      await signIn(config.signin.username, config.signin.password);
      await sleep(2000);
    }
    const ready = await ensureHome();
    reportState(ready ? "home" : "blocked");
    if (!ready) {
      log({ scenario: "suite-aborted", reason: "home not reachable" });
      return;
    }
    await sleep(1500);
    await measure("idle", 4000);
    const discover = navButton("Discover");
    if (discover) await measure("nav-discover", 4000, () => { discover.click(); });
    await sleep(800);
    const home = navButton("Home");
    if (home) await measure("nav-home", 4000, () => { home.click(); });
    await sleep(800);
    const mode = wheelScroll(520);
    await measure("scroll-down", 5000, async () => {
      for (let i = 0; i < 8; i++) {
        await sleep(450);
        wheelScroll(520);
      }
    }, mode);
    await sleep(800);
    await measure("scroll-up", 5000, async () => {
      for (let i = 0; i < 8; i++) {
        wheelScroll(-520);
        await sleep(450);
      }
    }, mode);
    await sleep(800);
    const shelfButton = document.querySelector<HTMLElement>(
      '.shelves .shelf-nav button[aria-label="Scroll shelf right"]',
    );
    if (shelfButton)
      await measure("carousel-next", 4500, async () => {
        for (let i = 0; i < 5; i++) {
          shelfButton.click();
          await sleep(700);
        }
      });
    reportState("done");
    log({ scenario: "suite-complete" });
  }

  const params = new URLSearchParams(window.location.search);
  let running = false;
  let lastRun: string | undefined;
  const poll = async () => {
    if (running) return;
    try {
      const response = await fetch("/fps-trigger.json", { cache: "no-store" });
      if (!response.ok) return;
      const config = (await response.json()) as TriggerConfig;
      const runId = String(config.run ?? "once");
      if (runId === lastRun) return;
      lastRun = runId;
      running = true;
      log({ scenario: "trigger", run: runId });
      await runSuite(config);
      running = false;
    } catch {
      /* no trigger present */
    }
  };
  if (params.get("fps") === "auto") {
    void runSuite({});
  } else {
    window.setInterval(() => void poll(), 1500);
  }
  log({ scenario: "harness-active", href: window.location.href });
}
