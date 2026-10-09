# Browser media pipeline — PB-001

Status: proposed, approved for implementation by the owner on 2026-09-27.
References: design issue #4, video issue #1 and backend issue #3. Baseline source:
video `6c6545e`, backend `f6751fd`, tv-web `7d7ff18`.

## Intent and delivery

Play the selected HTTPS movie or channel immediately, preserving its encoded
media whenever the device can present it. Browser clients receive only opaque
same-origin media capabilities. The order is Mediabunny/WebCodecs, compatible
native/HLS playback, local Mediabunny packet copy to MSE, server remux, audio
conversion with copied video, then necessary video conversion. Unsupported
paths are skipped. Authentication, autoplay and connection errors do not prove
codec incompatibility and must not trigger encoding. Native direct-URL clients
keep their existing contract.

PB-001.1: Opt-in browser sessions may inspect original media in the client
before FFprobe. Versioned engine capability evidence distinguishes unknown,
advertised and decoded support. Actual source decoding is authoritative.
Legacy clients retain their existing request and playback behavior.

PB-001.2: Cancellation, Back, source replacement and Stop abort all obsolete
fetches, sinks and producers. Replacement preserves absolute position, pause
intent, selected language and source identity. Local track IDs never imply
FFprobe stream indexes. Each delivery rung is attempted at most once.

PB-001.3: Underflow freezes the playback clock and shows the existing preparing
indicator; replenishment resumes in sync. Report only common playable AV
buffer. Real live channels start two playlist refresh intervals behind the
available edge. Generated rolling VOD remains a movie with the full title
duration. Non-seekable live retains its current controls; no new DVR service
is introduced.

## Controls and presentation

PB-001.4: Preserve the existing Player geometry, focus restoration, 700ms hold,
Back and Next semantics. Audio/subtitle lists prefer actual locally selectable
tracks. A local selection takes effect without a server-session replacement.
Unsupported required captions use explicit server preparation; text extraction
alone must not encode the picture. Off always clears current cues.

PB-001.5: Add a Quality section to the existing playback options surface when
multiple upstream renditions exist. Copy: "Quality", "Auto", "[height]p".
Auto is the default and preserves headroom using throughput and buffer evidence.
Manual selection persists for that source. Selecting an item closes its list
and returns focus to the originating control; Back cancels without changing it.
Playback info reports engine, original/copy/encode decision and safe failure
reason, never private URLs or credentials. Seek previews use the existing
preview bubble and bounded on-demand work; no background full-title scan.

## Platform evidence and limits

PB-001.6: On 2026-09-27, a physical Vizio V655-G9 on firmware 2.600.596.0-10,
Conjure Chrome 87.0.4280.141, reported a secure context but no VideoDecoder,
AudioDecoder or VideoFrame in either page or worker. Short native H.264,
HEVC Main/Main10 SDR and hls.js H.264/AAC samples decoded with zero reported
dropped frames. Mediabunny 1.56.2 copied both tracks of a 3-second 640x360 MKV
into fragmented MP4 in 201ms, then native playback succeeded. This proves
packet-copy feasibility, not streaming, HDR or sustained HD/UHD qualification.

PB-001.7: Old TV runtimes may use Mediabunny's demux/mux APIs without WebCodecs.
Production uses bounded streaming to MSE, not a complete-file BufferTarget.
Start with a 32MiB source cache, 20 seconds ahead and 10 seconds behind. A
failed import or actual append/decode refuses only that engine/source pair.

## Server behavior and acceptance

PB-001.8: Only unsupported media triggers conversion. Copy video when audio
alone needs conversion; preserve compatible audio independently. Seeking
resumes from a preceding keyframe with a reported preroll origin instead of
automatically encoding. HLS uses decodable segment boundaries, truthful timing
and atomic publication; encoded output starts with a one-second segment and
then two-second closed GOPs. VOD production follows consumed media time;
live input is never suspended.

PB-001.9: Qualify original files, local copy, audio-only conversion and video
conversion over trusted HTTPS. Cover language/caption/quality selection,
late data, irregular GOPs, missing ranges, redirects, expiry, discontinuities,
repeated seeks, cancellation and return focus. Direct/local copy must use zero
server encoders. Record browser and physical-TV results independently. Release
gates on controlled fixtures are bounded memory/storage, no unexpected healthy
network stalls, AV skew within 80ms, under 1% dropped frames and responsive
controls. Run 30-minute device playback. Retain the deployed transcoder unless
a pinned candidate passes compatibility, sustains 1.25x realtime and regresses
startup by no more than 10%. Promote capabilities only to the tested envelope.
