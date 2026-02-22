# Battleship

A web-based Battleship game with an AI opponent featuring three difficulty modes (Easy, Medium, Hard).

## Quick Start

Open `battleship.html` in a browser to play.

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
npm ci
```

### Run Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run coverage
```

### Run AI Simulation

Run the full calibration suite (10,000 games per difficulty, all three modes):

```bash
npm run simulate
```

Quick simulation (500 games per difficulty):

```bash
npm run simulate:quick
```

Custom simulation:

```bash
npm run simulate -- --difficulty medium --games 5000 --seed 42
node tools/simulate.js --difficulty hard --games 10000 --seed 1234
```

#### Simulation Options

| Option | Description | Default |
|--------|-------------|---------|
| `--difficulty <easy\|medium\|hard>` | Run only one difficulty | all three |
| `--games <N>` | Number of games per difficulty | 10000 |
| `--seed <N>` | Base seed for reproducible runs | random |
| `--board-size <N>` | Board size | 10 |

Results are saved to `reports/` as JSON data and SVG heatmaps.

## Project Structure

```
battleship.html          # Main game (HTML + CSS + JS, playable in browser)
src/
  engine.js              # Testable game engine (extracted core logic)
  difficulty-config.js   # AI difficulty parameters (tunable config object)
tools/
  simulate.js            # Calibration simulation CLI tool
  seeded-rng.js          # Deterministic PRNG (mulberry32)
tests/
  unit.test.js           # Unit tests for core functions
  integration.test.js    # Integration tests for game flow
  simulation.test.js     # Statistical simulation tests
reports/                 # Simulation output (JSON + SVG heatmaps)
.github/workflows/
  test.yml               # CI pipeline (tests + coverage)
```

## AI Difficulty Modes

| Parameter | Easy | Medium | Hard |
|-----------|------|--------|------|
| Distract chance | 42% | 15% | 5% |
| Search pattern | Pure random | Checkerboard parity | Probability density |
| Confusion chance | 30% | 0% | 0% |
| Adjacent drop rate | 30% | 0% | 0% |
| Track ship sizes | No | Yes | Yes |
| Hit-adjacent boost | 0 | 3 | 5 |

All modes reset hunt state completely after sinking a ship, never fire at the same cell twice, and maintain some element of randomness.

## License

MIT
