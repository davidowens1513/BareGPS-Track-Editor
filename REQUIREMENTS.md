# Accepted requirements

- Android and iOS app; native Files import and save.
- GPX is the initial supported format, confirmed by the user.
- Multiple files and multiple tracks; select portions by dragging endpoint handles.
- Split tracks; join selected sections in walking order; preview originals or output; save edited results.
- OpenTopoMap terrain as the single base map; no layer selector.
- Automatically fit relevant geometry to the map; expandable/collapsible map.
- Green BareGPS mark at the upper left and green app title, always visible. Placeholder mark accepted initially.
- Map at the top, analytics in the centre, file/edit operations at the bottom.
- Persistent distance and ascent, with live updates.
- Colour picker for track polylines.
- Non-contiguous joins are dashed.
- **User correction:** dashed walking connections count in distance **and ascent**, because they must be walked.
- Error handling from the beginning.

## Calculation policy

Every connection counts in distance. Every available elevation change counts in ascent/descent, including the positive/negative endpoint change across an unprofiled gap. Unprofiled gaps are explicitly estimated. The user can fetch intermediate terrain to include hills/valleys; failed lookups do not change the route. Missing recorded elevation produces partial/unknown ascent, never fabricated heights. Output is continuous GPX with BareGPS dashed-edge extensions so connection distance also counts in other GPX readers.

## Verification evidence

See `VALIDATION.md` for executed checks and any remaining platform verification limits. Store publication, developer signing, offline tile packs and automated path routing were not requested.

## Sample and branding update — 6 November 2026

- Use Irish example tracks; the illustrative samples are Glendalough Upper Lake and Spinc ridge in County Wicklow.
- Use a logo showing two endpoint circles joined by a winding line. Match the green used for the BareGPS Ireland title: `UIColor.systemGreen` / light `#34C759`.
- Explain the title-line tick: it was automatic local workspace saving. Replace the unexplained symbol with a readable Saved indicator and explain that GPX export remains a separate action.
- Display the complete title **BareGPS Track Editor**, without a slash or middle dot.
