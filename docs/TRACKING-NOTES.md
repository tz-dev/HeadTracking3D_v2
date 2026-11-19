# Tracking and Rendering Notes

This document records the implementation details of this extended browser-based head-tracking demo. It accompanies the public [README](../README.md) and is not a separate license or specification for the unrelated maze/shooter project.

## Source and conceptual background

**Source code foundation:** [AralimNGA/head-tracking-3d](https://github.com/AralimNGA/head-tracking-3d) (MIT license, original notice preserved in `LICENSE`). The upstream demo already combined MediaPipe Face Landmarker, Three.js, head-coupled off-axis projection, three viewing modes, tracking overlays, sensitivity and smoothing, and a floating geometric scene. Our implementation builds on those features rather than replacing them.

**Interaction inspiration:** Johnny Chung Lee's 2007 Wii Remote head-tracking demonstration, [Head Tracking for Desktop VR Displays](https://www.youtube.com/watch?v=Jd3-eiid-Uw). The key idea is a **fixed physical screen** that behaves visually like a *window* into 3D space: viewpoint-dependent parallax arises as the observer moves. Lee's hardware and source code are **not included** in this application; the implementation uses a normal webcam and in-browser tracking.

## The screen-plane model

- The physical monitor is represented by a fixed world plane at **`z = 0`**. Room geometry is shifted relative to that plane via the **Room depth** setting.
- Head displacement changes the relative viewpoint, exposing different faces of objects; the effect is not solely a 2D scaling/zoom operation.
- The original **Window** mode best matches conventional fish-tank VR: head-coupled off-axis projection while the viewing direction remains fixed.
- The extra **Room** mode adds moderated head yaw/pitch/roll and bounded translation into/out of the scene. This is intentionally more stylized than pure physically calibrated fish-tank VR.
- A reference arrow may cross the monitor plane; it demonstrates the conceptual depth relation while the rendered image remains physically clipped by the monitor edges.

## Extensions and refinements on top of upstream

1. **Room mode and camera-relative origin.** The camera-image center represents neutral head X/Y and forward-facing orientation represents neutral rotation. Starting off-center does not silently reset position to zero.
2. **Controlled Z translation.** Estimated face distance is a heuristic. In Room mode a small share of Z motion affects off-axis projection (12%, limited to ±0.18 scene units); most contributes to bounded virtual travel. Window/Hybrid retain their conventional projection behavior.
3. **Iris-relative gaze.** Landmarks around the eyes, including iris landmarks, are measured relative to the eye boundaries instead of using blendshape scores as the principal gaze signal. Independent X/Y gains, smoothing and a dead zone reduce unwanted drift.
4. **Head orientation.** The face transformation matrix contributes yaw/pitch; roll also considers the eye-to-eye axis, with a configurable strength and optional inversion.
5. **Body fallback.** Pose Landmarker Lite may estimate relative motion when the face disappears. During handover, body displacement is amplified (3.5×), gaze and head rotation trend back toward frontal neutral, and rapid jumps are speed-limited. Tracking loss transitions gradually rather than teleporting the camera.
6. **Diagnostics.** Monitor-plane markers, optional 3D depth reference arrow, face/head axis, pose skeleton, live metrics, and an independent 3D-object animation freeze switch assist evaluation.
7. **Persistent preferences.** A versioned allow-list of GUI settings is saved in browser `localStorage`. The internal key is `headtracking3d.room11.settings.v1` to preserve compatibility with existing profiles. Import/export uses a JSON file; values are validated and bounded to the UI control ranges. Camera calibration measurements and sensor frames are never persisted.

## Calibration and practical caveats

- In **Room** mode, `R` calibrates reference face size/distance and neutral gaze without changing the camera-relative head X/Y origin or current yaw/pitch/roll orientation.
- In the other viewing modes, calibration may also treat the current head orientation as a neutral pose.
- This is not a true metrically calibrated tracker; the viewing-distance suggestion (~50–75 cm), face-size depth estimate and scene units are approximations.
- The optional pose model may use a GPU delegate when available and fall back to CPU; the main face-tracking experience should continue if the pose model cannot be initialized.
- Speed and precision depend on webcam frame rate, scene lighting, browser/GPU behavior and face/body visibility. Body-only fallback is an approximation, not an accurate physical-body reconstruction.
- Three.js, MediaPipe runtime and face/pose model files are fetched from third-party hosts. The code processes webcam frames locally; it does not implement user-video uploads.

## Settings and regression checks

- Mode, sliders and checkboxes **auto-save** and restore within the same browser origin; manual Save, Import/Export JSON and Restore Defaults controls are also available.
- The existing internal storage-key name is retained on purpose to avoid losing users' saved settings merely because the public-facing edition name has changed.
- `tests/test-body-fallback-11.cjs` verifies tracking fallback behavior; `tests/test-english-release.cjs` verifies packaging, source references and UI; `tests/test-config-persistence.cjs` verifies stored preferences, invalid values and import/export logic.
- These deterministic tests are not substitutes for a live test with a real webcam and monitor.
