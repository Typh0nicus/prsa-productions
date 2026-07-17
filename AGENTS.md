## Prša Productions — current project direction

This brief supersedes the retired personal-portfolio direction. `archive/DESIGN_FOUNDATION.retired.md` remains retired and must not be used.

### Brand model

- The primary brand is **Prša Productions**. Preserve the spelling **Prša**.
- Gregor Prša is the lead figure and public face, not the whole company.
- The site must be able to accommodate more collaborators and team members without a structural rewrite.
- Keep attribution honest: do not silently turn Gregor's historic personal credits into company-wide claims.
- Do not invent metrics, testimonials, client results, awards, job titles, or services.

### CURRENT DIRECTION (July 2026, from Gregor): white + blue, Overluce base

- The site is now **light**: #F5F5F5 field, #313336 ink, #1033FF electric blue as the ONLY accent (sampled from Overluce). The HERO stays the dark cinematic cover ("front page is fine") and ends in a crisp cut into the white world — do not blend the seam.
- Overluce grammar is adopted sitewide: `+ (Label)` kickers open sections (this supersedes the old kicker ban), medium-weight statements (clamp(34,3.6vw,56)/500/-.038em) instead of giant display heads, no head hairlines (whitespace rhythm), filled-rectangle `.btn` system (blue/ink, caps 11px, arrow nudge).
- Theme switching: `#nav` gains `nav-light` past the hero (wordmark inverts via `filter:invert(1)`); the HUD adapts via `mix-blend-mode:difference`; Sidemen's emblem uses the `invert` data flag on light. Case pages are light via `cs-body`.
- All interaction systems (word-rise, scramble, beam, rails, constellation, HUD, loader) survive the pivot — they are the "innovate on top" layer Gregor asked for. Dark-only devices (starfield, smoke plates, aurora) are retired but preserved in git history / assets.
- Repo: github.com/Typh0nicus/prsa-productions (main). The complete dark build is the baseline commit — never force-push over it.

## Art direction (dark-era notes below; superseded where they conflict with the pivot)

- Professional, premium, dark production-studio atmosphere.
- Use dimensional backgrounds, restrained spatial grids, layered surfaces, and cinematic image treatment inspired by the supplied Workflow Accelerator/COSMOQ and studio references.
- Primary palette remains near-black with monitor azure and one restrained warm counterpoint. Avoid violet, cream themes, uncontrolled neon, and decorative glow for its own sake.
- The Prša Productions wordmark is the author. Client work and recognizable client identities are the principal proof.
- Mine reference logic, not fingerprints. Do not reproduce Overluce's flags, kicker syntax, menu shape, or exact layouts.
- Avoid generic SaaS dashboards and generic AI-agency polish. The site must still feel rooted in editing, motion, and entertainment.

### Hero (locked)

- The hero is the creator-ensemble composite (`assets/hero/creator-ensemble-merged-v1.png`) with the headline "We edit what you watch.", the deck "Post-production behind some of the world's biggest channels." ("The part you don't see:" was removed by user request July 15), and the sculpted "See the work" CTA. The headline must identify editing at first glance. Do not replace this concept or its copy without an explicit request.
- Typographic voice: tight Inter grotesque. The emphasized phrase ("don't see.") carries the metallic silver gradient. Instrument Serif italic was tried and explicitly rejected — do not reintroduce it.
- Interface chrome follows the COSMOQ "sculpted card" recipe (see `Workflow Accelerator/COSMOQ Mining Notes.md`): graduated multi-layer shadows + opposing azure/warm inset rim-lights on dark gradient fills. Flat hairline/square chrome was tried and rejected as a downgrade.
- CTA light system (locked behavior): at rest, the static top-center shine with bloom (the original reference look — do not widen, dim, or remove). On hover/focus, the `.cta-beam` light orbits the border: a conic-gradient highlight masked to the 1px border ring (`mask-composite:exclude`) animating a registered `--beam-angle` property. The light lives INSIDE the hairline — never an overlaid streak element; anything that protrudes past the frame reads broken (offset-path streak version was rejected). On hover-out it completes the current lap back to its start (top center, where the static shine sits) and parks; re-hovering mid-lap continues seamlessly; a second hover-out within the same lap must not queue an extra spin. Implemented via `animation-play-state` + `animationiteration` in `initMotion()` — do not replace with a plain `:hover` animation. The loader's aperture keeps the matching `plSweep` light.
- The `.work` section is `pointer-events:none` (only `.work-rail` re-enables pointers). This protects the hero CTA from the -12svh overlap — do not remove.

