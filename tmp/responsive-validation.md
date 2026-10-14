# Responsive validation notes

Validated in the integrated browser on 24 September 2026 at 390×844 and 768×1024. The 390px Participate view kept all region tabs, composer controls, cards and bottom navigation visible without horizontal clipping. The 768px Board retained a usable Excalidraw surface with panning, and the facilitator controls remained legible and touch-sized. No browser console warnings or errors were reported.

## Scope

The responsive override targets the current Board, Participate, and Review views at:

- 390px phone portrait
- 768px tablet portrait
- phone landscape up to 932px wide and 520px high
- coarse pointers, device safe areas, and reduced-motion preferences

## Expected behavior

- The phone Board header removes project metadata and secondary top-bar actions, preserves the activity title and Participate action, and reserves space for the fixed view switcher.
- The tablet Board header uses a two-row grid. Project context truncates rather than widening the page.
- Board height follows the dynamic viewport. Landscape phones use a compact heading and a 240px minimum canvas.
- Participate region tabs remain reachable while scrolling; form controls and navigation meet a 44px minimum touch target.
- Long prompts, names, and contribution text wrap within their containers.
- Card actions stack the region selector above Edit and Delete on phones.
- Bottom navigation accounts for left, right, and bottom safe-area insets.
- Reduced-motion preference suppresses transitions and animations.

## Remaining real-device checks

- Verify Excalidraw two-finger pan and pinch zoom in Mobile Safari and Chrome for Android.
- Verify the on-screen keyboard does not cover the composer submit action at 390px.
- Verify rotation preserves the current Excalidraw viewport and contribution draft.
- Verify browser chrome expansion/collapse does not obscure the fixed bottom navigation.
- Check 200% text zoom; the Board header intentionally truncates supporting copy to two lines on phones.

## Integration

Import `responsive.css` after the existing canvas and participation styles so these scoped overrides win the cascade.
