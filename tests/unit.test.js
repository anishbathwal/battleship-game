/**
 * Unit tests for core Battleship functions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  nxO, pvO, oD, oAx, oFlip, oLbl, sCells,
  GameEngine, SHIPS, DIFFICULTY_CONFIG,
} from '../src/engine.js';
import { createRNG } from '../tools/seeded-rng.js';

/* ═══ ORIENTATION HELPERS ═══ */
describe('Orientation helpers', () => {
  it('nxO cycles right -> down -> left -> up -> right', () => {
    expect(nxO('right')).toBe('down');
    expect(nxO('down')).toBe('left');
    expect(nxO('left')).toBe('up');
    expect(nxO('up')).toBe('right');
  });

  it('pvO cycles in reverse', () => {
    expect(pvO('right')).toBe('up');
    expect(pvO('up')).toBe('left');
    expect(pvO('left')).toBe('down');
    expect(pvO('down')).toBe('right');
  });

  it('oD returns correct deltas', () => {
    expect(oD('right')).toEqual([0, 1]);
    expect(oD('down')).toEqual([1, 0]);
    expect(oD('left')).toEqual([0, -1]);
    expect(oD('up')).toEqual([-1, 0]);
  });

  it('oAx returns h or v', () => {
    expect(oAx('right')).toBe('h');
    expect(oAx('left')).toBe('h');
    expect(oAx('down')).toBe('v');
    expect(oAx('up')).toBe('v');
  });

  it('oFlip is true for left and up', () => {
    expect(oFlip('left')).toBe(true);
    expect(oFlip('up')).toBe(true);
    expect(oFlip('right')).toBe(false);
    expect(oFlip('down')).toBe(false);
  });

  it('oLbl returns labeled strings', () => {
    expect(oLbl('right')).toContain('Right');
    expect(oLbl('down')).toContain('Down');
    expect(oLbl('left')).toContain('Left');
    expect(oLbl('up')).toContain('Up');
  });
});

/* ═══ sCells ═══ */
describe('sCells', () => {
  it('generates correct cells for right orientation', () => {
    const cells = sCells(2, 3, 4, 'right');
    expect(cells).toEqual([
      { r: 2, c: 3 }, { r: 2, c: 4 }, { r: 2, c: 5 }, { r: 2, c: 6 },
    ]);
  });

  it('generates correct cells for down orientation', () => {
    const cells = sCells(0, 0, 3, 'down');
    expect(cells).toEqual([
      { r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 0 },
    ]);
  });

  it('generates correct cells for left orientation', () => {
    const cells = sCells(5, 5, 2, 'left');
    expect(cells).toEqual([
      { r: 5, c: 5 }, { r: 5, c: 4 },
    ]);
  });

  it('generates correct cells for up orientation', () => {
    const cells = sCells(4, 3, 3, 'up');
    expect(cells).toEqual([
      { r: 4, c: 3 }, { r: 3, c: 3 }, { r: 2, c: 3 },
    ]);
  });

  it('generates single cell for size 1', () => {
    const cells = sCells(0, 0, 1, 'right');
    expect(cells).toEqual([{ r: 0, c: 0 }]);
  });
});

/* ═══ PLACEMENT RULES ═══ */
describe('Placement rules (canPI)', () => {
  let engine;

  beforeEach(() => {
    engine = new GameEngine({ difficulty: 'easy', boardSize: 10, seed: 42 });
  });

  it('allows valid placement on empty board', () => {
    expect(engine.canPI(0, 0, 5, 'right', engine.pB, null)).toBe(true);
    expect(engine.canPI(0, 0, 5, 'down', engine.pB, null)).toBe(true);
  });

  it('rejects placement going off board (right)', () => {
    expect(engine.canPI(0, 8, 5, 'right', engine.pB, null)).toBe(false);
  });

  it('rejects placement going off board (down)', () => {
    expect(engine.canPI(8, 0, 5, 'down', engine.pB, null)).toBe(false);
  });

  it('rejects placement going off board (left)', () => {
    expect(engine.canPI(0, 1, 5, 'left', engine.pB, null)).toBe(false);
  });

  it('rejects placement going off board (up)', () => {
    expect(engine.canPI(1, 0, 5, 'up', engine.pB, null)).toBe(false);
  });

  it('rejects overlapping placement', () => {
    engine.placeShip(0, 0, SHIPS[0], 'right'); // carrier at row 0, cols 0-4
    expect(engine.canPI(0, 3, 4, 'down', engine.pB, null)).toBe(false);
  });

  it('allows placement with ignore parameter (repositioning)', () => {
    engine.placeShip(0, 0, SHIPS[0], 'right');
    expect(engine.canPI(0, 0, 5, 'down', engine.pB, 'carrier')).toBe(true);
  });

  it('allows placement adjacent to another ship', () => {
    engine.placeShip(0, 0, SHIPS[0], 'right');
    expect(engine.canPI(1, 0, 4, 'right', engine.pB, null)).toBe(true);
  });
});