### Work section (current direction)

- Overluce-inspired dual rails: two opposite-drifting marquee rails of real thumbnails (16 curated works from works.json split across them), pause on hover, title reveals on card hover, click → case-study. The scroll-pinned single-frame stage was rejected; do not resurrect it.
- The section backdrop is `assets/backdrops/continuation-clients-v1.png` — the user-generated continuation of the hero ensemble (clients rising on the right, sparser). It fades in from the hero seam and out at the bottom. Two more stored atmospheres for future sections: `assets/backdrops/smoke-corridor.png`, `assets/backdrops/smoke-floor.png`.
- The headline gloss (`.hero-title strong`) is chrome: white top, gray horizon band ~70%, bright bottom lip. Matched to the user's reference; do not flatten.
- Gregor's portrait belongs in the studio/leadership story below the hero.
- Copy states the studio's role plainly; proof is real or absent.

### Navigation

- Buttons: 52px, 10px radius, dark gradient fill, subtle azure/warm inset rims, static top light line that brightens on hover. Spring easing `--ease-spring` on hovers.
- Menu overlay: links vertically centered in the left column with hairlines running to the screen edge; hover shows a 4px azure dot in the gutter, whitens the label, and dims the media wall.
- Menu choreography (locked by user preference — backdrop-first content staggering was tried twice and rejected as glitchy): the overlay fades as ONE silk sheet (`.mnav` opacity .5s in / .32s quart out). Links stagger in at .12/.2/.28s, media plane .04s, socials .38s. Section jumps happen *while covered* (`window.scrollTo` `behavior:'instant'` before the exit fade) and the destination then plays a `.arrive` entrance (blur/rise .75s) after the menu closes. `exitMenu()` owns close-button, Escape, and link exits (340ms timer); `openMenu` clears the pending exit timer.
- Never give `.mtop`, `.mclose`, or other menu contents their OWN exit animations separate from the sheet — a chrome fade against a still-opaque backdrop blinks the logo out (user-reported bug). The sheet fades as a whole; the pinned page chrome beneath makes the wordmark crossfade invisible.
- Chrome pinning (locked): `.mtop` uses the same `.wrap nav-in` skeleton as `#nav`, so the wordmark and the burger/close button occupy identical pixels in page and menu — verified pixel-equal. Do not give the menu header its own geometry.
- The right side is the drifting showreel wall fed by `works.json` + `menu-videos.json` (menu-only volume library, deduplicated by video id).

### Credits section

