import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { dirname } from 'node:path';
import ts from 'typescript';
import { chromium, firefox, webkit } from '@playwright/test';
const modules = new Map([
  ['/captions.js', 'vendor/video/src/captions.ts'],
  ['/subtitle-sync.js', 'vendor/video/src/subtitle-sync.ts'],
  ['/provider-subtitles.js', 'src/tv-solid/remote/player/provider-subtitles.ts'],
]);
const wav = Buffer.alloc(44 + 160000);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(160000, 40);
const server = createServer((request, response) => {
  if (request.url === '/audio.wav') { response.writeHead(200, { 'content-type': 'audio/wav', 'content-length': wav.length }); response.end(wav); return; }
  const source = modules.get(request.url);
  if (source) {
    const text = readFileSync(source, 'utf8').replace("import { sessionMediaFetch } from './session-media-fetch';", '').replace('"../../../../vendor/video/src/captions"', '"/captions.js"').replace('"../../../../vendor/video/src/subtitle-sync"', '"/subtitle-sync.js"');
    response.writeHead(200, { 'content-type': 'text/javascript' }); response.end(ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.ES2022 } }).outputText); return;
  }
  response.writeHead(200, { 'content-type': 'text/html' }); response.end('<!doctype html><video muted preload="auto" src="/audio.wav"></video>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const results = [];
try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const started = performance.now();
    let browser;
    try {
      const dependencies = process.env.SUBTITLE_BROWSER_LIBRARY_PATH;
      const wrapper = name === 'webkit' ? process.env.SUBTITLE_WEBKIT_EXECUTABLE : undefined;
      const executable = wrapper ?? (name === 'firefox' && dependencies ? engine.executablePath() : undefined);
      const libraries = name === 'firefox' && dependencies ? `${dirname(engine.executablePath())}:${dependencies}` : dependencies;
      browser = await engine.launch({ headless: !wrapper, ...(executable ? { executablePath: executable } : {}), ...(dependencies ? { env: { ...process.env, LD_LIBRARY_PATH: libraries, GIO_MODULE_DIR: `${dependencies}/gio/modules`, LIBGL_ALWAYS_SOFTWARE: '1' } } : {}) });
    }
    catch (error) { results.push({ browser: name, status: 'unavailable', reason: String(error.message).slice(0, 1200) }); continue; }
    try {
      const page = await browser.newPage();
      const origin = `http://127.0.0.1:${address.port}`;
      await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
      await page.goto(origin);
      const result = await page.evaluate(async () => {
        const { ProviderSubtitles } = await import('/provider-subtitles.js');
        const { SubtitleSyncView } = await import('/subtitle-sync.js');
        const video = document.querySelector('video');
        if (video.readyState < 1) await new Promise(resolve => video.addEventListener('loadedmetadata', resolve, { once: true }));
        let loads = 0; video.addEventListener('loadstart', () => loads++);
        const url = video.currentSrc;
        const record = { version: 1, playback_generation: 'generation', media_identity: 'session', audio_identity: 'audio', subtitle_hash: 'a'.repeat(64), algorithm_version: 'activity-offset-affine-v1', revision: 2, state: 'accepted', manual: false, correction: { anchorUs: 6000000, offsetUs: 1000000, scale: 1.001 } };
        const request = async (path, method) => path.endsWith('/subtitles') ? { canonical_vtt: 'WEBVTT\n\n00:00:02.000 --> 00:00:02.200\nFixture dialogue\n', subtitle_hash: record.subtitle_hash } : method === 'PUT' ? { ...record, revision: 3, manual: true } : record;
        const captions = new ProviderSubtitles(video, request, '/api/playback/owned-fixture', { id: 'selected', label: 'English', language: 'en' });
        await captions.attach(); await Promise.resolve(); captions.tick(0);
        const seek = async time => { video.currentTime = time; await new Promise(resolve => video.addEventListener('seeked', resolve, { once: true })); };
        const active = async titleTime => { captions.tick(titleTime); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return Array.from(video.textTracks[0].activeCues ?? []).map(cue => cue.text); };
        await seek(2.1); const originalSlot = await active(2.1);
        await seek(3.1); const corrected = await active(3.1);
        await captions.manual(0.5); await seek(3.6); const manual = await active(3.6);
        const dense = new SubtitleSyncView(Array.from({ length: 4096 }, (_, i) => ({ start: i, end: 5000, text: 'x' })), 'generation', record.subtitle_hash);
        const timings = [];
        for (let i = 0; i < 2000; i++) { const start = performance.now(); dense.at(4500, 0); timings.push(performance.now() - start); }
        timings.sort((a, b) => a - b);
        const deferred = dense.at(4500, 0).deferred;
        const intent = captions.intent; captions.dispose();
        const renewed = async (path, method) => path.endsWith('/subtitles') ? { canonical_vtt: 'WEBVTT\n\n00:00:02.000 --> 00:00:02.200\nFixture dialogue\n', subtitle_hash: record.subtitle_hash } : { ...record, playback_generation: 'after-seek', state: 'unavailable', correction: null, manual: method === 'PUT', revision: method === 'PUT' ? 3 : 2 };
        const restored = new ProviderSubtitles(video, renewed, '/api/playback/replacement', { id: 'selected', label: 'English', language: 'en' });
        await restored.attach(intent); await seek(2.6); restored.tick(2.6);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const afterSeek = Array.from(video.textTracks[0].activeCues ?? []).map(cue => cue.text);
        await seek(3.6); restored.tick(3.6); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const oldAutoSlot = Array.from(video.textTracks[0].activeCues ?? []).map(cue => cue.text);
        restored.dispose();
        return { originalSlot, corrected, manual, afterSeek, oldAutoSlot, deferred, loads, sameSource: video.currentSrc === url, nativeTrackCount: video.textTracks.length, nativeCueCount: video.textTracks[0].cues?.length ?? 0, denseLookupP95Ms: timings[1900], denseLookupMaxMs: timings[1999] };
      });
      if (result.originalSlot.length || result.corrected.join() !== 'Fixture dialogue' || result.manual.join() !== 'Fixture dialogue' || result.afterSeek.join() !== 'Fixture dialogue' || result.oldAutoSlot.length || result.nativeTrackCount !== 1 || !result.deferred || result.loads || !result.sameSource || result.nativeCueCount) throw new Error(`${name}: ${JSON.stringify(result)}`);
      results.push({ browser: name, status: 'passed', version: browser.version(), wallMs: performance.now() - started, ...result });
    } finally { await browser.close(); }
  }
  const complete = results.every(result => result.status === 'passed');
  process.stdout.write(JSON.stringify({ complete, evidence: 'isolated browser mechanism with owned silent WAV and mocked authenticated transport; no gateway load or device qualification', results }, null, 2) + '\n');
  if ((!complete && !process.argv.includes('--allow-unavailable')) || !results.some(result => result.status === 'passed')) process.exitCode = 2;
} finally { await new Promise(resolve => server.close(resolve)); }
