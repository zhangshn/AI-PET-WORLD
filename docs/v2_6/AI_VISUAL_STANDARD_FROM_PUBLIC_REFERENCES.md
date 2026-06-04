# AI-PET-WORLD AI Visual Standard

Version: v2.6 formal visual standard  
Date: 2026-06-04  
Status: Formal rule source for world visual generation and visual review

## 1. Purpose

AI-PET-WORLD uses an AI visual standard, not copied reference images.

The visual system may read public design materials, accessibility standards, game UI principles, and pixel-art education materials. It must extract abstract principles only, then convert those principles into project-owned visual rules and review algorithms.

The goal is:

```txt
Public references / good cases / design standards
-> Abstract visual principles
-> AI-PET-WORLD visual rules
-> Generation rules
-> Visual review conditions
-> Correction plan
-> Display only after pass
```

The visual system must not copy screenshots, game UI layouts, character designs, logos, proprietary pixel assets, or identifiable art styles.

## 1.0 MVP Final Visual Quality Bar

MVP does not mean "temporary test map".

The final visual bar for MVP is a polished, playable pixel-world frame with:

- A clear construction or world-story focal point.
- A readable foreground path leading into the focal area.
- A developed work yard around the active construction fact.
- Distinct construction parts such as foundation, scaffold, posts, material piles, and unfinished edges.
- Rich terrain layering: grass patches, worn soil, stones, bushes, flowers, height/edge changes, and ecological clusters.
- Foreground, middle ground, and background rhythm.
- Natural framing around the play area instead of random scattered decoration.
- Material ramps for grass, soil, stone, wood, leaf, water, shadow, and highlight.
- No dashboard/card UI in the world-first screen.

This is a quality requirement, not a reference-image copy requirement.

The project may use user-approved target examples as a quality bar, but must convert them into project-owned rules:

```txt
Target quality example
-> abstract composition requirements
-> AI-PET-WORLD scene composition algorithm
-> visual judge metrics
-> display only after pass
```

The system must not copy any specific screenshot, layout, asset, tree shape, water edge, building design, palette identity, or proprietary expression.

For MVP, a frame that still looks like a flat green test field with scattered objects does not pass the product bar, even if the technical renderer works.

## 1.1 How The AI Draws And Judges

For AI-PET-WORLD, AI drawing is not "place random assets until the screen is full".

The formal drawing logic is:

```txt
Public visual knowledge
-> abstract design principles
-> AI-PET-WORLD-owned visual rules
-> deterministic generation algorithms
-> visual judge metrics
-> blocked unless final review is pass
```

When an AI draws a good game frame, it reasons in this order:

1. Big composition first: readable foreground, middle ground, background, focal area, and quiet space.
2. World meaning second: terrain, paths, structures, ecology, construction, traces, and event marks must say what happened in the world.
3. Shape readability third: large shapes and silhouettes must read before small texture is added.
4. Pixel clusters fourth: details should support clusters and rhythm, not become random single-pixel noise.
5. Palette and contrast last: color must support hierarchy, material identity, and gameplay readability.

Therefore the visual judge must reject frames that are technically rendered but do not read as an intentional playable world.

This means the following frame types cannot pass:

- A flat test-map field with scattered objects.
- A screen filled by grass texture but lacking world facts.
- A frame where small objects are used to cheat foreground-density metrics.
- A frame with no visual focus, no readable path, and no world-story structure.
- A frame that looks like copied external game art, UI, logo, character, or branded style.

## 2. Source Policy

Allowed inputs:

- Public design principles.
- Accessibility standards.
- General game readability guidance.
- Pixel-art education about silhouette, palette, contrast, and low-resolution clarity.
- Real-world observation at the level of abstract structure, such as road hierarchy, building parts, terrain variation, and ecological clustering.

Forbidden inputs:

- Copying a specific game screenshot.
- Rebuilding another game's UI layout.
- Storing external reference images as project assets.
- Copying characters, icons, logos, names, or proprietary visual identity.
- Prompting the system to imitate a living artist, studio, IP, or named game style.

The safe path is:

```txt
External material
-> Principle extraction
-> Own rule vocabulary
-> Own pixel recipes
-> Own visual review
```

## 2.1 Public Evidence To Project Rule Table

