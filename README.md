# Emberdeep — 3D Action Dungeon Crawler

[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/)
[![rank](https://make.fun/badge/best-game-01/saifulsidik801-ship-it/best-game-01-emberdeep/rank.svg)](https://make.fun/)
[![reward](https://make.fun/badge/best-game-01/saifulsidik801-ship-it/best-game-01-emberdeep/reward.svg)](https://make.fun/)

**Emberdeep** is an original 3D action dungeon crawler built with Three.js.
The ember veins beneath Emberdeep Town have gone wild: forest wisps turn
feral, stone wakes in the deep halls, and something vast stirs below. Take
up the ember blade, clear the Whisperwood, descend the Sunken Halls, and
slay the **Magma Colossus**.

## How to play

- **WASD** move · **mouse drag** orbit camera · **left click / J** sword combo (3 hits)
- **Q** Ember Nova — fire burst, costs 30 energy · **Space** dodge roll (brief invulnerability)
- **E** talk / enter gates / open chests · **I** Almanac · **P / Esc** pause · **M** mute
- **1 / 2 / 3** pick a level-up boon

## The delve

1. **Emberdeep Town** — a living hub: wandering townsfolk, market stalls, a
   fountain, torches, flags, and Smith Bram's Ember Smithy (spend gold on
   upgrades and relics).
2. **Whisperwood** — a dense living forest: 80 trees, fireflies, falling
   leaves, god-rays, glowing mushrooms, hopping critters — and the
   **Warden of the Wood** mini-boss.
3. **Sunken Halls I & II** — torch-lit dungeon rooms with patrolling golems,
   imps and stalkers, braziers, banners, ember dust and chests.
4. **Colossus Vault** — the **Magma Colossus** final boss with telegraphed
   slams, charges and imp summons. Win, then keep going in **Endless mode**.

## Systems

- **14 relics** with real effects (lifesteal, thorns, phoenix revive, …),
  found in chests, boss drops and the Smithy's relic shelf
- **3 difficulties** — Ember, Flame, Inferno (+50% gold & XP) — plus Endless waves
- **Level-ups** with a choice of 3 boons, **Smithy upgrades** (4 tracks × 3 levels)
- **Feats** (9 achievements), **Almanac** bestiary + relic tracker, full HUD
  (HP / energy / XP, score, gold, timer, zone progress, boss bar, combo)
- Synthesized WebAudio sound (no audio files): swings, coins, level-ups,
  boss roars, ambient wind

## Run it

Static files only — no build step, no network request:

```sh
node serve.ts
# open http://localhost:8080
```

Built as an entry for the [make.fun](https://make.fun/) **best-game-01**
competition. Original game, original names, original art (all models are
Three.js primitives) — no borrowed world.