- `#credits` sits between Work and About, in the menu as the 2nd link. Fed by `credits.json` — an ordered array (renown-first; the user owns the order and the display names) of `{name, avatar, mark?}`; `mark: true` renders a contained wordmark chip (Sidemen) instead of a cropped circle.
- Credits is a **hand-composed collage board** — every channel individually placed like a graphic edit. Three earlier concepts were REJECTED: chip/card grids ("SaaS panel"), typographic roll ("2016 test website"), split index+monitor with STARRING/FEATURING labels ("too corny"). Do not return to any of them; the user wants each person *considered individually*.
- The board is a **constellation with renown-gravity** (this is what made it read Apple/COSMOQ-grade instead of "sprinkled"): MrBeast at dead center inside a soft azure light field (`.credits-board::before`), the six giants in the inner orbit, mid channels in the second ring, ensemble on the outer rim (dimmed to .82 via `board-item--far` for depth). Renown = proximity to center AND size. Keep this radial logic when adding channels.
- Loverfella and What's Inside are `emblem` too — free-form marks; cover-cropping marks into circles is the recurring "broken" look. When a new channel's avatar is a designed mark rather than a photo, default to `emblem`.
- Section grammar for elevation (apply to About/Contact next): environment first (light field + vignette on `::before`, fades in via `.in-view`), then an **ignition entrance** (`popIn` on `.board-pop`-style wrappers, paused until in-view, center-outward stagger), and a head lockup where the real number gets the chrome gloss (`.credits-head>p strong` shares the hero/work metallic rule).
- Menu + footer socials include LinkedIn (https://www.linkedin.com/in/gregor-pr%C5%A1a-825ab5265/).
- Lenis is SELF-HOSTED at `assets/vendor/lenis.min.js` (the CDN was unreliable from file:// and killed the scroll weight) — never revert to the CDN.
- **ABOUT AND CONTACT ARE FROZEN.** Do not style, animate, re-copy, or add anything to them — not even "obvious" improvements — until the user explicitly opens those sections. An unrequested About/Contact pass (backdrops + reveals) was fully reverted on demand. Reference material the user shares is the QUALITY BAR, never an instruction to transplant assets or ideas into unopened sections.
- The stored plates in `assets/backdrops/` (aurora-horizon, smoke-floor, continuation) remain reserved for future passes the user initiates.

### Mined signature systems (July 2026 reference dump — keep, don't regress)

- **Hero word-rise** (Mosaicist/OBSCURA SplitText grammar, vanilla): `splitWords()` wraps each headline word in `.w-mask > .w`; words rise from `translateY(115%)` behind overflow masks on `body.in`, 70ms stagger. `.w-strong` carries the metallic gradient (selector shares the gloss rule).
- **Menu decrypt** (Cinética ScrambleText grammar, vanilla): menu links scramble-resolve left→right over ~340ms on pointerenter (`GLYPHS`, 12 frames). Covert cipher = brand-true. Skipped under reduced motion.
- **HUD** (HAOQI grammar): fixed bottom utility layer — live local clock + UTC offset left, 4-digit cursor coordinates right. 10px caps at .2 alpha, z:95, fades in 1.5s after reveal, hides when menu opens and under 1120px.
- **Credits starfield** (Boiler Lab star canvas): `initStarfield()` — 110 twinkling drifting stars behind the constellation, IntersectionObserver-gated rAF, DPR-aware. MUST be called from renderCredits AFTER `board.innerHTML` (innerHTML wipes the canvas — this bug shipped once).
- Reference saves live in `C:\Users\brnsl\Downloads\` (HAOQI, Boiler Lab, OBSCURA, Cinética, Mosaicist + full asset folders incl. Overluce's complete images). Future material: Cinética image-flash loaders, Boiler Lab moon/typewriter, HAOQI THREE.js field, OBSCURA/Viacheslav layouts — propose before transplanting anywhere, and never into frozen sections.
- Reveal grammar covers work + credits only (work-head/rails, credits-head/board); the two selector lists in index.html (setupWorkReveal + menu-travel force) must stay in sync.
- `CREDIT_LAYOUT` in index.html maps each name → `[x%, y%]`. **Size is computed from `subs`** (millions, in credits.json/FALLBACK_CREDITS — estimates the user corrects) via `creditSize()`: logarithmic 56→198px so MrBeast doesn't dwarf everyone. Parallax depth also derives from size.
- The head's right label is computed: "≈880M+ subscribers combined" (sum of subs, floored to 10M). The "35 channels" counter was removed by user request.
- Entry flags: `emblem` (MrBeast, Sidemen) = the mark floats FREE — no bubble, no border, contained with drop-shadow, wider box (×1.6) — "understand how their logo works"; `logo` (KSI, AMP, SypherPK, Miniminter, CouRage, What's Inside, TBJZL, Loverfella, FutCrunch) = crisp badge rendering, lighter grade (photo-grading murks badge art — this was the Loverfella bug).
- Life: bob (`boardBob`), cursor-depth parallax, hover = full color + scale 1.05 + caption (NAME ONLY — per-channel subs display was rejected; subs drive size only), **focus-pull** via OPACITY on `.board-bob` (.4) — never via filters. Reveal = staggered opacity fade. All motion off under reduced motion.
- **Never animate filters on the emblems** (and avoid filter-based dims board-wide): animated drop-shadow/brightness on large transparent images promotes a GPU layer that renders as a visible rectangle under the grain overlay (user-reported "doodoo" hover). Emblems keep ONE static drop-shadow and animate transform only.
- Size curve caps at ~168px (56+112·t) — 198 was "a bit too big". `#nav.scrolled` is rgba(8,10,14,.9) so board items don't ghost through the bar.
- EVERY data set must have an inline fallback in index.html (`FALLBACK_CREDITS` etc.) — the user opens the site as `file://` where fetch() fails; a JSON-only section renders empty for them (reported bug).
- Voice per the archived foundation doc: the section is called "Credits" (never "Clients").

### Work section

- The Work rails are fed exclusively by `work-videos.json` (falls back to `works.json` featured if missing). The user curates this list directly — do not repopulate it from the menu library.
- Structure (COSMOQ header rhythm × the approved old showreel): statement head "Work that's been watched **1.57B** times." (metallic strong, `text-wrap:balance`, no right-side label — "Long-form and Shorts" was removed by user request) over a wrap-width hairline, then two full-bleed drifting rails of large cards (clamp(280px,36svh,390px), 20px radius, hairline border, graded 4-layer shadows, spring hover lift + title-in-scrim reveal). 110s/128s-reverse drift, 4% edge masks (Overluce marquee law).
- Rail hover SLOWS the drift to 0.35× via `anim.updatePlaybackRate()` (JS in renderWorkWall) — never `animation-play-state:paused`; a dead stop was rejected, 0.2 was too slow. Menu link order: Work, About, Credits, Contact.
- The work statement renders as ONE line (`white-space:nowrap` on desktop, normal under 820px) — the two-line balance was rejected.
- The 1.57B figure is the user-stated real total (July 15, 2026) — Overluce law: numbers must be real or absent.
- `assets/backdrops/aurora-horizon.webp` (mined from the COSMOQ source assets — their blue→amber horizon light plate) is stored for a future scene (candidate: the Contact resting point). COSMOQ's atmosphere is built from soft pre-rendered glow plates like this; ours is live CSS — adopt plates only for deliberate scene moments.
- Atmosphere: faint azure/warm radials + `assets/backdrops/smoke-corridor.png` at .26 opacity screen-blend, masked to the lower half. Abstract haze only — the client-continuation backdrop with faces behind the rails was rejected as a mess; never put figurative imagery between the rails.
- Scroll reveal: `.work-head`/`.work-rail` blur-rise via IntersectionObserver (`setupWorkReveal()`), second rail delayed .14s, disabled under reduced motion.
- The duplicated `.rail-set` clone must stay `aria-hidden` but NEVER `inert` — inert kills pointer events and makes half the drifting cards hover-dead (user-reported bug).
- Menu-nav arrivals animate the target section's CONTENT BLOCKS (`:scope > .wrap, :scope > .work-rails`, staggered 90ms) — never the section element itself; a section-level opacity animation black-holes the viewport (user-reported "insanely broken").
- Global film grain: `body::after` fixed overlay (soft-light, .06, z-index 90) unifies hero/work/about/contact atmosphere — COSMOQ texture continuity.

### Continuous canvas (locked)

- The page's base field lives on `body::before` (fixed, z:-2): a NEUTRAL 160deg gradient only. Never put colored radials on a fixed layer — a viewport-glued glow "follows" the user while scrolling (reported bug). Accent light belongs to sections, scrolling with them. Sections NEVER own an opaque background (`.contact` had one — removed); they only add accents.
- Scroll-linked states must be kicked once after reveal (`kick()` rAF loop in initMotion) — otherwise a reload at a restored scroll position shows un-receded hero states until the first user scroll (reported bug).
- Everything hero-owned must dissolve BEFORE the hero's bottom edge: the ensemble mask ends transparent at 94%, `.hero-atmosphere` is masked out by 96%. Any hero layer that reaches 100% paints a visible band at the section boundary (pixel-verified seamless: Δ luminance ≈ 0.1/255 across the seam).
- Scroll exit: `initMotion`'s rAF also recedes `.hero-ensemble` (opacity → .5, translateY -24px, scale down as you scroll; inline `transition:none` is set on first scroll so the entrance transition never fights the scroll-link).
- Menu travel must NOT replay section entrances — it only forces `in-view` on the target's reveal elements. Re-running entrance animations on revisit reads as "the section reset" (user-reported bug, twice). First-time reveals happen only via the IntersectionObserver.
- The work stage disables pointer events until it is substantially visible (`intro > .55`) so it never blocks hero interactions across the -12svh overlap.

### Process

- Work one section per pass and screenshot-verify desktop and mobile before presenting.
- `works.json` remains the canonical source for featured work data.
- Keep changes deliberate and remove obsolete personal-portfolio behavior as sections are rebuilt.
