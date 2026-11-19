# SUNBURN SYNDICATE — open-world crime in Bahía Coral

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/mr1229751/sunburn-syndicate/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/mr1229751/sunburn-syndicate/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original 3D open-world crime game built with Three.js, played entirely in
the browser. Mateo "Teo" Reyes, an ex racing-boat mechanic framed by the Los
Caimanes port syndicate, works eight jobs in one week across the sun-soaked
coastal city of Bahía Coral to bring down boss Viktor "Viper" Salazar — while
the BCPD hunts him from one star to five.

## The city

- **Paseo Flamenco** — the east beach boulevard: four lanes, a double palm
  median, pastel Art Deco hotels, boardwalk, beach and the 110 m sail tower
  El Faro Sol at its north end.
- **Distrito Mirador** — the downtown of stepped glass towers, an elevated
  road, neon billboards and a fountain plaza.
- **Barrio Viejo** — the old town of tight colonial streets, iron balconies
  and string lights, home to the Taller Diablo garage.
- **Puerto Caimán** — the working port: container stacks, gantry cranes,
  warehouses, piers and the speedboat dock, joined to the peninsula by the
  Puente Bahía suspension bridge.

## What you can do

- Walk, sprint, aim and shoot in third person; steal and drive any car with
  arcade handling, drift and a chase camera.
- Live traffic AI and pedestrians who flee from danger; a wanted system from
  one to five stars with BCPD patrols, interceptors that pursue, ram and
  shoot, roadblocks, and a helicopter with a spotlight at four stars.
- On-foot combat with four weapons (Pistol, SMG, Carbine, Shotgun), enemy
  guards who take cover, and exploding ammo crates.
- Eight story jobs with GPS routing on the circular minimap: car theft, debt
  collection, a highway jack, a neon decoy run, a dockside cleanup, a tuned
  street race, a bridge convoy ambush, and a boat finale against Salazar's
  yacht.
- The Taller Diablo garage: repairs, resprays, engine tunes and chassis
  armour that really change the car, with stat bars to prove it.
- Money and Respect ranks, a start screen over the live golden-hour city, a
  pause menu with a full city MAP (click to set a waypoint), career STATS and
  three SAVE slots in localStorage, and a WebAudio radio — 98.5 CORAL FM —
  with synthesised engine and effects sounds.

## Controls

WASD move · mouse drag to look · click to shoot · E enter / steal car ·
1–4 weapons · SHIFT sprint · SPACE handbrake · ESC pause · L lighting ·
M mute.

## Run it

The game is plain static files under `game/` — no build step, no network.
Serve that folder with the bundled server:

```
node serve.ts
```

then open http://localhost:8080/ — or use any static file server pointed at
`game/`. Staged scenes for screenshots load with `?shot=cover`,
`?shot=carjack`, `?shot=shootout` or `?shot=garage` (add `&seed=1`).

The make.fun entry program is `main.ts`: it copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` using the
kit's `vendor/makefun-game.ts`.
