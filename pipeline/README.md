# Data pipeline (run once)

Python scripts that turn NASA data into the static files in `public/`. Owners: Victor (terrain, comms, units), Nanda (O₂ grid, routes).

Planned scripts (TEAM-PLAN.md sections 5 and 6): `warp.sh`, `tiles.py`, `viewshed.sh`, `units.sh`, `cost.py`, `o2_grid.py`, `routes.py`.

Raw downloads go in `pipeline/raw/` and intermediates in `pipeline/work/`. Both are git-ignored. Regenerate outputs from scripts; don't hand-edit files in `public/`.
