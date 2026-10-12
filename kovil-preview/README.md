# Approved kovil stage preview

The original 1672 × 941 image is used without recoloring, cropping, or removing any details. The pavilion, trees, steps, printed heading, lighting, scroll rods and silhouettes are preserved.

The sixteen lamps reuse the ceremony app's existing `lamp-factory.js` geometry, materials and volumetric flame shader. Only the flag interiors add new 3D geometry. Their original printed artwork is sampled directly from the background and moves through anchored cloth morph poses.

## Open

From the Digital Oil Lamp project's local server, open:

`http://127.0.0.1:8766/kovil-preview/index.html`

All resources are local and work offline. Mouse clicks, touchscreen taps and keyboard activation use the same buttons. The view is fitted inside the screen with the complete image visible.

## Controls

- Touch the main lamp to grow its flame and then light the next lamp on the steps.
- Touch a small lamp to inspect its flame directly.
- Previous selects the preceding lamp. Undo reverses the latest added lighting.
- Pause freezes flag and flame motion; Resume continues it.
- Fullscreen fills the display; Escape returns to the normal browser view.

The supplied image already shows lamp 01 lit, so this visual preview begins at lamp 02 and preserves the original first flame. This is a separate visual preview inside the local project; the setup, guest data and ceremony finale remain in the main application.

## Verification

Native image-only rendering matches the source pixels exactly. The image SHA-256 is `c033309a385b7a24191f58acdae1f8b248ac295558a7dc884cf3469787f9568b`. Browser checks verify alignment, cloth motion, lighting, touch input, pause, fullscreen and Escape at native resolution and at 1024 × 768.
