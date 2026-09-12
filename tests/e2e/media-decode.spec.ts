import { expect, test } from '@playwright/test';

type DecodeResult =
  | { readonly supported: false }
  | {
      readonly supported: true;
      readonly advancedPosition: number;
      readonly pausedAt: number;
      readonly pausedPosition: number;
      readonly seekTarget: number;
      readonly seekPosition: number;
      readonly endedState: string;
      readonly sourceRemoved: boolean;
    };

const VIZIO_ADAPTER_MODULE = '/src/player/vizio-html5.ts';

/**
 * This is deliberately a browser decoder test, rather than an HTMLMediaElement
 * fake. Chromium records a small WebM from canvas frames, then the real Vizio
 * adapter opens that Blob URL through the browser's media stack. It proves the
 * adapter observes native time, pause, seek, ended, and source cleanup events.
 *
 * It does not make a SmartCast firmware compatibility claim: the platform
 * capability remains probe-required until exercised on that television.
 */
test('Vizio HTML adapter drives a browser-decoded WebM through pause, seek, end, and cleanup', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'exercise the native HTML media boundary once in the Vizio project');
  await page.goto('/?platform=vizio');

  const result = await page.evaluate<DecodeResult, string>(async (adapterModulePath) => {
    // Vite transforms this source-module request in the test server. Keeping
    // the browser URL as a value avoids making Node's type resolver treat it
    // as a package import while still loading the production adapter.
    const { VizioHtml5Adapter } = await import(/* @vite-ignore */ adapterModulePath);

    const waitFor = async (predicate: () => boolean, description: string, timeoutMs = 8_000): Promise<void> => {
      const deadline = performance.now() + timeoutMs;
      while (!predicate()) {
        if (performance.now() >= deadline) throw new Error(`Timed out waiting for ${description}.`);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 25));
      }
    };
    const waitForEvent = (target: EventTarget, name: string, timeoutMs = 8_000): Promise<void> => new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        target.removeEventListener(name, onEvent);
        reject(new Error(`Timed out waiting for ${name}.`));
      }, timeoutMs);
      const onEvent = () => {
        window.clearTimeout(timeout);
        target.removeEventListener(name, onEvent);
        resolve();
      };
      target.addEventListener(name, onEvent, { once: true });
    });

    const mimeType = 'video/webm;codecs=vp8';
    if (!('MediaRecorder' in window) || !MediaRecorder.isTypeSupported(mimeType)) {
      return { supported: false };
    }

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 18;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context is unavailable.');
    const stream = canvas.captureStream(30);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    const stoppedRecording = waitForEvent(recorder, 'stop');
    let frame = 0;
    const draw = () => {
      context.fillStyle = frame++ % 2 === 0 ? '#171717' : '#e5b800';
      context.fillRect(0, 0, canvas.width, canvas.height);
    };
    draw();
    recorder.start(100);
    const interval = window.setInterval(draw, 33);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 2_000));
    window.clearInterval(interval);
    recorder.stop();
    await stoppedRecording;

    const fixtureUrl = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    document.body.append(video);
    const player = new VizioHtml5Adapter(video);

    try {
      await player.open({ url: fixtureUrl, kind: 'vod' });
      await waitFor(() => video.currentTime > 0.15, 'decoded currentTime to advance');
      await waitFor(() => player.snapshot.time.positionSeconds > 0.15, 'adapter time notification');
      const advancedPosition = player.snapshot.time.positionSeconds;

      await player.pause();
      const pausedAt = video.currentTime;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
      const pausedPosition = video.currentTime;

      const target = Math.min(0.6, Math.max(0.1, video.duration / 3));
      const seeked = waitForEvent(video, 'seeked');
      await player.seek(target);
      await seeked;
      const seekPosition = player.snapshot.time.positionSeconds;

      const ended = waitForEvent(video, 'ended');
      await player.play();
      await ended;
      await waitFor(() => player.snapshot.state === 'ended', 'adapter ended snapshot');

      await player.dispose();
      return {
        supported: true,
        advancedPosition,
        pausedAt,
        pausedPosition,
        seekTarget: target,
        seekPosition,
        endedState: player.snapshot.state,
        sourceRemoved: !video.hasAttribute('src'),
      };
    } finally {
      URL.revokeObjectURL(fixtureUrl);
      video.remove();
      canvas.remove();
      stream.getTracks().forEach((track) => track.stop());
    }
  }, VIZIO_ADAPTER_MODULE);

  test.skip(!result.supported, 'Chromium cannot record the WebM fixture in this environment');
  if (!result.supported) return;
  expect(result.advancedPosition).toBeGreaterThan(0.15);
  expect(result.pausedPosition - result.pausedAt).toBeLessThan(0.05);
  expect(result.seekPosition).toBeCloseTo(result.seekTarget, 1);
  expect(result.endedState).toBe('disposed');
  expect(result.sourceRemoved).toBe(true);
});
