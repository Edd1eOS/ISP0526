# ADR 0004: Scrolling SVG strip for landing-page globe (supersedes 0003)

- Status: Accepted
- Date: 2026-05-26
- Supersedes: ADR 0003

## Context

ADR 0003 introduced Three.js + React Three Fiber + drei to give the landing
hero a real 3D rotating earth so its back side is no longer empty. The
implementation worked, but on review the playful clay aesthetic that defines
the brand was lost: the meshes look generic next to the rest of the site, and
the animation has none of the elastic SVG personality (hopping kangaroos,
pop-in clay landmarks, shuttle bob) of the previous iteration.

## Decision

Revert from R3F to a pure-SVG hero, but keep the "back side is not empty"
property by rendering an equirectangular continent strip TWICE side-by-side
inside a circular `<clipPath>` and translating the inner group from `0` to
`-stripWidth` in an infinite linear loop. This produces a seamless horizontal
scroll that visually reads as a globe turning on its axis. A radial gradient
over the disk fakes spherical lighting and a halo ellipse below the equator
sells the volume.

Regional landmarks (Eiffel, Statue of Liberty + Silicon Valley campus, Mt
Fuji + pagoda) and three hopping kangaroos pop up region-by-region in a
single 24 s cycle phased to roughly match the strip's longitude offset, so
each landmark appears when its region is on the visible face.

## Consequences

- Removes `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`
  from dependencies (-47 packages); ships zero new JS for the hero.
- Restores the clay/SVG personality of the design system.
- Trade-off: the "globe" is an illusion (a scrolling strip clipped to a
  circle with a radial vignette), not real geometry. Acceptable because the
  hero is decorative and `aria-hidden`, and the perceived liveliness is the
  primary success criterion.
- Honours `prefers-reduced-motion` by halting the strip, kangaroos, shuttle,
  and landmark pop-in animations.

## Alternatives reconsidered

- Keep R3F but restyle the meshes in clay tones — would still cost the bundle
  and not deliver the SVG personality.
- Use a Lottie animation — adds a runtime dep and ties art to After Effects
  tooling not available in this repo.
