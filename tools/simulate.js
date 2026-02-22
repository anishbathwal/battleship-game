#!/usr/bin/env node
/**
 * Battleship AI Calibration Simulation Tool
 *
 * Runs N automated games per difficulty and outputs:
 * - Per-cell hit counts and percentages (JSON)
 * - Summary metrics: hit distribution percentiles, center vs corner, accuracy
 * - SVG heatmap files
 *
 * Usage:
 *   node tools/simulate.js                                    # default 10000 per difficulty
 *   node tools/simulate.js --difficulty medium --games 5000 --seed 42
 *   node tools/simulate.js --difficulty hard --games 10000 --seed 1234
 */

import { GameEngine } from '../src/engine.js';
import { createRNG } from './seeded-rng.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, '..', 'reports');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    difficulties: ['easy', 'medium', 'hard'],
    games: 10000,
    seed: null,
    boardSize: 10,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--difficulty' && args[i + 1]) {
      opts.difficulties = [args[++i]];
    } else if (args[i] === '--games' && args[i + 1]) {
      opts.games = parseInt(args[++i], 10);
    } else if (args[i] === '--seed' && args[i + 1]) {
      opts.seed = parseInt(args[++i], 10);
    } else if (args[i] === '--board-size' && args[i + 1]) {
      opts.boardSize = parseInt(args[++i], 10);
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Battleship AI Simulation Tool

Options:
  --difficulty <easy|medium|hard>  Run only one difficulty (default: all three)
  --games <N>                      Number of games per difficulty (default: 10000)
  --seed <N>                       Base seed for reproducible runs (default: random)
  --board-size <N>                 Board size (default: 10)
  --help                           Show this help

Examples:
  node tools/simulate.js
  node tools/simulate.js --difficulty medium --games 5000 --seed 42
  node tools/simulate.js --difficulty hard --games 10000 --seed 1234
`);
      process.exit(0);
    }
  }
  return opts;
}

function runSimulation(difficulty, numGames, baseSeed, boardSize) {
  const sz = boardSize;
  const cellFireOrder = Array.from({ length: sz }, () => Array(sz).fill(0)); // sum of fire order
  const cellHitCount = Array.from({ length: sz }, () => Array(sz).fill(0)); // how often cell was fired at
  let totalTurns = 0;
  let totalAccuracy = 0;
  const turnsArray = [];

  const startTime = Date.now();

  for (let i = 0; i < numGames; i++) {
    const seed = baseSeed != null ? baseSeed + i : i + 1;
    const result = GameEngine.simulateAIGame({ difficulty, boardSize: sz, seed });

    totalTurns += result.turns;
    totalAccuracy += result.accuracy;
    turnsArray.push(result.turns);

    // Record per-cell fire data
    for (let r = 0; r < sz; r++) {
      for (let c = 0; c < sz; c++) {
        if (result.shotBoard[r][c]) {
          cellHitCount[r][c]++;
        }
        if (result.hitCounts[r][c] > 0) {
          cellFireOrder[r][c] += result.hitCounts[r][c];
        }
      }
    }

    // Progress
    if ((i + 1) % Math.max(1, Math.floor(numGames / 20)) === 0) {
      const pct = ((i + 1) / numGames * 100).toFixed(0);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\r  ${difficulty}: ${pct}% (${i + 1}/${numGames}) - ${elapsed}s`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  process.stdout.write(`\r  ${difficulty}: 100% (${numGames}/${numGames}) - ${elapsed}s\n`);

  // Compute percentages
  const cellPct = cellHitCount.map((row) => row.map((v) => (v / numGames) * 100));

  // Sort turns for percentiles
  turnsArray.sort((a, b) => a - b);
  const p25 = turnsArray[Math.floor(numGames * 0.25)];
  const p50 = turnsArray[Math.floor(numGames * 0.50)];
  const p75 = turnsArray[Math.floor(numGames * 0.75)];
  const p95 = turnsArray[Math.floor(numGames * 0.95)];
  const p99 = turnsArray[Math.floor(numGames * 0.99)];

  // Center 4 cells
  const mid = Math.floor(sz / 2);
  const center4Pct = (cellPct[mid - 1][mid - 1] + cellPct[mid - 1][mid] + cellPct[mid][mid - 1] + cellPct[mid][mid]) / 4;

  // Corner cells
  const cornerPct = (cellPct[0][0] + cellPct[0][sz - 1] + cellPct[sz - 1][0] + cellPct[sz - 1][sz - 1]) / 4;

  // Edge cells (non-corner)
  let edgeSum = 0, edgeCount = 0;
  for (let i = 1; i < sz - 1; i++) {
    edgeSum += cellPct[0][i] + cellPct[sz - 1][i] + cellPct[i][0] + cellPct[i][sz - 1];
    edgeCount += 4;
  }
  const edgePct = edgeSum / edgeCount;

  // Interior cells (not edge, not corner)
  let intSum = 0, intCount = 0;
  for (let r = 1; r < sz - 1; r++) {
    for (let c = 1; c < sz - 1; c++) {
      intSum += cellPct[r][c];
      intCount++;
    }
  }
  const interiorPct = intSum / intCount;

  return {
    difficulty,
    numGames,
    boardSize: sz,
    baseSeed,
    avgTurns: totalTurns / numGames,
    avgAccuracy: (totalAccuracy / numGames) * 100,
    percentiles: { p25, p50, p75, p95, p99 },
    minTurns: turnsArray[0],
    maxTurns: turnsArray[turnsArray.length - 1],
    center4HitPct: center4Pct,
    cornerHitPct: cornerPct,
    edgeHitPct: edgePct,
    interiorHitPct: interiorPct,
    cellHitCount,
    cellPct,
    turnsArray,
  };
}

