# Cargo Stacker Game Assets v1 — Concept Art Refresh

Drop-in replacement asset pack for the Cargo Stacker prototype.

This refresh keeps the **same folder structure and filenames** as the previous `cargo_stacker_game_assets_v1` pack, so it can be unzipped over the old asset library or copied into the same import paths.

## What changed

- Backgrounds were replaced with polished concept-art-style harbor plates:
  - daytime harbor
  - sunset harbor
  - night harbor
  - stormy harbor
- Container sprites were rebuilt from the concept-art designs.
- Container branding now matches the concept sheet:
  - NORTHWIND LOGISTICS
  - IRONHARBOR SHIPPING
  - REDSTONE FREIGHT
  - SKYLINE CARRIERS
  - SOLACE GLOBAL
  - TITANFORGE INDUSTRIES
  - VERIDIAN TRANSPORT
  - WAYPOINT EXPRESS
- App icons, UI, VFX, textures, and reference concept files were refreshed while preserving existing filenames.

## Important compatibility note

The ZIP root folder is still:

```text
cargo_stacker_game_assets_v1/
```

All asset filenames are preserved from the original pack. Existing code that loads the previous cargo asset paths should continue to resolve these files.

## Use

Unzip this package over the old `cargo_stacker_game_assets_v1` folder, or replace the old folder entirely.

## Limits

These are improved game-ready prototype assets, but not a final production art pass. The 3D OBJ files remain placeholder geometry. The strongest assets in this pack are the 2D/2.5D backgrounds and container sprites.