This table is the formal bridge between public material and AI-PET-WORLD's own visual judge.
The project uses the sources only as principle inputs. No screenshot, layout, asset, logo, character, or proprietary style is copied.

| Public principle input | Abstract AI principle | AI-PET-WORLD rule | Algorithm / judge condition | Current failure meaning |
|---|---|---|---|---|
| Pixel-art education commonly prioritizes readability and cluster clarity over noisy detail. Reference: [Pixel Art Daily - What Makes Good Pixel Art](https://www.pixelartdaily.com/blog/what-makes-good-pixel-art) and [Pixel Art Daily - Fix Messy Pixel Art](https://www.pixelartdaily.com/blog/how-to-fix-messy-pixel-art). | A pixel scene must read at game scale before detail matters. | Objects and terrain marks must form readable clusters, not random specks. | Check semantic block count, visible area, oversized flat blocks, fragmented traces, micro-scatter ratio, and anchor-group ratio. | A field of tiny scattered bushes, flowers, or stones is blocked even if object count is high. |
| Environment and composition guidance separates foreground, middleground, and background to create depth and scale. Reference: [Muddy Colors - Composition Basics: Value Structure](https://www.muddycolors.com/2012/08/composition-basics-value-structure/) and [Frozenbyte Level Art: Composition](https://wiki.frozenbyte.com/index.php/Level_Art%3A_Composition). | A world frame needs layered spatial rhythm. | The world canvas must have readable foreground, middle area, and upper/background area. | Measure meaningful content distribution in top/middle/lower bands; fail dead lower world and top-heavy imbalance. | A flat top-heavy map with an empty lower play area is blocked. |
| Game environment art should preserve gameplay function and player comprehension. Reference: [The Level Design Book - Environment Art](https://book.leveldesignbook.com/process/env-art). | Decoration must support what the player understands about the world. | Roads, traces, structures, ecology, and construction marks must explain world state. | Validate path connectivity, nearby access traces, construction-stage readability, and visual fact manifest coverage. | Pretty texture without path/world-state meaning cannot pass. |
| Game readability guidance emphasizes hierarchy, focal story, and quiet regions before detail. Reference: [GamineAI - Pixel Art Composition Rules](https://gamineai.com/blog/10-pixel-art-composition-rules-readability-in-game-2026). | A screen needs a clear visual story and intentional silence. | The frame must not be uniformly busy or uniformly empty; it needs a readable focus and supporting rhythm. | Reject center obstruction, dead empty fields, object-density overload, visual-only fake composition lines, and detail replacing structure. | A screen that looks like random filling or test output is blocked. |
| Environment art and focal-story principles require the most important world fact to carry first-read meaning. Reference: [The Level Design Book - Environment Art](https://book.leveldesignbook.com/process/env-art) and [GamineAI - Pixel Art Composition Rules](https://gamineai.com/blog/10-pixel-art-composition-rules-readability-in-game-2026). | Decoration must not dominate the real world event, construction, road, or facility. | If the world has a construction/facility/event anchor, it must be visually stronger than decorative nature and large enough to read at screen scale. | Compare story-anchor readable area against decorative support area; fail weak story anchors, tiny screen anchors, and test-map-like frames. | A tiny construction block surrounded by stronger trees, stones, and decorative clusters is blocked. |
| Autonomous world generation needs fact-backed composition, not hand-painted fixes. Reference: [The Level Design Book - Environment Art](https://book.leveldesignbook.com/process/env-art). | The renderer may project existing facts into readable visual structure, but it cannot create new facts. | Construction/facility/event anchors automatically project staging traces such as foundation ground, worked soil, and access paths. | Story staging traces must be derived from an existing source object id and remain read-only visual projection. | A construction fact can create a visible construction footprint, but it cannot invent another building or gameplay fact. |
| Readability guidance emphasizes silhouette, contrast, shape language, and value separation. Reference: [Coartist - Character Design Readability](https://coartist.net/blog/character-design-readability-silhouette-shape-language-contrast) and [Sandboxr - Character Silhouettes That Work](https://sandboxr.com/character-silhouettes-that-work-visual-readability-in-game-design/). | The player should identify important forms quickly. | Important world objects need distinguishable silhouette, contact shadow, base/body/part separation, and contrast from ground. | Check object visible area, block count, contrast-related palette discipline, structure parts, and contact/base cues. | Flat boxes, invisible objects, or same-value object/ground blends are blocked or warned. |
| Accessibility and UI clarity guidance treats contrast and non-text graphical clarity as important to comprehension. Reference: [W3C WCAG Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). | Important visual information cannot rely on barely visible color differences. | Important world/UI graphics need enough contrast, shape redundancy, or position redundancy. | Style and contrast audits reject unsupported color families, weak visual distinction, and hidden critical state. | A frame where roads, structures, or cues blend into the ground cannot pass as player-ready. |
| Style-safety guidance for AI-assisted art must avoid copying protected expression. | Learn principles, not expression. | AI-PET-WORLD uses its own palette, recipes, naming, and layout vocabulary. | Style safety rejects reference-image storage, named IP/style tokens, copied layouts, and external asset leakage. | A frame that appears copied from a named game, brand, artist, or screenshot is blocked. |

The rule is strict:

```txt
If a visual frame does not satisfy these project-owned rules,
it is not "passed" even if the renderer can draw it.
```

## 3. Public Principles Converted Into Project Rules

### 3.1 Visual Hierarchy

Principle:
Players should understand what matters first.

Project rules:

- The world canvas is primary.
- HUD and debug UI must not dominate the world.
- During the current world-first stage, P-Phone and butler status stay out of the main world screen.
- Important structures, roads, and active world changes need stronger contrast than background decoration.
- Empty space is allowed only when it supports navigation or mood; dead empty fields fail review when they make the world unreadable.

Review conditions:

- Main world area must be visible without card panels.
- UI overlay area must remain below a strict threshold.
- Central player reading area must not be blocked by opaque panels or large debug blocks.
- Important objects must have distinguishable silhouette, base, body, and shadow.

### 3.2 Figure-Ground Contrast

Principle:
World objects must separate from the ground.

Project rules:

- Trees, stones, buildings, facilities, roads, and ecology cues need enough value contrast from their surrounding tiles.
- Contrast may come from outline, shadow, highlight, hue shift, or shape grouping.
- A visible object cannot be only a flat block close to the background color.

Review conditions:

- Object visible area must exceed minimum readable area.
- Object block count must exceed minimum semantic part count.
- Background and object colors must not collapse into the same value band.
- Important objects need shadow or base contact cues.

### 3.3 Pixel Readability

Principle:
Pixel art works by readable clusters, not random noise.

Project rules:

- Every object recipe must express semantic parts.
- Trees require canopy, trunk, shadow, and highlight clusters.
- Buildings require roof or top mass, wall/body, entrance/base, and shadow.
- Roads/traces require continuous readable segments.
- Grass and terrain details should be clustered, not scattered as meaningless specks.

Review conditions:

- Low block count fails or warns depending on object class.
- Low visible area fails or warns depending on object class.
- Trace fragmentation fails display in the current test stage.
- Natural detail clusters must stay coherent.

### 3.4 Palette Discipline

Principle:
Limited palettes improve cohesion and readability in low-resolution art.

Project rules:

- World visuals use project-owned palette ramps.
- Each material needs a small ramp: shadow, base, highlight.
- Grass, soil, stone, wood, leaf, water, structure, and UI colors must stay within project palette families.
- High saturation is reserved for focus, alerts, or rare world signals.

Review conditions:

- Unsupported color families are rejected.
- Natural objects must use ecology-compatible colors.
- Style-safety audit rejects external IP/style tags.
- Palette sprawl is treated as a visual quality problem.

### 3.5 Spatial Legibility

Principle:
The player should understand where things are and how they relate.

Project rules:

- Roads, traces, entrances, and construction zones must be readable.
- A structure without an entrance cue is not visually complete.
- A town or later city must show road/building relationships before it shows decorative detail.
- Terrain transitions should communicate biome, moisture, wear, or recovery.

Review conditions:

- Structures/facilities need nearby access traces.
- Trace networks must avoid excessive disconnected clusters.
- Large unstructured fields should trigger composition warnings or failures.
- Construction stages need foundation/scaffold/unfinished-edge cues.

### 3.6 Game UI Minimalism

Principle:
For an immersive game screen, UI should support the world, not replace it.

Project rules:

- The current formal `/world` page is a world renderer, not a dashboard.
- No right-side status cards in the world-first stage.
- No visual judge panel on the player world screen.
- Debug information may appear only when the frame is blocked or in debug routes.
- P-Phone returns later as an in-world interaction layer, not as a web card.

Review conditions:

- Formal world page must mount Pixi canvas.
- Formal world page must not depend on SVG, hand-written canvas context, or debug HTML blocks.
- Formal world page must not display phone/butler/status cards during world-first stage.

### 3.7 Accessibility And Clarity

Principle:
Readable contrast and clear interaction states improve playability.

Project rules:

- UI and important non-text visual elements need adequate contrast.
- Focus/active states must not rely only on color.
- Small objects need silhouette or shadow support.
- UI targets are not the current priority on `/world`, but when reintroduced they need game-native clarity.

Review conditions:

- Important UI/non-text cues should target at least a 3:1 contrast relationship where applicable.
- Small important visual signals need shape or position redundancy, not color alone.
- Overlays cannot hide critical world state.

## 4. AI Algorithm Authority

For visual generation and review, "AI algorithm authority" means:

- AI extracts abstract principles from public materials.
- The project owner approves the rule direction.
- The rules are encoded as deterministic project policies.
- The renderer and visual judge follow those policies.
- Any displayed world frame must pass the visual gate.

It does not mean:

- The AI may invent new world facts.
- The AI may copy another game's look.
- The AI may override runtime facts for beauty.
- The AI may display a failed frame just because the canvas can render.

## 5. AI Visual Rubric

The project rule is: how the AI judges a good game image must be converted into explicit review axes.

When the AI looks at a world frame, it does not only ask whether the pixels exist. It asks whether the image reads as an intentional playable world. AI-PET-WORLD converts that judgement into these formal axes:

### 5.1 Composition Balance

AI judgement:

- Does the frame have foreground, middle ground, and background rhythm?
- Is the content concentrated in one corner or one band?
- Is empty space intentional, or does it feel like an unfinished test map?

Project algorithm:

- Measure meaningful world content in top, middle, and lower screen bands.
- Treat trees, buildings, traces, actor markers, and construction cues as meaningful content.
- Treat ground texture as supporting detail only.
- Fail display if the lower playable area is too thin.
- Fail display if the upper band dominates the foreground beyond the allowed ratio.
- Fail display if foreground content is made mostly of tiny scattered objects without anchor clusters.
- Fail display if small details are used to fake composition instead of expressing world facts.
- Fail display if the main construction/facility/event anchor is too small for the current screen scale.
- Allow story-anchor footprint to include automatic read-only staging traces only when those traces are derived from the same world fact source id.

### 5.2 Visual Readability

AI judgement:

- Can a player immediately understand what the object is?
- Can the player read roads, traces, terrain transitions, and construction footprints?
- Are objects expressed as pixel clusters rather than large flat debug blocks?

Project algorithm:

- Check object visible area.
- Check semantic block count.
- Check trace segmentation.
- Check structure base, body, entrance/access cues, and shadow/contact cues.
- Reject oversized flat trace blocks and unreadable object silhouettes.
- Reject a world frame that has no first-read focal area or playable-world structure.

### 5.3 Texture Versus World Fact

AI judgement:

- Does the image contain real world information, or only decorative noise?
- Does surface texture support the world, or is it hiding an empty scene?

Project algorithm:

- Separate readable ground detail from meaningful world content.
- Ground detail may improve mood and surface quality.
- Ground detail cannot satisfy foreground/world-content requirements by itself.
- Visual-only corrections may improve expression, but cannot invent runtime facts.

### 5.4 Palette And Contrast Discipline

AI judgement:

- Do important objects separate from the ground?
- Is the image using a coherent palette instead of arbitrary colors?
- Are shadows, highlights, and material ramps consistent?

Project algorithm:

- Keep project-owned palette families for grass, soil, stone, wood, leaves, water, structure, shadow, and highlight.
- Reject unsupported style/IP color signals.
- Important graphical objects should have enough contrast from nearby ground, guided by non-text contrast principles.

### 5.5 Style And Copyright Safety

AI judgement:

- Is the image using general visual principles, or copying a specific external work?
- Does the generated image look like AI-PET-WORLD rather than another game?

Project algorithm:

- Public references are used only as abstract principles.
- No external screenshots, assets, UI layouts, logos, character designs, or named styles are stored or copied.
- The visual judge checks for reference leakage and forbidden style tokens.

### 5.6 Display Decision

The visual gate uses the rubric as a blocker, not as decoration.

```txt
AI judgement axis
-> measurable project metric
-> finding
-> correction intent
-> visual-only correction if possible
-> post-correction review
-> pass only display
```

If an issue cannot be safely corrected without changing runtime facts, the frame remains blocked.

## 5.7 Visual-Only Composition Correction

When a frame fails AI visual standards but the issue is purely presentational, the visual system may generate a corrected pixel buffer.

Allowed visual-only corrections:

- Add construction access or footprint cues when a construction fact already exists.
- Add ecology tint or clustering when ecology facts already exist.
- Repair broken trace connectivity when existing trace facts already exist.

Forbidden visual-only corrections:

- Drawing synthetic foreground lines only to satisfy composition metrics.
- Inventing a new building.
- Inventing a new character.
- Inventing a new event.
- Changing runtime resources, placements, plans, facts, or tick state.
- Copying a reference image or external game composition.

The rule is:

```txt
Original frame fails
-> create visual-only correction plan
-> generate corrected pixel buffer
-> run visual judge again
-> display corrected frame only if finalSeverity === "pass"
```

The failed original frame is not player-visible.

Composition failures are special: if the current runtime facts do not provide enough real world content to compose a good foreground/middle/background scene, the frame must remain blocked until the world generator or painter can create a better fact-backed scene. A visual-only patch cannot pretend to be meaningful world content.

## 6. Display Gate Rule

Current test-stage display rule:

```txt
finalSeverity === "pass" -> display
finalSeverity === "warn" -> do not display
finalSeverity === "fail" -> do not display
```

If the system can correct a visual issue without changing runtime facts, it may generate `visual_only` corrected buffer cells and run a post-correction review.

Only the corrected frame may display, and only if post-correction review is `pass`.

## 7. Current World-First Scope

In the current phase, the project focuses only on world drawing:

- Terrain.
- Ground texture.
- Trees.
- Stones.
- Buildings/facilities.
- Roads/traces.
- Ecology transition.
- Composition and density.

Deferred:

- Butler status UI.
- P-Phone full UI.
- Town/city management panels.
- Player-facing debug/audit panels.

## 8. Reference Sources Used As Principle Inputs

These sources are used only for abstract principles:

- [Pixel Art Daily - What Makes Good Pixel Art](https://www.pixelartdaily.com/blog/what-makes-good-pixel-art): readability and clear pixel-art fundamentals.
- [Pixel Art Daily - How to Fix Messy Pixel Art](https://www.pixelartdaily.com/blog/how-to-fix-messy-pixel-art): zoomed-out readability and cleanup principles.
- [Muddy Colors - Composition Basics: Value Structure](https://www.muddycolors.com/2012/08/composition-basics-value-structure/): foreground/middleground/background and value hierarchy.
- [Frozenbyte Wiki - Level Art: Composition](https://wiki.frozenbyte.com/index.php/Level_Art%3A_Composition): level-art composition, depth, foreground/background forms.
- [The Level Design Book - Environment Art](https://book.leveldesignbook.com/process/env-art): environment art as cosmetic world expression while preserving gameplay function.
- [GamineAI - Pixel Art Composition Rules](https://gamineai.com/blog/10-pixel-art-composition-rules-readability-in-game-2026): readability, focal story, quiet regions, and cluster-friendly composition.
- [Coartist - Character Design Readability](https://coartist.net/blog/character-design-readability-silhouette-shape-language-contrast): silhouette, shape language, contrast, and hierarchy.
- [Sandboxr - Character Silhouettes That Work](https://sandboxr.com/character-silhouettes-that-work-visual-readability-in-game-design/): silhouette and value-first readability.
- [W3C WCAG 2.2 - Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): contrast expectations for non-text graphical objects and UI states.

No source image, UI layout, game screenshot, logo, or proprietary asset is copied into AI-PET-WORLD.