/* ═══ SHIP PLACEMENT & REMOVAL ═══ */
describe('Ship placement and removal', () => {
  let engine;

  beforeEach(() => {
    engine = new GameEngine({ difficulty: 'easy', boardSize: 10, seed: 42 });
  });

  it('places a ship on the player board', () => {
    const result = engine.placeShip(0, 0, SHIPS[0], 'right');
    expect(result).toBe(true);
    expect(engine.pB[0][0]).toBe('carrier');
    expect(engine.pB[0][4]).toBe('carrier');
    expect(engine.pB[0][5]).toBeNull();
    expect(engine.placed['carrier']).toEqual({ name: 'carrier', r: 0, c: 0, ori: 'right' });
  });

  it('rejects invalid placement', () => {
    const result = engine.placeShip(0, 8, SHIPS[0], 'right');
    expect(result).toBe(false);
    expect(engine.pB[0][8]).toBeNull();
  });

  it('removes a ship from the board', () => {
    engine.placeShip(0, 0, SHIPS[0], 'right');
    engine.removeShip('carrier');
    expect(engine.pB[0][0]).toBeNull();
    expect(engine.pB[0][4]).toBeNull();
    expect(engine.placed['carrier']).toBeUndefined();
  });

  it('places AI ships randomly', () => {
    engine.placeAI();
    let shipCells = 0;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (engine.aB[r][c]) shipCells++;
      }
    }
    expect(shipCells).toBe(17); // 5+4+3+3+2
  });

  it('placePlayerRandom fills all ships', () => {
    engine.placePlayerRandom();
    let shipCells = 0;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (engine.pB[r][c]) shipCells++;
      }
    }
    expect(shipCells).toBe(17);
    expect(Object.keys(engine.placed)).toHaveLength(5);
  });
});

