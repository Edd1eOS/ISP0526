# ADR 0003: Three.js + React Three Fiber for landing-page 3D globe

- Status: Superseded by ADR 0004
- Date: 2026-05-26

## Context

The landing page hero is a rotating earth with regional landmarks. The first
implementation used a flat SVG with a 2D `rotate()` animation on a continent
layer. Reviewer feedback: when the layer rotates, the back side of the "globe"
is visually empty, breaking the illusion of a true sphere. We needed a real
3D sphere so that the back hemisphere is geometry, not absent content.

Considered alternatives:

1. Pure SVG/CSS: scroll an equirectangular continent strip horizontally under
    a circular clip, with edge-vignette to fake sphericity. No dependency cost
    but no real depth, no perspective foreshortening, and landmark anchoring
    is fragile.
2. Three.js + React Three Fiber + drei: real sphere with a canvas-painted
    equirectangular texture; landmarks parented to the sphere as 3D meshes at
    lat/lon coordinates; orbiter as a separate animated mesh.

## Decision

Adopt option (2): `three` `^0.184`, `@react-three/fiber` `^9`,
`@react-three/drei` `^10`. `@types/three` as dev dependency.

The landing scene (`apps/web/src/features/landing/hero-globe.tsx`) is the only
client of this stack. Other features remain SVG/Tailwind.

## Consequences

- Bundle cost is acknowledged (~150 KB gzip for three + R3F core, plus drei
   helpers tree-shaken to what we actually import). Acceptable because the
   landing page is the single highest-impact first-impression surface.
- Continents are rendered procedurally from a polygon table painted onto a
   2048×1024 canvas texture (no external map assets, no licensing concerns).
- Landmark models are minimal primitive composites (cylinders / cones /
   boxes) styled to match the clay palette; they are parented under the
   rotating earth group so they ride the surface naturally.
- Renderer config: `alpha: true`, `antialias: true`, `dpr=[1,2]`. Shadows
   enabled. A second hemisphere mesh with `BackSide` material provides a
   warm halo.
- Subsequent 3D surfaces (timeline, intake) must reuse this stack rather
   than introducing alternatives.
