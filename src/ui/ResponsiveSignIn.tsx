import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, CircleAlert, Clock, ExternalLink, Eye, EyeOff, RefreshCw, Smartphone } from 'lucide-react';
import type { TvApi, DevicePairing } from '../api';
import { desktopShellPreview } from './app/appShared';
import { PasswordField, TextField } from './primitives/Fields';

/**
 * Account sign-in on phone, web and the desktop app (PhSignIn, WebSignIn, WebSignInError,
 * WebSignInDevice, WebSignInLocal, DeskSignIn): one card, bottom-aligned on phones and centred
 * on wider screens. The desktop app signs in through the system browser.
 */
export function ResponsiveSignIn({ api, pair, qr, expired = false, onRetry, onUseWithoutAccount }: { api: TvApi; pair?: DevicePairing; qr: string; expired?: boolean; onRetry: () => void; onUseWithoutAccount?: () => void }) {
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
  const errorLine = error ? (
    <span className="vx-inline-error" role="alert" id="signin-error">
      <CircleAlert aria-hidden="true" />
      {error}
    </span>
  ) : null;
  // The pairing code is claimed in the background: say so while this window waits for it.
  const waiting = !!pair && !expired && (approved || (native && !!authUrl) || otherDevice);
  const status = expired ? (
    <div className="vx-status vx-signin__expired" role="status">
      <Clock aria-hidden="true" />
      This code expired.
    </div>
  ) : waiting || !pair ? (
    <div className="vx-status" role="status">
      <span className="vx-spinner" aria-hidden="true" />
      {waiting ? 'Waiting for your account to connect…' : 'Connecting to viptv…'}
    </div>
  ) : null;
  return <section className="vx-signin" aria-label="Account sign-in">
    <div className="vx-signin__card">
      <span className="vx-signin__mark" aria-hidden="true">V</span>
      <h1 className="vx-signin__title">Sign in to viptv</h1>
      <p className="vx-signin__intro">Your shows, channels and progress. All in one place.</p>
      {native ? <>
        <div className="vx-signin__browser">
          <button type="button" className="vx-btn vx-btn--primary vx-btn--block vx-btn--lead" disabled={!authUrl} onClick={() => void openBrowser()}>
            <ExternalLink aria-hidden="true" />
            Continue in browser
          </button>
          <p className="vx-signin__help">Sign in securely in your browser. This window will connect automatically.</p>
        </div>
        {errorLine}
        {status}
      </> : <form className="vx-signin__form" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <TextField label="Username" id="signin-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={64} value={username} onChange={event => setUsername(event.target.value)} />
        <PasswordField
          label="Password"
          id="signin-password"
          name="password"
          autoComplete="current-password"
          required
          maxLength={1024}
          value={password}
          onChange={event => setPassword(event.target.value)}
          className={error ? 'vx-field--error' : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'signin-error' : undefined}
          showIcon={<Eye aria-hidden="true" />}
          hideIcon={<EyeOff aria-hidden="true" />}
        />
        {errorLine}
        <button className="vx-btn vx-btn--primary vx-btn--block" type="submit" aria-busy={pending || undefined} disabled={!pair || pending || approved || expired}>
          {pending && <span className="vx-spinner" aria-hidden="true" />}
          {pending ? 'Signing in…' : approved ? 'Connecting…' : 'Sign in'}
        </button>
      </form>}
      {authUrl && <div className="vx-signin__account">
        <a className="vx-link" href={authUrl} target="_blank" rel="noopener noreferrer">Create an account or recover access</a>
      </div>}
      <div className="vx-signin__secondary">
        <button type="button" className="vx-signin__device" onClick={() => setOtherDevice(value => !value)} aria-expanded={otherDevice}>
          <Smartphone aria-hidden="true" />
          Use another device
          {otherDevice ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </button>
        <button type="button" className="vx-link vx-signin__reconnect" onClick={onRetry} disabled={pending}>
          <RefreshCw aria-hidden="true" />
          Reconnect
        </button>
      </div>
      {otherDevice && <div className="vx-signin__device-panel">
        {qr
          ? <span className="vx-signin__qr" role="img" aria-label="Scan to connect this device"><img src={qr} alt="" /></span>
          : <span className="vx-signin__qr vx-signin__qr--pending" aria-hidden="true" />}
        <div className="vx-signin__device-body">
          <span className="vx-signin__device-text">Enter this code on your account page</span>
          <strong className="vx-signin__code">{pair?.userCode ?? '••••••'}</strong>
          {authUrl && <a className="vx-btn vx-btn--small vx-btn--lead" href={authUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            Open account page
          </a>}
        </div>
      </div>}
      {!native && status}
      {onUseWithoutAccount && <div className="vx-signin__local">
        <button type="button" className="vx-btn vx-btn--outline vx-btn--block" onClick={onUseWithoutAccount} onFocus={() => setLocalFocused(true)} onBlur={() => setLocalFocused(false)}>Use without an account</button>
        {localFocused && <p className="vx-signin__local-help" role="status">Your addons and playback stay on this device. No account, profiles, or sync.</p>}
      </div>}
    </div>
  </section>;
}