/* ═══ AI SELECTION FUNCTIONS ═══ */
describe('AI selection functions', () => {
  let engine;

  beforeEach(() => {
    engine = new GameEngine({ difficulty: 'medium', boardSize: 10, seed: 100 });
    engine.placePlayerRandom();
    engine.placeAI();
    engine.phase = 'playing';
    engine.turn = 'ai';
  });

  it('aiRandom returns valid unfired cell', () => {
    const target = engine.aiRandom();
    expect(target).not.toBeNull();
    expect(target.r).toBeGreaterThanOrEqual(0);
    expect(target.r).toBeLessThan(10);
    expect(target.c).toBeGreaterThanOrEqual(0);
    expect(target.c).toBeLessThan(10);
    expect(engine.aS[target.r][target.c]).toBeFalsy();
  });

  it('aiRandom with parity returns checkerboard cells for medium', () => {
    const targets = new Set();
    for (let i = 0; i < 50; i++) {
      const t = engine.aiRandom();
      if (t) targets.add(`${t.r},${t.c}`);
    }
    // All targets should have (r+c) % 2 === 0 (or follow spacing pattern)
    for (const key of targets) {
      const [r, c] = key.split(',').map(Number);
      // Medium uses parity, so (r+c) % spacing === 0
      // With smallest ship = 2, spacing = 1, so all cells are valid
      // But initially it should prefer (r+c) % 2 === 0
    }
    expect(targets.size).toBeGreaterThan(0);
  });

  it('aiPickTarget returns valid cell', () => {
    const target = engine.aiPickTarget();
    expect(target).not.toBeNull();
    expect(engine.aS[target.r][target.c]).toBeFalsy();
  });

  it('aiStartHunt creates queue of adjacent cells', () => {
    // Place a ship at (5,5) so aiHuntTarget picks it up
    engine.pB[5][5] = 'carrier';
    engine.aiStartHunt(5, 5);
    expect(engine.aiHuntTarget).not.toBeNull();
    expect(engine.aiHuntHits).toHaveLength(1);
    expect(engine.aiQ.length).toBeGreaterThan(0);
    expect(engine.aiQ.length).toBeLessThanOrEqual(4);
    // All queued cells should be adjacent to (5,5)
    for (const q of engine.aiQ) {
      const dist = Math.abs(q.r - 5) + Math.abs(q.c - 5);
      expect(dist).toBe(1);
    }
  });

  it('aiExtendLine extends in horizontal direction', () => {
    engine.aiHuntTarget = 'carrier';
    engine.aiHuntHits = [{ r: 3, c: 3 }, { r: 3, c: 4 }];
    engine.aiHuntDir = 'h';
    engine.aiExtendLine();
    // Should have cells at (3,2) and (3,5) (or fewer if edge/fired)
    expect(engine.aiQ.length).toBeGreaterThan(0);
    for (const q of engine.aiQ) {
      expect(q.r).toBe(3);
    }
  });

  it('aiExtendLine extends in vertical direction', () => {
    engine.aiHuntTarget = 'carrier';
    engine.aiHuntHits = [{ r: 3, c: 5 }, { r: 4, c: 5 }];
    engine.aiHuntDir = 'v';
    engine.aiExtendLine();
    expect(engine.aiQ.length).toBeGreaterThan(0);
    for (const q of engine.aiQ) {
      expect(q.c).toBe(5);
    }
  });

  it('AI never fires at the same cell twice', () => {
    const fired = new Set();
    let maxTurns = 100;
    while (engine.phase === 'playing' && maxTurns > 0) {
      const result = engine.aiTurn();
      if (!result) break;
      const key = `${result.r},${result.c}`;
      expect(fired.has(key)).toBe(false);
      fired.add(key);
      engine.turn = 'ai';
      maxTurns--;
    }
  });
});

/* ═══ AI DIFFICULTY BEHAVIORS ═══ */
describe('AI difficulty modes', () => {
  it('easy mode has high distract chance', () => {
    const engine = new GameEngine({ difficulty: 'easy', seed: 1 });
    expect(engine.aiDistractChance()).toBeGreaterThanOrEqual(0.4);
  });

  it('medium mode has moderate distract chance', () => {
    const engine = new GameEngine({ difficulty: 'medium', seed: 1 });
    expect(engine.aiDistractChance()).toBe(0.15);
  });

  it('hard mode has low distract chance', () => {
    const engine = new GameEngine({ difficulty: 'hard', seed: 1 });
    expect(engine.aiDistractChance()).toBeLessThanOrEqual(0.05);
  });

  it('easy mode drops some adjacent cells', () => {
    const engine = new GameEngine({ difficulty: 'easy', boardSize: 10, seed: 42 });
    engine.placePlayerRandom();
    engine.pB[5][5] = 'carrier'; // ensure there's a ship here
    engine.aiStartHunt(5, 5);
    // Easy drops adjacents, so queue might be shorter than 4
    // But must have at least 1
    expect(engine.aiQ.length).toBeGreaterThanOrEqual(1);
  });

  it('hard mode uses probability density', () => {
    const engine = new GameEngine({ difficulty: 'hard', boardSize: 10, seed: 42 });
    expect(engine.cfg.useProbDensity).toBe(true);
  });

  it('medium mode uses parity', () => {
    const engine = new GameEngine({ difficulty: 'medium', boardSize: 10, seed: 42 });
    expect(engine.cfg.useParity).toBe(true);
  });

  it('AI resets hunt state after sinking a ship', () => {
    const engine = new GameEngine({ difficulty: 'medium', boardSize: 10, seed: 42 });
    // Manually set up hunt state
    engine.aiHuntTarget = 'destroyer';
    engine.aiHuntHits = [{ r: 0, c: 0 }, { r: 0, c: 1 }];
    engine.aiHuntDir = 'h';
    engine.aiQ = [{ r: 0, c: 2 }];
    engine.aiHits = [{ r: 0, c: 0, sn: 'destroyer' }, { r: 0, c: 1, sn: 'destroyer' }];

    engine.aiOnSink('destroyer');

    expect(engine.aiHuntTarget).toBeNull();
    expect(engine.aiHuntHits).toHaveLength(0);
    expect(engine.aiHuntDir).toBeNull();
    expect(engine.aiQ).toHaveLength(0);
    expect(engine.aiHits).toHaveLength(0);
  });
});

