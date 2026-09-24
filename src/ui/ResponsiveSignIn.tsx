import { useEffect, useRef, useState } from 'react';
import type { TvApi, DevicePairing } from '../api';
import { desktopShellPreview } from './app/appShared';

export function ResponsiveSignIn({ api, pair, qr, onRetry, onUseWithoutAccount }: { api: TvApi; pair?: DevicePairing; qr: string; onRetry: () => void; onUseWithoutAccount?: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const [otherDevice, setOtherDevice] = useState(false);
  const [localFocused, setLocalFocused] = useState(false);
  const scope = useRef<AbortController>();
  const native = '__TAURI_INTERNALS__' in window || desktopShellPreview;
  const rawUrl = pair?.verificationUriComplete || pair?.verificationUri;
  const authUrl = rawUrl && /^https:\/\//i.test(rawUrl) ? rawUrl : undefined;
  useEffect(() => () => scope.current?.abort(), []);
  useEffect(() => { scope.current?.abort(); setPending(false); setApproved(false); setError(''); }, [pair?.deviceCode]);
  const submit = async () => {
    if (!pair || pending) return;
    const request = new AbortController();
    scope.current?.abort(); scope.current = request;
    setPending(true); setError('');
    try {
      await api.browserSignIn(username, password, pair.userCode, { signal: request.signal });
      if (!request.signal.aborted) { setPassword(''); setApproved(true); }
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.');
    } finally { if (!request.signal.aborted) setPending(false); }
  };
  const openBrowser = async () => {
    if (!authUrl) return;
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(authUrl);
      setApproved(true);
    } catch { setError('Could not open your browser. Use the account link below or link with another device.'); }
  };
  return <section className="responsive-auth" aria-label="Account sign-in">
    <div className="responsive-auth-card">
      <img className="auth-mark" src={`${import.meta.env.BASE_URL}assets/viptv-mark.png`} alt="viptv" />
      <h1>Sign in to viptv</h1>
      <p className="auth-intro">Your shows, channels and progress. All in one place.</p>
      {native ? <>
        <button className="auth-submit" disabled={!authUrl} onClick={() => void openBrowser()}>Continue in browser</button>
        <p className="auth-help">Sign in securely in your browser. This window will connect automatically.</p>
      </> : <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label htmlFor="signin-username">Username</label>
        <input id="signin-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={64} value={username} onChange={event => setUsername(event.target.value)} />
        <label htmlFor="signin-password">Password</label>
        <input id="signin-password" name="password" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={event => setPassword(event.target.value)} />
        <button className="auth-submit" type="submit" disabled={!pair || pending || approved}>{pending ? 'Signing in…' : approved ? 'Connecting…' : 'Sign in'}</button>
      </form>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {(approved || !pair) && <p role="status">{approved ? 'Waiting for your account to connect…' : 'Connecting to viptv…'}</p>}
      {authUrl && <a className="auth-account-link" href={authUrl} target="_blank" rel="noopener noreferrer">Create an account or recover access</a>}
      <div className="auth-secondary">
        <button type="button" onClick={() => setOtherDevice(value => !value)} aria-expanded={otherDevice}>Use another device</button>
        <button type="button" onClick={onRetry} disabled={pending}>Reconnect</button>
      </div>
      {onUseWithoutAccount && <>
        <div className="auth-local-entry">
          <button type="button" onClick={onUseWithoutAccount} onFocus={() => setLocalFocused(true)} onBlur={() => setLocalFocused(false)}>Use without an account</button>
        </div>
        {localFocused && <p className="auth-help" role="status">Your addons and playback stay on this device. No account, profiles, or sync.</p>}
      </>}
      {otherDevice && <div className="auth-link-device">
        {qr && <img src={qr} alt="Scan to connect this device" />}
        <p>Enter this code on your account page</p><strong>{pair?.userCode ?? '••••••'}</strong>
        {authUrl && <a href={authUrl} target="_blank" rel="noopener noreferrer">Open account page</a>}
      </div>}
    </div>
  </section>;
}
