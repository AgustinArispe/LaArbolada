---
target: tercera pasada de diseño sobre la homepage
total_score: 26
p0_count: 0
p1_count: 4
timestamp: 2026-07-18T00-13-33Z
slug: src-pages-index-astro
---
⚠️ DEGRADED: single-context (two sub-agent assessment attempts remained non-responsive and were interrupted)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 2 | The sticky journey label, chapter heading and visible photo can communicate different states. |
| 2 | Match System / Real World | 4 | The spatial order and Spanish labels match a real visit through the property. |
| 3 | User Control and Freedom | 3 | Galleries, anchors and lightbox are controllable, but fixed layers obstruct the journey. |
| 4 | Consistency and Standards | 2 | Navigation tone, progress placement and chapter composition do not behave consistently across viewports. |
| 5 | Error Prevention | 2 | The UI permits title, counter and image state to drift perceptually out of sync. |
| 6 | Recognition Rather Than Recall | 3 | Rooms are named clearly, but the long route and duplicated progress make orientation harder. |
| 7 | Flexibility and Efficiency | 3 | Anchor navigation and gallery controls provide direct routes. |
| 8 | Aesthetic and Minimalist Design | 2 | Strong photography is weakened by giant gaps, thin type and component-like gallery framing. |
| 9 | Error Recovery | 3 | Menu and lightbox have clear exits; the journey-state mismatch has no visible correction. |
| 10 | Help and Documentation | 2 | Contact is clear, but interaction cues and journey orientation remain uneven. |
| **Total** |  | **26/40** | **Acceptable baseline; major flagship-quality issues remain.** |

## Anti-Patterns Verdict

The current version is substantially better than a generic accommodation template, but still carries recognizable generated-design grammar: oversized fine serif type, repeated large editorial gaps, a dark rectangular media component, and progress strips that feel like application chrome. The strongest non-template asset is the real photography and the correctly curated spatial sequence.

The deterministic scan returned zero findings for `src/pages/index.astro` and `src/components`. This is not a clean visual bill of health: the detector does not capture the layering and synchronization bugs visible in `room-mobile-390.png`, `room-desktop-1440.png`, and `gallery-desktop-1440.png`.

No reliable user-visible detector overlay was created because this environment does not expose a presentable mutable browser tab. Existing Playwright screenshots were used as visual evidence.

## Overall Impression

The architecture and content sequence are sound. The biggest opportunity is to make each room feel like one coherent scene: title, progress, photograph and navigation must occupy the same visual system and change from one source of truth.

## What's Working

- The Casa and Departamento routes are separated and follow a natural physical order.
- Real landscape photography remains dominant and is preserved with `object-fit: contain` in galleries.
- The hero is genuinely fullscreen and its first composition already carries a strong sense of place.

## Priority Issues

### [P1] Competing fixed layers obscure content and create ghost headings

**Why it matters:** The fixed navbar plus sticky journey strip causes headings and prior-section text to remain visible around or behind the header. This breaks trust in the page's spatial logic.

**Fix:** Keep one fixed navbar, define one `--nav-height`, remove mobile sticky journey progress, and use a desktop-only side index offset below the navbar.

**Suggested command:** `$impeccable adapt`

### [P1] Chapter state is perceptually desynchronized

**Why it matters:** A room label and counter can remain on screen while a different room image is visible, as in the reported “Fachada 02/12” versus living photograph mismatch.

**Fix:** Render local chapter progress from the same room object that supplies title and images. Add semantic data attributes and automated assertions for room classification, count and previous/next links.

**Suggested command:** `$impeccable harden`

### [P1] Typography and color lack flagship clarity

**Why it matters:** Instrument Serif at weight 400 becomes fragile over photography and at large sizes. The muted palette reduces both warmth and contrast for older visitors.

**Fix:** Move to locally hosted Fraunces at 520-650 and Source Sans 3 at 400-650, raise body copy to 18-20px, and use the supplied forest, emerald, burgundy and terracotta palette with AA contrast.

**Suggested command:** `$impeccable typeset`

### [P1] Galleries read as technical components

**Why it matters:** The hard rectangular frame and full-plane rotation make the imagery resemble a notebook or card falling forward.

**Fix:** Introduce editorial radii and soft depth, keep the base photograph stable, and animate only a shallow central split overlay with a faster 580-680ms transition.

**Suggested command:** `$impeccable animate`

### [P2] Vertical rhythm contains empty-screen valleys

**Why it matters:** The title, image and following chapter lose continuity, especially on mobile and at the transition into the final gallery.

**Fix:** Reduce chapter padding, remove sticky-title negative offsets, cap empty pauses below 20svh on mobile, and keep headings visually attached to their media.

**Suggested command:** `$impeccable polish`

## Persona Red Flags

**Jordan, first-time visitor:** The double header system makes it unclear whether the sticky label or the large chapter title is authoritative. The long blank area before the image delays understanding of the room.

**Riley, stress tester:** Fast scrolling and gallery interaction reveal independent state machines: intersection-based journey progress, local carousel state and navbar sampling. These can disagree.

**Casey, mobile visitor:** A persistent 58px journey bar beneath the 64px navbar consumes too much of an 844px viewport and can cover headings. Some 16px copy is below the requested comfort threshold.

## Minor Observations

- The mobile gallery index should not become a second sticky header.
- The full-page reduced-motion captures reveal all hero copy at once and are not valid evidence of the normal cinematic sequence.
- Panoramic and room images need a consistent radius rule, with intentional full-bleed exceptions.
- Desktop side navigation should indicate the active room without adding another horizontal band.

## Questions to Consider

- Can every screenshot be understood without remembering the previous viewport?
- Does each motion communicate arrival, orientation or a state change?
- Which photographs deserve full bleed, and which benefit from a softer architectural frame?

Questions skipped: the user already specified the priority, artistic direction, typography, palette and full implementation scope.