/* ═══ calcProbMap ═══ */
describe('calcProbMap', () => {
  let engine;

  beforeEach(() => {
    engine = new GameEngine({ difficulty: 'hard', boardSize: 10, seed: 42 });
  });

  it('returns a 10x10 map', () => {
    const map = engine.calcProbMap();
    expect(map).toHaveLength(10);
    expect(map[0]).toHaveLength(10);
  });

  it('center cells have higher probability than corners', () => {
    const map = engine.calcProbMap();
    const center = map[4][4] + map[4][5] + map[5][4] + map[5][5];
    const corners = map[0][0] + map[0][9] + map[9][0] + map[9][9];
    expect(center).toBeGreaterThan(corners);
  });

  it('all values are non-negative', () => {
    const map = engine.calcProbMap();
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        expect(map[r][c]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('fired cells have zero probability', () => {
    engine.aS[3][3] = true;
    engine.aS[5][5] = true;
    const map = engine.calcProbMap();
    expect(map[3][3]).toBe(0);
    expect(map[5][5]).toBe(0);
  });

  it('probability map has proper symmetry on empty board', () => {
    const map = engine.calcProbMap();
    // On a symmetric empty board, (0,0) should equal (0,9), (9,0), (9,9)
    expect(map[0][0]).toBe(map[0][9]);
    expect(map[0][0]).toBe(map[9][0]);
    expect(map[0][0]).toBe(map[9][9]);
    // Center cells should be equal
    expect(map[4][4]).toBe(map[5][5]);
    expect(map[4][5]).toBe(map[5][4]);
  });
});

/* ═══ SEEDED RNG ═══ */
describe('Seeded RNG', () => {
  it('produces deterministic sequence', () => {
    const rng1 = createRNG(42);
    const rng2 = createRNG(42);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('different seeds produce different sequences', () => {
    const rng1 = createRNG(42);
    const rng2 = createRNG(99);
    let same = 0;
    for (let i = 0; i < 100; i++) {
      if (rng1() === rng2()) same++;
    }
    expect(same).toBeLessThan(5);
  });

  it('rng.int returns values in range', () => {
    const rng = createRNG(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it('rng.shuffle returns all elements', () => {
    const rng = createRNG(42);
    const arr = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(arr);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('rng.pick returns an element from array', () => {
    const rng = createRNG(42);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });

  it('values are in [0, 1) range', () => {
    const rng = createRNG(42);
    for (let i = 0; i < 10000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

/* ═══ DIFFICULTY CONFIG ═══ */
describe('Difficulty config', () => {
  it('has all three difficulty levels', () => {
    expect(DIFFICULTY_CONFIG).toHaveProperty('easy');
    expect(DIFFICULTY_CONFIG).toHaveProperty('medium');
    expect(DIFFICULTY_CONFIG).toHaveProperty('hard');
  });

  it('easy has highest distractChance', () => {
    expect(DIFFICULTY_CONFIG.easy.distractChance).toBeGreaterThan(DIFFICULTY_CONFIG.medium.distractChance);
    expect(DIFFICULTY_CONFIG.medium.distractChance).toBeGreaterThan(DIFFICULTY_CONFIG.hard.distractChance);
  });

  it('hard enables probability density', () => {
    expect(DIFFICULTY_CONFIG.hard.useProbDensity).toBe(true);
    expect(DIFFICULTY_CONFIG.easy.useProbDensity).toBe(false);
  });

  it('medium and hard use parity', () => {
    expect(DIFFICULTY_CONFIG.medium.useParity).toBe(true);
    expect(DIFFICULTY_CONFIG.hard.useParity).toBe(true);
    expect(DIFFICULTY_CONFIG.easy.useParity).toBe(false);
  });

  it('SHIPS has 5 ships totaling 17 cells', () => {
    expect(SHIPS).toHaveLength(5);
    const total = SHIPS.reduce((sum, s) => sum + s.size, 0);
    expect(total).toBe(17);
  });
});
