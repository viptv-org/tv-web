Synthetic five-second 160×90 H.264 High/AAC-LC stereo HLS fixture for real Chromium MSE decoding. Created locally with FFmpeg 7.0.2 (imageio-ffmpeg 0.6.0 binary), using generated testsrc2 video and 440 Hz sine audio. No provider content or credentials. Transport stream files use `.bin` on disk to avoid TypeScript source discovery; the test serves them as `.ts` with `video/mp2t`.

Regenerate in a temporary directory with:

```sh
ffmpeg -f lavfi -i testsrc2=size=160x90:rate=24 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 5 -c:v libx264 -threads 1 -preset veryfast -profile:v high -level 4.1 -pix_fmt yuv420p -g 24 -keyint_min 24 -sc_threshold 0 -b:v 80k -c:a aac -ac 2 -b:a 32k -f hls -hls_time 1 -hls_playlist_type vod -hls_segment_filename 'segment%d.ts' index.m3u8
```

Rename the generated segment files to `.bin`, retaining playlist `.ts` paths.
