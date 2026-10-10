# CHANGELOG

## 1.3.2 - 2026-10-10

- Keep modal background pages still and the Recreate header/actions reachable in short and narrow windows.
- Wrap the narrow app title/version without clipping header controls.
- Preserve keyboard focus after Reorder, Remove and Undo; ignore child keyboard clicks in Reorder backdrop detection.
- Add actual-handler regression checks across source and all generated HTML variants.

## 1.3.1 - 2026-10-07

- Normalize the header language switch to EN / JA with localized destination tooltips and accessible names.
- Keep Help labels localized and synchronize the three-part app version without changing local-processing behavior.

## Unreleased

- Add Japanese/English **Reverse all items** in Reorder, preserving clip choices, item metadata, the finished MP4, and the edited output filename.
- Prevent remove Undo from changing the item list during import or rendering, which could previously produce an MP4 whose reported count and freshness did not match its contents. Keep unexpired Undo available after completion/cancellation without extending its five-second window.
- Add offline Node.js behavior tests for ordering, Undo timing, gated rendering, and all four source/release representations to repository validation.

- Fix dependency maintenance reports for empty or null dependency lists under PowerShell strict mode.
- Run offline report regressions (empty, disabled, current, and update-policy cases) from the normal repository check.

## 1.3.0 - 2026-09-02

- Add optional background music with two lightweight original built-in loops: `Daylight` and `Warm Pulse`.
- Add custom music-file input, looping to the full montage duration, preview, and volume adjustment.
- Keep source-video audio excluded so the finished MP4 contains only the selected BGM when music is enabled.
- Add optional one-second capture-year divider cards based on the current item order.
- Include divider seconds in duration/progress/result summaries and keep music/year settings in stale-output detection.
- Preserve fully local processing: built-in music is synthesized in-app and custom audio never leaves the browser.
- Refine the built-in music choice by replacing `Soft Steps` with the calmer, more spacious `Daylight` loop and use a square stop icon while previewing music.
- Align fallback onboarding/mobile-reorder copy with the v1.3 behavior and localize the hidden background-music file input label for accessibility.

## 1.2.0 - 2026-09-02

- Prefetch at most the next source while the current one-second segment is rendering, reducing transition latency without allowing unbounded source decoding.
- Keep each video segment close to its intended one-second output duration by counting playback-start latency inside the one-second window instead of adding it afterward.
- Add automatic **recommended one-second** selection for videos using a lightweight, fully local analysis of brightness, visual change, contrast, and edge detail.
- Fall back to the middle second when the analysis cannot identify a clearly better candidate or when a video is too short for useful sampling.
- Keep manual clip adjustment unchanged and make **Reset** return to the recommended section when one was selected automatically.
- Show **recommended 1 sec / おすすめ1秒** in video cards, while fallback videos continue to show **middle 1 sec / 中央1秒**.
- Treat highlight analysis as best-effort: analysis errors do not reject an otherwise readable video.
- Update Japanese/English help and README for the new local highlight-selection behavior.
- Redesign the empty-state three-step guide to match the clearer Photo Re-Enactor-style flow cards.
- Make phone reordering obvious and directly usable: show a touch drag handle on item cards, keep the dedicated Reorder dialog, and lay out the mobile sorting controls at full width.

## 1.1.0 - 2026-09-01

- Add a blurred-background option for **Show whole item / Fit** output so portrait and square sources can fill unused space more naturally, with tuned blur and a slightly darker backdrop to keep the foreground clear.
- Keep the existing **black bars** option and show the background selector only when **Show whole item** is selected.
- Include the chosen background style in the output summary, result metadata, and stale-result detection so recreating reflects the exact rendering settings.
- Update the Japanese/English help and README to explain the new blurred-background output choice.
- Refresh Japanese and English screenshots with the blurred-background setting visible.

## 1.0.0 - 2026-09-01

- Release the first stable One Second Montage workflow: mixed photos/videos, one item per second, clip selection, ordering, output presets, preview, and local MP4 save.
- Keep an already generated video available when items, order, video clip positions, or output settings change.
- Change the post-generation action to **Recreate video** and require confirmation before replacing the current finished video.
- Preserve the generated video's own item counts and output settings in the result summary while newer edits are pending.
- Add individual item removal with a short Undo action, completing the v1.0 required feature set.
- Refresh Japanese/English release assets and run the full desktop/mobile, large-batch, error, cancellation, privacy, standalone, and self-extract regression suite.
- Rewrite the Japanese/English README in the project-standard release format and replace the ambiguous stacked-frame icon with a filmstrip + `1s` mark.

