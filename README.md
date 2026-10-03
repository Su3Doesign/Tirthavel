# Tirthavel · The Ring Gate — Art & Making

A concept-art book as a website: the world-building sketchbook behind **Kaalavalaya**, a 156-metre stone ring with a door no one may enter, and **Tirthavel**, the drowned city that climbs toward it.

- A scroll-driven three.js story built on the real gate mesh: one day passes over the Ring, from dawn to the Hollow Sun.
- Chapters on origins and lore, why a ring, the Mahabharata echoes behind it, the gate, the citadel, materials, the sea, light and the making-of, with hand-drawn annotations throughout.
- A 3D turntable of the gate in clay, ink, stone and overgrown looks.

## Run it locally

The 3D parts load files, so the page needs a local server rather than a double-click:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Publish with GitHub Pages

Go to **Settings → Pages** and set **Source** to **Deploy from a branch**, then pick **main** and **/ (root)**. The site appears at `https://su3doesign.github.io/Tirthavel/`.

Everything is vendored (three.js, rough.js, fonts), so the page makes no external requests.