function generateSVGHeatmap(data, filename) {
  const sz = data.boardSize;
  const cellSize = 50;
  const padding = 60;
  const width = sz * cellSize + padding * 2;
  const height = sz * cellSize + padding * 2 + 80;

  // Find min/max for color scaling
  let minPct = Infinity, maxPct = 0;
  for (let r = 0; r < sz; r++) {
    for (let c = 0; c < sz; c++) {
      if (data.cellPct[r][c] < minPct) minPct = data.cellPct[r][c];
      if (data.cellPct[r][c] > maxPct) maxPct = data.cellPct[r][c];
    }
  }

  function heatColor(pct) {
    const t = maxPct > minPct ? (pct - minPct) / (maxPct - minPct) : 0.5;
    // Blue (cold) -> Yellow -> Red (hot)
    const r = Math.round(Math.min(255, t * 2 * 255));
    const g = Math.round(t < 0.5 ? t * 2 * 255 : (1 - t) * 2 * 255);
    const b = Math.round(Math.max(0, (1 - t * 2) * 255));
    return `rgb(${r},${g},${b})`;
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:#1a1e24;font-family:monospace">\n`;

  // Title
  svg += `<text x="${width / 2}" y="30" text-anchor="middle" fill="#e0e8f0" font-size="18" font-weight="bold">AI Hit Probability - ${data.difficulty.toUpperCase()} (${data.numGames} games)</text>\n`;

  // Column labels
  for (let c = 0; c < sz; c++) {
    svg += `<text x="${padding + c * cellSize + cellSize / 2}" y="${padding - 8}" text-anchor="middle" fill="#7fb3d0" font-size="12">${c + 1}</text>\n`;
  }

  // Row labels and cells
  for (let r = 0; r < sz; r++) {
    svg += `<text x="${padding - 12}" y="${padding + r * cellSize + cellSize / 2 + 4}" text-anchor="middle" fill="#7fb3d0" font-size="12">${String.fromCharCode(65 + r)}</text>\n`;
    for (let c = 0; c < sz; c++) {
      const pct = data.cellPct[r][c];
      const color = heatColor(pct);
      const x = padding + c * cellSize;
      const y = padding + r * cellSize;
      svg += `<rect x="${x}" y="${y}" width="${cellSize - 2}" height="${cellSize - 2}" rx="3" fill="${color}" stroke="#0a1628" stroke-width="1"/>\n`;
      // Show percentage text
      const textColor = pct > (maxPct + minPct) / 2 ? '#000' : '#fff';
      svg += `<text x="${x + cellSize / 2 - 1}" y="${y + cellSize / 2 + 4}" text-anchor="middle" fill="${textColor}" font-size="10">${pct.toFixed(1)}%</text>\n`;
    }
  }

  // Legend and stats
  const statsY = padding + sz * cellSize + 20;
  svg += `<text x="${padding}" y="${statsY}" fill="#e0e8f0" font-size="12">Avg turns: ${data.avgTurns.toFixed(1)} | Accuracy: ${data.avgAccuracy.toFixed(1)}% | Center4: ${data.center4HitPct.toFixed(1)}% | Corners: ${data.cornerHitPct.toFixed(1)}%</text>\n`;
  svg += `<text x="${padding}" y="${statsY + 18}" fill="#7fb3d0" font-size="11">Percentiles - p25: ${data.percentiles.p25} | p50: ${data.percentiles.p50} | p75: ${data.percentiles.p75} | p95: ${data.percentiles.p95} | p99: ${data.percentiles.p99}</text>\n`;

  // Color legend
  const legendY = statsY + 40;
  const legendW = sz * cellSize;
  for (let i = 0; i < legendW; i++) {
    const t = i / legendW;
    const fakePct = minPct + t * (maxPct - minPct);
    svg += `<rect x="${padding + i}" y="${legendY}" width="1" height="12" fill="${heatColor(fakePct)}"/>\n`;
  }
  svg += `<text x="${padding}" y="${legendY + 24}" fill="#7fb3d0" font-size="10">${minPct.toFixed(1)}%</text>\n`;
  svg += `<text x="${padding + legendW}" y="${legendY + 24}" text-anchor="end" fill="#7fb3d0" font-size="10">${maxPct.toFixed(1)}%</text>\n`;
  svg += `<text x="${padding + legendW / 2}" y="${legendY + 24}" text-anchor="middle" fill="#7fb3d0" font-size="10">Hit Probability</text>\n`;

  svg += '</svg>\n';

  writeFileSync(filename, svg);
  console.log(`  Heatmap saved: ${filename}`);
}

function main() {
  const opts = parseArgs();

  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }

  console.log(`\nBattleship AI Simulation`);
  console.log(`========================`);
  console.log(`Games per difficulty: ${opts.games}`);
  console.log(`Board size: ${opts.boardSize}`);
  console.log(`Base seed: ${opts.seed ?? 'random'}\n`);

  const allResults = {};

  for (const diff of opts.difficulties) {
    console.log(`Running ${diff}...`);
    const result = runSimulation(diff, opts.games, opts.seed, opts.boardSize);
    allResults[diff] = result;

    // Save JSON
    const jsonPath = join(REPORTS_DIR, `${diff}-results.json`);
    writeFileSync(jsonPath, JSON.stringify({
      difficulty: result.difficulty,
      numGames: result.numGames,
      boardSize: result.boardSize,
      baseSeed: result.baseSeed,
      avgTurns: result.avgTurns,
      avgAccuracy: result.avgAccuracy,
      percentiles: result.percentiles,
      minTurns: result.minTurns,
      maxTurns: result.maxTurns,
      center4HitPct: result.center4HitPct,
      cornerHitPct: result.cornerHitPct,
      edgeHitPct: result.edgeHitPct,
      interiorHitPct: result.interiorHitPct,
      cellPct: result.cellPct,
    }, null, 2));
    console.log(`  JSON saved: ${jsonPath}`);

    // Generate SVG heatmap
    const svgPath = join(REPORTS_DIR, `${diff}-heatmap.svg`);
    generateSVGHeatmap(result, svgPath);
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const header = `${'Metric'.padEnd(30)} | ${'Easy'.padStart(10)} | ${'Medium'.padStart(10)} | ${'Hard'.padStart(10)}`;
  console.log(header);
  console.log('-'.repeat(header.length));

  const metrics = [
    ['Avg turns to win', (d) => d.avgTurns.toFixed(1)],
    ['Accuracy (%)', (d) => d.avgAccuracy.toFixed(1)],
    ['Center 4 hit prob (%)', (d) => d.center4HitPct.toFixed(1)],
    ['Corner hit prob (%)', (d) => d.cornerHitPct.toFixed(1)],
    ['Edge hit prob (%)', (d) => d.edgeHitPct.toFixed(1)],
    ['Interior hit prob (%)', (d) => d.interiorHitPct.toFixed(1)],
    ['p25 turns', (d) => d.percentiles.p25],
    ['p50 turns (median)', (d) => d.percentiles.p50],
    ['p75 turns', (d) => d.percentiles.p75],
    ['p95 turns', (d) => d.percentiles.p95],
    ['Min turns', (d) => d.minTurns],
    ['Max turns', (d) => d.maxTurns],
  ];

  for (const [label, fn] of metrics) {
    const vals = opts.difficulties.map((d) => {
      if (!allResults[d]) return 'N/A'.padStart(10);
      return String(fn(allResults[d])).padStart(10);
    });
    console.log(`${label.padEnd(30)} | ${vals.join(' | ')}`);
  }

  console.log(`\nReports saved to: ${REPORTS_DIR}/`);
}

main();
