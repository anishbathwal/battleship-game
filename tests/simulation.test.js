/**
 * Simulation tests - verify statistical properties of AI across difficulties.
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/engine.js';

const N = 200; // games per test (enough for statistical significance in test, not full calibration)

describe('Simulation: per-cell hit distribution', () => {
  it('center cells are hit more often than corner cells across many games', () => {
    const sz = 10;
    const cellHits = Array.from({ length: sz }, () => Array(sz).fill(0));

    for (let i = 0; i < N; i++) {
      const result = GameEngine.simulateAIGame({ difficulty: 'medium', seed: i + 5000 });
      for (let r = 0; r < sz; r++) {
        for (let c = 0; c < sz; c++) {
          if (result.shotBoard[r][c]) cellHits[r][c]++;
        }
      }
    }

    const centerHits = (cellHits[4][4] + cellHits[4][5] + cellHits[5][4] + cellHits[5][5]) / 4;
    const cornerHits = (cellHits[0][0] + cellHits[0][9] + cellHits[9][0] + cellHits[9][9]) / 4;

    // Center should be hit more frequently than corners
    expect(centerHits).toBeGreaterThan(cornerHits);
  });
});

describe('Simulation: accuracy by difficulty', () => {
  it('hard AI has higher accuracy than easy AI', () => {
    let easyAccTotal = 0, hardAccTotal = 0;
    for (let i = 0; i < N; i++) {
      const easy = GameEngine.simulateAIGame({ difficulty: 'easy', seed: i + 3000 });
      const hard = GameEngine.simulateAIGame({ difficulty: 'hard', seed: i + 3000 });
      easyAccTotal += easy.accuracy;
      hardAccTotal += hard.accuracy;
    }
    expect(hardAccTotal / N).toBeGreaterThan(easyAccTotal / N);
  });

  it('hard AI takes fewer average turns than easy', () => {
    let easyTurns = 0, hardTurns = 0;
    for (let i = 0; i < N; i++) {
      const easy = GameEngine.simulateAIGame({ difficulty: 'easy', seed: i + 4000 });
      const hard = GameEngine.simulateAIGame({ difficulty: 'hard', seed: i + 4000 });
      easyTurns += easy.turns;
      hardTurns += hard.turns;
    }
    expect(hardTurns / N).toBeLessThan(easyTurns / N);
  });

  it('medium AI performance is between easy and hard', () => {
    let easyTurns = 0, medTurns = 0, hardTurns = 0;
    for (let i = 0; i < N; i++) {
      const easy = GameEngine.simulateAIGame({ difficulty: 'easy', seed: i + 6000 });
      const med = GameEngine.simulateAIGame({ difficulty: 'medium', seed: i + 6000 });
      const hard = GameEngine.simulateAIGame({ difficulty: 'hard', seed: i + 6000 });
      easyTurns += easy.turns;
      medTurns += med.turns;
      hardTurns += hard.turns;
    }
    const easyAvg = easyTurns / N;
    const medAvg = medTurns / N;
    const hardAvg = hardTurns / N;
    expect(hardAvg).toBeLessThan(medAvg);
    expect(medAvg).toBeLessThan(easyAvg);
  });
});

describe('Simulation: AI never fires same cell twice', () => {
  it('no duplicate shots in 100 games per difficulty', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      for (let seed = 1; seed <= 100; seed++) {
        const engine = new GameEngine({ difficulty: diff, boardSize: 10, seed });
        engine.placePlayerRandom();
        engine.placeAI();
        engine.phase = 'playing';
        engine.turn = 'ai';

        const fired = new Set();
        let turns = 0;
        while (engine.phase === 'playing' && turns < 100) {
          const result = engine.aiTurn();
          if (!result) break;
          const key = `${result.r},${result.c}`;
          expect(fired.has(key), `Duplicate shot at ${key} in ${diff} seed=${seed}`).toBe(false);
          fired.add(key);
          engine.turn = 'ai';
          turns++;
        }
      }
    }
  });
});

describe('Simulation: hunt reset after sink', () => {
  it('AI completely resets hunt state after sinking in all games', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const engine = new GameEngine({ difficulty: 'medium', boardSize: 10, seed });
      engine.placePlayerRandom();
      engine.placeAI();
      engine.phase = 'playing';
      engine.turn = 'ai';

      let prevShipCount = 5;
      let turns = 0;
      while (engine.phase === 'playing' && turns < 100) {
        const result = engine.aiTurn();
        if (!result) break;

        // Count remaining ships
        const remaining = Object.values(engine.pH).filter((h) => h > 0).length;
        if (remaining < prevShipCount) {
          // A ship was just sunk - verify hunt state is reset or targeting next ship
          // If no more unresolved hits, hunt should be fully reset
          if (engine.aiHits.length === 0) {
            expect(engine.aiHuntTarget).toBeNull();
            expect(engine.aiHuntHits).toHaveLength(0);
            expect(engine.aiQ).toHaveLength(0);
          }
          prevShipCount = remaining;
        }

        engine.turn = 'ai';
        turns++;
      }
    }
  });
});
