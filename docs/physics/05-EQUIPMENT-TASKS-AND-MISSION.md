# Tasks, carried equipment, metabolic workload and mission lifecycle

## 1. Three stages, fixed landing point for demo
1. **Capsule Setup**: preselected **team-defined** landing site; no player pin-selection or random location in current demo. Show relevant loadout and mission status only when Rachel's visuals are ready.
2. **Surface EVA**: player walks/accelerates with suit constraints, encounters science task and consumes resources even when standing. Tasks have state transitions independent of visual animations.
3. **Return Home**: return to the **same landed shuttle**, then optional departure cutscene toward station. Cutscene duration is not counted as walked surface EVA unless gameplay explicitly decides to do so.

The future system will automatically select a valid random landing site from a verified **offline-supported region catalog**; **the human never selects it**.

## 2. Four independent scientific tasks
| Task type (existing `TaskId`) | Player action/visual | Equipment and state | Physics cost |
| --- | --- | --- | --- |
| `abrade-rock` | Surface abrasion exposes fresh material | abrasion tool issued at shuttle, carried home | task-specific duration/power not yet calibrated; generic demo task power allowable |
| `take-core` | Drill cylindrical core and seal sample | drill issued at shuttle and returned; **collected core/sample adds carried mass** | tool operation workload and carried sample mass; numbers deferred |
| `sample-depot` | Place sealed sample tube(s) on ground | sample(s) may have been preloaded at shuttle; deposited tubes **remove** carried mass | placement effort/duration; no dependency on `take-core` |
| `run-moxie` | Operate portable fictionalized CO2->O2 science instrument | experimental device carried to task and **back** to shuttle | human setup/workload; **device electrical watts are NOT human metabolic watts**; **NO suit O2 refill** |

These are *four possible tasks*; the originally planned full mission samples two independently. RAW's current fixed demo has `take-core` and `run-moxie` (user's latest 3h priority is only modest task integration, not all production logic). The human-player mission starts only from the preselected point.

### Real NASA analogy
- NASA Perseverance actually used **rover-mounted** MOXIE: 17.1kg unit, ~300W electrical, ~122g O2 total over campaign, peak 12g/h; experiment ended 2023 [N10]. No hose filling a suit in Sharkies.
- NASA rover cores, abrasion and tube caches are real scientific activities, but the physical embodiment and human tool loads in Sharkies are **story adaptation**, not NASA procedure specifications.
- Rachel's `research/10-training-tasks.md` previously enumerated **seven** rover activities and suggested game durations; current user scope overrides that catalog with **four independent** game tasks. In particular, original "MOXIE refill" concept is superseded.

## 3. Inventory state and load effect
~~~text
inventory = items with massKg, location={shuttle,carried,deployed,deposited}
carriedMassKg = sum(item.massKg where location==carried)
totalBodySuitLoadKg = astronautKg + suitKg + carriedMassKg
~~~
- At the shuttle only the **two selected task kits** are equipped, not every tool in all four task types.
- Abrasion/drill/MOXIE are carried back if selected (confirmed); new rock core increases carried load; sample depot leaves tubes and reduces it.
- Without agreed item masses use a **fixed, explicitly labelled temporary carriedMassKg assumption**, not fabricated individually "NASA-sourced" masses. Make future inventory provider pluggable.
- Recompute speed, uphill cost, weight and oxygen rate against *current* load, not the outbound mass on the return leg.
- Distinguish carried vs temporarily deployed item at worksite, with explicit state transitions; "tool placed on ground" during animation is not automatically "left behind".

## 4. Time / task-work charge
- The physics integrator uses **simulated seconds** from the existing 60Hz RAW core, not duration of a 3D animation render or React timer.
- If an activity is in a blocking/science-work state, use `powerTaskW` as TOTAL metabolic workload for that duration. Don't charge simultaneously walk + task + idle for the same time.
- The current RAW API emits `task-started`/`task-completed` when the user dispatches actions within 5m; it does NOT enforce physical task duration. First demo can keep this while providing a basic truthful task activity mode. More elaborate per-task durations and abort/recovery policies need separate review.
- If a visual clip ends while physics says the task is not yet complete, **physics remains authoritative**. Animation is presentation, not a credential for state change.
- If O2 fails at 0g during an active task, it cannot finish successfully. Suppress further completion commands until reset.

## 5. Mission success, warnings and failure
- **Confirmed:** O2 zero => mission failed. A completed task is NOT the same as successful extraction.
- **Long-term goal:** complete selected tasks, return to shuttle, leave by short cutscene. Exact successful completion gate and failure after getting lost (without oxygen depletion) remain open.
- Route is **a visual suggestion, not a mandatory corridor**; player may deviate within playable bounds. Return-on-reverse-original-route vs reverse-actual-trail **remains unresolved** when deviating.
- Reserve threshold is an indicator, not a guaranteed safe return without a validated backward-route cost estimate.
- Distinguish landing/shuttle coordinate from global (0,0), DEM projected origin and NASA Octavia E. Butler rover historic site.

## 6. Team handoff
- Rachel controls visual assets and animations. Her `sampleSite.ts` is a combined visual prototype, not four independent physics mechanics.
- Alex owns task status, activity workload, equipment mass transitions, oxygen state and game-over.
- Nanda estimates waypoints/routing and optionally return cost; no silent mutation of suit gas.
- Victor provides valid ground height and placement constraints; no change to mesh for the physics task.