## 0.9.0 - 2026-09-01

- Prepare the repository for release without expanding the editor feature set.
- Add current Japanese and English screenshots captured from the actual app UI.
- Keep the app favicon aligned with the header brand icon and validate required release assets in repository checks.
- Rewrite README introductions as release-facing descriptions instead of development-version notes.
- Run repository validation when release documentation or assets change, in addition to source/build changes.
- Fix the videos-only count so it refreshes immediately after importing mixed media.
- Regenerate and verify the readable standalone and self-extracting HTML outputs for v0.9.0.

## 0.8.0 - 2026-09-01

- Rewrite the in-app help around supported files, fixed one-second/no-audio rules, output choices, privacy, keyboard use, and practical limitations without exposing development-version wording.
- Clarify that selected files stay in the browser, generated videos are not sent automatically, and saving writes the result to the device.
- Add a persistent help-dialog footer action so long help content remains easy to close on phones.
- Add a skip link, stronger keyboard focus coverage, 44px phone header controls, and reduced-motion-compatible focus/scroll behavior.
- Add accessible processing state with `aria-busy`, labelled progress, result announcements, and a focusable completed section.
- Add screen-reader range text to the one-second clip slider and return focus after help, reorder, and clip dialogs close.
- Keep the full Japanese and English UI/help paths aligned.

## 0.7.0 - 2026-09-01

- Polish the empty state with a compact choose → one-second-each → save flow and keep supported formats visible on phones.
- Make phone guidance match the actual reorder UI instead of referring to desktop drag behavior.
- Move processing feedback to the top of the workspace and add a clearer phase/progress treatment.
- Add state-aware phone bottom actions: add/create while ready, progress/cancel while busy, and review/save after completion.
- Keep imported items after cancellation and make the recovery path explicit in the processing UI.
- Auto-open the failure details when no usable items were loaded.
- Add an explicit “review items / create again” action to the completed state.

## 0.6.0 - 2026-09-01

- Add cancellation for both item import and MP4 creation without discarding already imported items.
- Generate reduced image thumbnails instead of using full-resolution source images in the grid.
- Keep source decoding bounded to one item at a time during export and release decoded image/video resources immediately after use.
- Offload capture-date metadata parsing to an embedded Blob Worker when available, with a main-thread fallback.
- Yield between import batches and export items so large batches remain responsive.
- Separate unsupported and unreadable files from successful items in a persistent failure list.
- Add clearer memory-pressure guidance and release export canvas/chunk references after processing.

## 0.5.0 - 2026-09-01

- Add landscape 16:9, portrait 9:16, and square 1:1 output presets.
- Add show-all (fit) and fill-frame rendering for both images and videos.
- Add standard and high-quality resolution presets without exposing bitrate controls in the normal UI.
- Show the resolved aspect ratio, resolution, display mode, and quality before export.
- Invalidate an already generated MP4 whenever output settings change.
- Make the finished video preview adapt to portrait and square output.

## 0.4.0 - 2026-09-01

- Add added-order, date-taken, and filename sorting.
- Prefer JPEG EXIF capture dates and MP4/MOV creation metadata, with file-date fallback.
- Add desktop drag-to-reorder without introducing a timeline editor.
- Add a dedicated phone-friendly reorder dialog with explicit up/down controls.
- Preserve per-video one-second adjustments when the item order changes.
- Invalidate an already generated MP4 whenever its item order changes.

## 0.3.0 - 2026-09-01

- Add per-video one-second position adjustment without introducing a full video trimmer.
- Add a dedicated clip picker with preview, position slider, reset-to-middle, cancel, and apply actions.
- Add a "videos only" review filter for large mixed batches.
- Mark manually adjusted videos in the thumbnail grid.
- Regenerate video thumbnails after a clip position is changed.
- Keep output invalidation safe: changing a clip position clears any previously generated MP4.

## 0.2.0 - 2026-09-01

- Add MP4 / WebM video input and mixed image/video montages.
- Automatically use the middle one second of each video.
- Add video thumbnails, duration/type indicators, and browser-decode failure handling.
- Keep output silent and fully local.

## 0.1.0 - 2026-09-01

- Implement the initial multiple-image to one-second-per-image MP4 flow.
- Add responsive thumbnail grid, progress, preview, local save, Japanese/English UI, and One Second Montage favicon.
