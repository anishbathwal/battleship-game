# Changelog

## [1.0.0] - 2026-02-22

### Added

- **Testable game engine** (`src/engine.js`): Extracted all core game logic (placement, AI targeting, probability maps) from `battleship.html` into a standalone ES module for headless testing and simulation.
- **Difficulty configuration** (`src/difficulty-config.js`): Centralized tunable config object for all three AI difficulty modes (easy/medium/hard). Parameters include `distractChance`, `useParity`, `useProbDensity`, `confusionChance`, `adjacentDropChance`, `trackShipSizes`, and `hitAdjacentBoost`.
- **Seeded RNG** (`tools/seeded-rng.js`): Mulberry32-based deterministic PRNG with helpers (`int`, `shuffle`, `pick`) for reproducible simulation runs.
- **AI difficulty modes**:
  - **Easy**: 42% distract chance, pure random search, 30% confusion chance on direction recognition, 30% adjacent cell drop rate. Feels beatable but still attempts adjacent cells after hits.
  - **Medium**: 15% distract chance, checkerboard parity search, systematic hunt-and-extend, adjusts search spacing based on smallest remaining ship size.
  - **Hard**: 5% distract chance, probability density targeting (favors high-probability cells), aggressive hunt-and-extend with line continuation, tracks remaining ship sizes, slight randomness (10% top-5 pick) to avoid full predictability.
  - **All modes**: Complete hunt state reset after sinking a ship; AI never fires at the same cell twice; always maintains some randomness.
- **Unit tests** (`tests/unit.test.js`): 54 tests covering orientation helpers, `sCells`, `canPI`, placement/removal, AI selection functions (`aiPickTarget`, `aiRandom`, `aiStartHunt`, `aiExtendLine`), `calcProbMap`, seeded RNG, and difficulty config.
- **Integration tests** (`tests/integration.test.js`): 19 tests covering game initialization, fleet placement, `submitFleet`, player firing (hit/miss/sunk), AI turns, turn alternation, full game completion, `simulateAIGame`, determinism, difficulty ordering, and multiple board sizes.
- **Simulation tests** (`tests/simulation.test.js`): 6 statistical tests validating per-cell hit distribution (center > corner), accuracy ordering (hard > medium > easy), turn count ordering, no duplicate shots, and hunt reset after sink.
- **Simulation tool** (`tools/simulate.js`): CLI tool that runs N games (configurable, default 10,000 per difficulty) and outputs per-cell hit counts/percentages (JSON), summary metrics (percentiles, center vs corner probability, accuracy), and SVG heatmaps.
- **CI workflow** (`.github/workflows/test.yml`): GitHub Actions pipeline that installs, runs tests, generates coverage, and uploads coverage report. Coverage thresholds set to 80% statements/lines/functions, 70% branches.
- **Reports** (`reports/`): Baseline and final simulation results (JSON + SVG heatmaps) for all three difficulty modes.
- **Package scripts**: `test`, `coverage`, `simulate`, `simulate:quick`.

### Calibration Results (10,000 games, seed 42)

| Metric                  | Easy  | Medium | Hard  |
|-------------------------|-------|--------|-------|
| Avg turns to win        | 70.0  | 58.1   | 45.1  |
| Accuracy (%)            | 25.8  | 31.1   | 39.3  |
| Center 4 hit prob (%)   | 73.2  | 62.7   | 64.9  |
| Corner hit prob (%)     | 65.1  | 54.5   | 15.6  |
| Median turns            | 70    | 57     | 45    |
| p95 turns               | 95    | 84     | 62    |

### Coverage

- Statements: 97.64%
- Branches: 94.18%
- Functions: 91.17%
- Lines: 97.64%
