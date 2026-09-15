# Transcode spec (Phase 0)

What the Phase 6 script must reproduce. Every command here was run by hand on
ffmpeg 8.1 (Homebrew, macOS arm64) against a 29.44 s, 1920x1080, 24 fps
H.264/AAC export from DaVinci Resolve.

## 1. Probe

```bash
ffprobe -v error -show_format -show_streams -of json <INPUT>
```

- `-v error` keeps the human summary out of the output, so stdout is pure JSON.
- JSON, not the human summary: the summary has no guaranteed layout.

Fields used:

| Field | Why |
|---|---|
| `streams[].codec_type` | Find the video and audio streams. Never assume index 0 is video: real files carry extra streams (the sample had a `tmcd` timecode stream). |
| `width`, `height` | Decide which renditions to make. |
| `r_frame_rate`, `avg_frame_rate` | Compute the GOP. Equal values mean constant frame rate. |
| `format.duration` | Denominator for progress %. |
| `pix_fmt`, `color_transfer` | Detect HDR / 10-bit (`yuv420p10le`, `smpte2084`, `arib-std-b67`). |

Almost every number is a **string** (`"29.440000"`, `"24/1"`). Parse them;
`r_frame_rate` is a fraction to divide.

## 2. Transcode (HLS ladder, one ffmpeg process)

```bash
ffmpeg -nostdin -y -loglevel error -nostats -progress pipe:1 -i <INPUT> \
  -filter_complex "[0:v:0]split=2[a][b];[a]scale=-2:720[v720];[b]scale=-2:480[v480]" \
  -map "[v720]" -map 0:a:0 -map "[v480]" -map 0:a:0 -map_metadata -1 \
  -c:v libx264 -preset medium -crf 23 -g <GOP> -sc_threshold 0 \
  -maxrate:v:0 3000k -bufsize:v:0 6000k -maxrate:v:1 1200k -bufsize:v:1 2400k \
  -c:a aac -b:a 128k \
  -f hls -hls_time 4 -hls_playlist_type vod \
  -hls_segment_filename "<OUT_DIR>/%v/seg_%03d.ts" -master_pl_name master.m3u8 \
  -var_stream_map "v:0,a:0,name:720p v:1,a:1,name:480p" \
  <OUT_DIR>/%v/index.m3u8
```

Output layout:

```
<OUT_DIR>/master.m3u8
<OUT_DIR>/720p/index.m3u8, seg_000.ts …
<OUT_DIR>/480p/index.m3u8, seg_000.ts …
```

Key choices:

- **One process, `split` filter**: decode the source once and feed identical
  frames to both encoders. Two separate runs would decode twice and rely on
  keeping settings identical by hand.
- **libx264, not h264_videotoolbox**: same output on macOS and Linux, full
  keyframe control, CRF mode, and it loads the CPU (needed for Experiment B).
- **Capped CRF** (`-crf` + `-maxrate`/`-bufsize`): steady quality, but
  `BANDWIDTH` in the master playlist stays honest so players pick correctly.
- **Fixed GOP** (`-g` = 2 s, `-sc_threshold 0`): keyframes at the same instants
  in every rendition, so every segment starts on a keyframe and switching is
  clean. `-keyint_min` is not needed: x264 clamps it and it only affects
  scene-cut keyframes, which are off.
- **4 s segments** (2 GOPs): a 29 s sample gives 8 segments. Apple recommends
  6 s; revisit for long uploads.
- **MPEG-TS segments, muxed audio**: each segment stands alone and can be
  inspected with ffprobe. fMP4 and a separate audio group are valid
  alternatives that nothing in the H.264-only scope needs.

## 3. Values Node computes per upload

| Value | Rule |
|---|---|
| `<GOP>` | `round(fps × 2)`, fps from `r_frame_rate`. Only valid when `r_frame_rate == avg_frame_rate`. A hard-coded 48 at 30 fps gives 1.6 s keyframes and 4.8 s / 3.2 s segments, silently. |
| Renditions | Skip any rendition taller than the source (never upscale). `-filter_complex`, `-map`, `-maxrate:v:N` and `-var_stream_map` all change together. |
| `<INPUT>`, `<OUT_DIR>` | Per job. ffmpeg creates the `%v` subdirectories itself. |

## 4. Progress

`-progress pipe:1` writes `key=value` blocks to **stdout** about every 0.5 s.
The log goes to **stderr**, a separate channel.

Last block from the sample:

```
frame=705
out_time_us=29291667
out_time_ms=29291667
speed=4.49x
progress=end
```

Rules:

- Use `out_time_us` (microseconds). **Ignore `out_time_ms`**: despite the name
  it is also microseconds.
- Percent = `out_time_us / (format.duration × 1_000_000)`. It never reaches 100
  (sample: 29.29 s of 29.44 s = 99.5%).
- **Done = `progress=end` and exit code 0.** Never "percent reached 100".
- Failure = non-zero exit code (a missing input exits 254) with the reason on
  stderr.

## 5. Traps and the flag that prevents each

| Trap | Prevented by | Why |
|---|---|---|
| Playlist lists only the last 5 segments | `-hls_playlist_type vod` | Default is a live sliding window; vod keeps every segment and writes `EXT-X-ENDLIST`. |
| Timecode track and GPS/creation metadata copied to output | `-map_metadata -1` | The MP4 writer rebuilt a `tmcd` track from copied tags even with `-map`; phone uploads can carry location. |
| ffmpeg hangs waiting on the keyboard | `-nostdin` | A spawned process has no keyboard. |
| ffmpeg hangs on `Overwrite? [y/N]` | `-y` | Nobody answers; retries must replace partial output. |
| Extra streams (timecode, subtitles, cover art) included | `-map` | Once any `-map` is given, only mapped streams are output. |
| libx264 rejects an odd width | `scale=-2:H` | Rounds the computed width to even (4:2:0 needs even dimensions). |
| Uneven or misaligned segments | `-g`, `-sc_threshold 0` | Segments can only cut on keyframes. |

## 6. Measured on the sample (baseline for later benchmarks)

| | |
|---|---|
| Source | 82 MiB, ~23.3 Mbit/s |
| Ladder encode | 6.6 s wall, speed ~4.4x |
| Single 720p encode (Step 3) | ~763% CPU: one ffmpeg process kept ~7–8 cores busy |
| 720p video | ~2.5 Mbit/s, `BANDWIDTH=3121928`, `CODECS="avc1.64001f,mp4a.40.2"` |
| 480p video | ~1.1 Mbit/s, `BANDWIDTH=1563408`, `CODECS="avc1.64001e,mp4a.40.2"` |
| Keyframes | Identical in both renditions: every 2 s starting at 1.483333 (TS clock offset + B-frame delay) |
| Playback | Safari started on 480p and switched to 720p at segment 1 |

## 7. Not handled yet

- **No audio stream**: `-map 0:a:0` errors. Needs a different map and
  `-var_stream_map`.
- **Variable frame rate input** (common from phones): `-g` in frames is wrong.
- **HDR / 10-bit input**: needs tone mapping to 8-bit SDR.
- **Vertical video**: "720p" by height gives a ~405x720 picture.
- **Sources shorter than 480 px**.
