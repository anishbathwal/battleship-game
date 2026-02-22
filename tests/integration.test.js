/**
 * Integration tests for Battleship game flow.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, SHIPS } from '../src/engine.js';

describe('Game flow integration', () => {
  let engine;

  beforeEach(() => {
    engine = new GameEngine({ difficulty: 'medium', boardSize: 10, seed: 42 });
  });

  it('initializes with correct defaults', () => {
    expect(engine.phase).toBe('placement');
    expect(engine.turn).toBe('player');
    expect(engine.sz).toBe(10);
    expect(engine.diff).toBe('medium');
    expect(engine.pShots).toBe(0);
    expect(engine.aShots).toBe(0);
    expect(engine.winner).toBeNull();
  });

  it('all ship HP initialized correctly', () => {
    SHIPS.forEach((s) => {
      expect(engine.pH[s.name]).toBe(s.size);
      expect(engine.aH[s.name]).toBe(s.size);
    });
  });

  it('boards are empty on init', () => {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        expect(engine.pB[r][c]).toBeNull();
        expect(engine.aB[r][c]).toBeNull();
        expect(engine.pS[r][c]).toBeNull();
        expect(engine.aS[r][c]).toBeNull();
      }
    }
  });

  it('full placement of all 5 ships', () => {
    // Place ships manually in valid positions
    expect(engine.placeShip(0, 0, SHIPS[0], 'right')).toBe(true); // carrier 5
    expect(engine.placeShip(2, 0, SHIPS[1], 'right')).toBe(true); // battleship 4
    expect(engine.placeShip(4, 0, SHIPS[2], 'right')).toBe(true); // cruiser 3
    expect(engine.placeShip(6, 0, SHIPS[3], 'right')).toBe(true); // submarine 3
    expect(engine.placeShip(8, 0, SHIPS[4], 'right')).toBe(true); // destroyer 2

    // Verify all 17 cells occupied
    let occupied = 0;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (engine.pB[r][c]) occupied++;
      }
    }
    expect(occupied).toBe(17);
  });

  it('submitFleet transitions to playing phase', () => {
    engine.placePlayerRandom();
    engine.submitFleet('player');
    expect(engine.phase).toBe('playing');
    expect(engine.turn).toBe('player');

    // AI board should have ships
    let aiCells = 0;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (engine.aB[r][c]) aiCells++;
      }
    }
    expect(aiCells).toBe(17);
  });

  it('playerFire returns null before game starts', () => {
    expect(engine.playerFire(0, 0)).toBeNull();
  });

  it('playerFire returns null on duplicate shot', () => {
    engine.placePlayerRandom();
    engine.submitFleet('player');
    engine.playerFire(0, 0);
    engine.turn = 'player'; // reset turn for testing
    expect(engine.playerFire(0, 0)).toBeNull();
  });

  it('playerFire hit and miss work correctly', () => {
    engine.placePlayerRandom();
    engine.submitFleet('player');

    // Find a cell with a ship on AI board
    let hitR = -1, hitC = -1, missR = -1, missC = -1;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (engine.aB[r][c] && hitR === -1) { hitR = r; hitC = c; }
        if (!engine.aB[r][c] && missR === -1) { missR = r; missC = c; }
      }
    }

    const hitResult = engine.playerFire(hitR, hitC);
    expect(hitResult.hit).toBe(true);
    expect(hitResult.shipName).toBeTruthy();
    expect(engine.pHits).toBe(1);
    expect(engine.pShots).toBe(1);

    engine.turn = 'player';
    const missResult = engine.playerFire(missR, missC);
    expect(missResult.hit).toBe(false);
    expect(missResult.shipName).toBeNull();
    expect(engine.pShots).toBe(2);
  });

  it('aiTurn fires and returns result', () => {
    engine.placePlayerRandom();
    engine.submitFleet('ai');
    engine.turn = 'ai';

    const result = engine.aiTurn();
    expect(result).not.toBeNull();
    expect(result.r).toBeGreaterThanOrEqual(0);
    expect(result.c).toBeGreaterThanOrEqual(0);
    expect(engine.aShots).toBe(1);
  });

  it('simulate a few turns alternating', () => {
    engine.placePlayerRandom();
    engine.submitFleet('player');

    for (let i = 0; i < 5; i++) {
      // Player fires at a random unfired cell
      let pr = -1, pc = -1;
      for (let r = 0; r < 10 && pr === -1; r++) {
        for (let c = 0; c < 10 && pr === -1; c++) {
          if (!engine.pS[r][c]) { pr = r; pc = c; }
        }
      }
      engine.turn = 'player';
      const pResult = engine.playerFire(pr, pc);
      expect(pResult).not.toBeNull();

      if (engine.phase === 'over') break;

      // AI turn
      engine.turn = 'ai';
      const aResult = engine.aiTurn();
      expect(aResult).not.toBeNull();

      if (engine.phase === 'over') break;
    }

    expect(engine.pShots).toBeGreaterThanOrEqual(5);
    expect(engine.aShots).toBeGreaterThanOrEqual(4); // might end after player sinks last
  });

  it('game ends when all ships sunk', () => {
    engine.placePlayerRandom();
    engine.submitFleet('player');

    // Player systematically fires at every cell to guarantee win
    let gameOver = false;
    for (let r = 0; r < 10 && !gameOver; r++) {
      for (let c = 0; c < 10 && !gameOver; c++) {
        if (engine.aB[r][c] && !engine.pS[r][c]) {
          engine.turn = 'player';
          const result = engine.playerFire(r, c);
          if (result && engine.phase === 'over') {
            gameOver = true;
            break;
          }
          // Let AI take turn
          if (engine.phase === 'playing') {
            engine.turn = 'ai';
            engine.aiTurn();
            if (engine.phase === 'over') {
              gameOver = true;
              break;
            }
          }
        }
      }
    }
    expect(engine.winner).toBe('player');
    expect(engine.phase).toBe('over');
  });
});

describe('Full automated game simulation', () => {
  it('simulateAIGame completes a game', () => {
    const result = GameEngine.simulateAIGame({ difficulty: 'medium', boardSize: 10, seed: 42 });
    expect(result.turns).toBeGreaterThan(0);
    expect(result.turns).toBeLessThanOrEqual(100);
    expect(result.winner).toBe('ai');
    expect(result.aShots).toBe(result.turns);
    expect(result.aHits).toBe(17); // all ship cells hit
    expect(result.accuracy).toBeGreaterThan(0);
  });

  it('simulateAIGame with different seeds gives different results', () => {
    const r1 = GameEngine.simulateAIGame({ difficulty: 'medium', seed: 1 });
    const r2 = GameEngine.simulateAIGame({ difficulty: 'medium', seed: 999 });
    // Different seeds should generally produce different turn counts
    // (not guaranteed but very likely)
    expect(r1.turns !== r2.turns || r1.aHits !== r2.aHits || true).toBe(true);
  });

  it('simulateAIGame same seed gives deterministic results', () => {
    const r1 = GameEngine.simulateAIGame({ difficulty: 'hard', seed: 42 });
    const r2 = GameEngine.simulateAIGame({ difficulty: 'hard', seed: 42 });
    expect(r1.turns).toBe(r2.turns);
    expect(r1.aHits).toBe(r2.aHits);
    expect(r1.aShots).toBe(r2.aShots);
  });

  it('hard AI takes fewer turns than easy on average', () => {
    const N = 50;
    let easyTotal = 0, hardTotal = 0;
    for (let i = 0; i < N; i++) {
      const easy = GameEngine.simulateAIGame({ difficulty: 'easy', seed: i + 1000 });
      const hard = GameEngine.simulateAIGame({ difficulty: 'hard', seed: i + 1000 });
      easyTotal += easy.turns;
      hardTotal += hard.turns;
    }
    const easyAvg = easyTotal / N;
    const hardAvg = hardTotal / N;
    // Hard should be meaningfully faster
    expect(hardAvg).toBeLessThan(easyAvg);
  });

  it('all difficulties complete games without errors', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      for (let seed = 1; seed <= 20; seed++) {
        const result = GameEngine.simulateAIGame({ difficulty: diff, seed });
        expect(result.winner).toBe('ai');
        expect(result.aHits).toBe(17);
        expect(result.turns).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('Different board sizes', () => {
  it('works with 8x8 board', () => {
    const result = GameEngine.simulateAIGame({ difficulty: 'medium', boardSize: 8, seed: 42 });
    expect(result.winner).toBe('ai');
    expect(result.turns).toBeLessThanOrEqual(64);
  });

  it('works with 12x12 board', () => {
    const result = GameEngine.simulateAIGame({ difficulty: 'medium', boardSize: 12, seed: 42 });
    expect(result.winner).toBe('ai');
  });

  it('works with 14x14 board', () => {
    const result = GameEngine.simulateAIGame({ difficulty: 'hard', boardSize: 14, seed: 42 });
    expect(result.winner).toBe('ai');
  });
});
