/**
 * Battleship Game Engine - Testable core logic extracted from battleship.html
 *
 * This module contains all game logic (placement, AI, probability maps, etc.)
 * in a form that can be tested headlessly without a DOM.
 */

import { SHIPS, DIFFICULTY_CONFIG } from './difficulty-config.js';
import { createRNG } from '../tools/seeded-rng.js';

/* ═══ ORIENTATION HELPERS ═══ */
const ORI = ['right', 'down', 'left', 'up'];

export function nxO(o) {
  return ORI[(ORI.indexOf(o) + 1) % 4];
}

export function pvO(o) {
  return ORI[(ORI.indexOf(o) + 3) % 4];
}

export function oD(o) {
  if (o === 'right') return [0, 1];
  if (o === 'down') return [1, 0];
  if (o === 'left') return [0, -1];
  return [-1, 0];
}

export function oAx(o) {
  return o === 'right' || o === 'left' ? 'h' : 'v';
}

export function oFlip(o) {
  return o === 'left' || o === 'up';
}

export function oLbl(o) {
  if (o === 'right') return '\u2192 Right';
  if (o === 'down') return '\u2193 Down';
  if (o === 'left') return '\u2190 Left';
  return '\u2191 Up';
}

/**
 * Compute the cells occupied by a ship placed at (r,c) with given size and orientation.
 */
export function sCells(r, c, sz, ori) {
  const [dr, dc] = oD(ori);
  const a = [];
  for (let i = 0; i < sz; i++) a.push({ r: r + dr * i, c: c + dc * i });
  return a;
}

/* ═══ GAME ENGINE ═══ */
export class GameEngine {
  /**
   * @param {object} opts
   * @param {'easy'|'medium'|'hard'} opts.difficulty
   * @param {number} [opts.boardSize=10]
   * @param {number|null} [opts.seed=null] - seed for RNG; null = use Math.random
   * @param {object} [opts.difficultyConfig] - override default config
   */
  constructor(opts = {}) {
    this.diff = opts.difficulty || 'easy';
    this.sz = opts.boardSize || 10;
    this.ships = opts.ships || SHIPS;
    this.cfg = { ...DIFFICULTY_CONFIG[this.diff], ...(opts.difficultyConfig || {}) };

    // RNG
    if (opts.seed != null) {
      this.rng = createRNG(opts.seed);
    } else {
      this.rng = Math.random;
      this.rng.int = (n) => Math.floor(Math.random() * n);
      this.rng.shuffle = (arr) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };
      this.rng.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    }

    // Boards: null = empty, string = ship name
    this.pB = this._mt(); // player board
    this.aB = this._mt(); // AI board

    // Shot tracking: true = fired at
    this.pS = this._mt(); // player shots on AI board
    this.aS = this._mt(); // AI shots on player board

    // Hit points remaining per ship
    this.pH = {};
    this.aH = {};
    this.ships.forEach((s) => {
      this.pH[s.name] = s.size;
      this.aH[s.name] = s.size;
    });

    // Game state
    this.phase = 'placement'; // placement | ready | playing | over
    this.turn = 'player';

    // Placement tracking
    this.placed = {};

    // AI hunt state machine
    this.aiQ = [];
    this.aiHits = [];
    this.aiHuntTarget = null;
    this.aiHuntHits = [];
    this.aiHuntDir = null;

    // Statistics
    this.pShots = 0;
    this.pHits = 0;
    this.aShots = 0;
    this.aHits = 0;
    this.sunkOrder = [];

    // Winner
    this.winner = null;
  }

  _mt() {
    return Array.from({ length: this.sz }, () => Array(this.sz).fill(null));
  }

  ib(r, c) {
    return r >= 0 && r < this.sz && c >= 0 && c < this.sz;
  }

  gs(n) {
    return this.ships.find((s) => s.name === n) || null;
  }

  /* ═══ PLACEMENT ═══ */

  /**
   * Check if a ship can be placed at (r,c) with given orientation.
   * @param {number} r - row
   * @param {number} c - column
   * @param {number} sz - ship size
   * @param {string} ori - orientation
   * @param {Array} bd - board to check
   * @param {string|null} ign - ship name to ignore (for repositioning)
   */
  canPI(r, c, sz, ori, bd, ign) {
    const cells = sCells(r, c, sz, ori);
    for (const p of cells) {
      if (!this.ib(p.r, p.c)) return false;
      if (bd[p.r][p.c] && bd[p.r][p.c] !== ign) return false;
    }
    return true;
  }

  /**
   * Place a ship on the player board.
   */
  placeShip(r, c, ship, ori, board = 'player') {
    const bd = board === 'player' ? this.pB : this.aB;
    if (!this.canPI(r, c, ship.size, ori, bd, null)) return false;
    sCells(r, c, ship.size, ori).forEach((p) => {
      bd[p.r][p.c] = ship.name;
    });
    if (board === 'player') {
      this.placed[ship.name] = { name: ship.name, r, c, ori };
    }
    return true;
  }

  /**
   * Remove a ship from the player board.
   */
  removeShip(nm, board = 'player') {
    const bd = board === 'player' ? this.pB : this.aB;
    for (let r = 0; r < this.sz; r++) {
      for (let c = 0; c < this.sz; c++) {
        if (bd[r][c] === nm) bd[r][c] = null;
      }
    }
    if (board === 'player') delete this.placed[nm];
  }

  /**
   * Randomly place all ships for AI.
   */
  placeAI() {
    this.ships.forEach((ship) => {
      let ok = false;
      let attempts = 0;
      while (!ok && attempts < 1000) {
        const r = this.rng.int(this.sz);
        const c = this.rng.int(this.sz);
        const o = this.rng() > 0.5 ? 'right' : 'down';
        if (this.canPI(r, c, ship.size, o, this.aB, null)) {
          sCells(r, c, ship.size, o).forEach((p) => {
            this.aB[p.r][p.c] = ship.name;
          });
          ok = true;
        }
        attempts++;
      }
    });
  }

  /**
   * Randomly place all ships on the player board (for simulation).
   */
  placePlayerRandom() {
    this.ships.forEach((ship) => {
      let ok = false;
      let attempts = 0;
      while (!ok && attempts < 1000) {
        const r = this.rng.int(this.sz);
        const c = this.rng.int(this.sz);
        const o = this.rng() > 0.5 ? 'right' : 'down';
        if (this.canPI(r, c, ship.size, o, this.pB, null)) {
          sCells(r, c, ship.size, o).forEach((p) => {
            this.pB[p.r][p.c] = ship.name;
          });
          this.placed[ship.name] = { name: ship.name, r, c, ori: o };
          ok = true;
        }
        attempts++;
      }
    });
  }

  /**
   * Start the game after fleet placement.
   */
  submitFleet(whoGoesFirst = 'player') {
    this.placeAI();
    this.phase = 'playing';
    this.turn = whoGoesFirst;
  }

  /* ═══ FIRING ═══ */

  /**
   * Player fires at AI board cell.
   * Returns { hit: boolean, sunk: string|null, shipName: string|null }
   */
  playerFire(r, c) {
    if (this.phase !== 'playing' || this.turn !== 'player') return null;
    if (this.pS[r][c]) return null; // already fired

    this.pS[r][c] = true;
    this.pShots++;
    const sn = this.aB[r][c];
    if (sn) {
      this.aH[sn]--;
      this.pHits++;
      const sunk = this.aH[sn] === 0 ? sn : null;
      if (sunk) {
        this.sunkOrder.push({ name: this.gs(sn).label, by: 'player', turn: this.pShots });
      }
      if (this._checkWin()) return { hit: true, sunk, shipName: sn };
      this.turn = 'ai';
      return { hit: true, sunk, shipName: sn };
    }

    this.turn = 'ai';
    return { hit: false, sunk: null, shipName: null };
  }

  /**
   * AI takes a turn. Returns { r, c, hit, sunk, shipName }
   */
  aiTurn() {
    if (this.phase !== 'playing') return null;

    const target = this.aiPickTarget();
    if (!target) {
      this.turn = 'player';
      return null;
    }

    const { r, c } = target;
    this.aS[r][c] = true;
    this.aShots++;
    const sn = this.pB[r][c];

    if (sn) {
      this.pH[sn]--;
      this.aHits++;
      if (this.pH[sn] === 0) {
        this.aiOnHit(r, c, sn);
        this.aiOnSink(sn);
        this.sunkOrder.push({ name: this.gs(sn).label, by: 'ai', turn: this.aShots });
      } else {
        this.aiOnHit(r, c, sn);
      }
    } else {
      this.aiOnMiss();
    }

    if (this._checkWin()) return { r, c, hit: !!sn, sunk: sn && this.pH[sn] === 0 ? sn : null, shipName: sn };
    this.turn = 'player';
    return { r, c, hit: !!sn, sunk: this.pH[sn] === undefined ? null : (this.pH[sn] === 0 ? sn : null), shipName: sn };
  }

  _checkWin() {
    const pLost = Object.values(this.pH).every((h) => h === 0);
    const aLost = Object.values(this.aH).every((h) => h === 0);
    if (pLost) {
      this.phase = 'over';
      this.winner = 'ai';
      return true;
    }
    if (aLost) {
      this.phase = 'over';
      this.winner = 'player';
      return true;
    }
    return false;
  }

  /* ═══ AI TARGETING ═══ */

  aiDistractChance() {
    return this.cfg.distractChance;
  }

  /**
   * Get the smallest remaining (unsunk) ship size for the AI.
   */
  _smallestRemainingShipSize() {
    let min = Infinity;
    for (const s of this.ships) {
      if (this.pH[s.name] > 0 && s.size < min) min = s.size;
    }
    return min === Infinity ? 2 : min;
  }

  /**
   * AI random search. Behavior depends on difficulty config.
   */
  aiRandom() {
    const cfg = this.cfg;

    // Hard mode: probability density targeting
    if (cfg.useProbDensity) {
      const map = this.calcProbMap();
      let best = [];
      let maxVal = 0;
      for (let r = 0; r < this.sz; r++) {
        for (let c = 0; c < this.sz; c++) {
          if (this.aS[r][c] || map[r][c] === 0) continue;
          if (map[r][c] > maxVal) {
            maxVal = map[r][c];
            best = [{ r, c }];
          } else if (map[r][c] === maxVal) {
            best.push({ r, c });
          }
        }
      }
      if (best.length) {
        // Add slight randomness: 10% chance pick from top 5 instead of absolute best
        if (this.rng() < 0.1) {
          let all = [];
          for (let r = 0; r < this.sz; r++) {
            for (let c = 0; c < this.sz; c++) {
              if (!this.aS[r][c] && map[r][c] > 0) all.push({ r, c, v: map[r][c] });
            }
          }
          all.sort((a, b) => b.v - a.v);
          const top5 = all.slice(0, Math.min(5, all.length));
          return this.rng.pick(top5);
        }
        return this.rng.pick(best);
      }
    }

    // Medium/Hard: checkerboard parity pattern
    if (cfg.useParity) {
      const minShip = cfg.trackShipSizes ? this._smallestRemainingShipSize() : 2;
      const spacing = Math.max(1, minShip - 1);
      let cd = [];
      for (let rr = 0; rr < this.sz; rr++) {
        for (let cc = 0; cc < this.sz; cc++) {
          if (!this.aS[rr][cc] && (rr + cc) % spacing === 0) cd.push({ r: rr, c: cc });
        }
      }
      // Fallback to any parity
      if (!cd.length) {
        for (let rr = 0; rr < this.sz; rr++) {
          for (let cc = 0; cc < this.sz; cc++) {
            if (!this.aS[rr][cc] && (rr + cc) % 2 === 0) cd.push({ r: rr, c: cc });
          }
        }
      }
      if (!cd.length) {
        for (let rr = 0; rr < this.sz; rr++) {
          for (let cc = 0; cc < this.sz; cc++) {
            if (!this.aS[rr][cc]) cd.push({ r: rr, c: cc });
          }
        }
      }
      if (cd.length) return this.rng.pick(cd);
    }

    // Easy mode: pure random
    let avail = [];
    for (let rr = 0; rr < this.sz; rr++) {
      for (let cc = 0; cc < this.sz; cc++) {
        if (!this.aS[rr][cc]) avail.push({ r: rr, c: cc });
      }
    }
    if (avail.length) return this.rng.pick(avail);
    return null;
  }

  aiPickTarget() {
    // Distraction: mid-hunt, AI sometimes fires randomly
    if (this.aiHuntTarget && this.aiQ.length && this.rng() < this.aiDistractChance()) {
      return this.aiRandom();
    }

    // 1. Use target queue
    while (this.aiQ.length) {
      const q = this.aiQ.shift();
      if (this.ib(q.r, q.c) && !this.aS[q.r][q.c]) return q;
    }

    // 2. Unresolved hits
    if (this.aiHits.length) {
      const h = this.aiHits[0];
      this.aiStartHunt(h.r, h.c);
      while (this.aiQ.length) {
        const q = this.aiQ.shift();
        if (this.ib(q.r, q.c) && !this.aS[q.r][q.c]) return q;
      }
    }

    // 3. Random search
    return this.aiRandom();
  }

  aiStartHunt(r, c) {
    this.aiHuntTarget = this.pB[r][c];
    this.aiHuntHits = [{ r, c }];
    this.aiHuntDir = null;
    this.aiQ = [];
    const adj = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const shuffled = this.rng.shuffle(adj);
    shuffled.forEach(([dr, dc]) => {
      const nr = r + dr, nc = c + dc;
      if (this.ib(nr, nc) && !this.aS[nr][nc]) this.aiQ.push({ r: nr, c: nc });
    });

    // Easy mode: randomly drop some adjacents
    if (this.cfg.adjacentDropChance > 0) {
      this.aiQ = this.aiQ.filter(() => this.rng() > this.cfg.adjacentDropChance);
      if (this.aiQ.length < this.cfg.minAdjacentKeep) {
        // Rebuild with at least minAdjacentKeep
        this.aiQ = [];
        shuffled.forEach(([dr, dc]) => {
          const nr = r + dr, nc = c + dc;
          if (this.ib(nr, nc) && !this.aS[nr][nc] && this.aiQ.length < this.cfg.minAdjacentKeep) {
            this.aiQ.push({ r: nr, c: nc });
          }
        });
      }
    }
  }

  aiExtendLine() {
    this.aiQ = [];
    const hits = this.aiHuntHits;
    if (this.aiHuntDir === 'h') {
      hits.sort((a, b) => a.c - b.c);
      const row = hits[0].r;
      for (let cc = hits[0].c - 1; cc >= 0; cc--) {
        if (this.aS[row][cc]) {
          if (this.pB[row][cc] && this.pB[row][cc] === this.aiHuntTarget) continue;
          break;
        }
        this.aiQ.push({ r: row, c: cc });
        break;
      }
      for (let cc = hits[hits.length - 1].c + 1; cc < this.sz; cc++) {
        if (this.aS[row][cc]) {
          if (this.pB[row][cc] && this.pB[row][cc] === this.aiHuntTarget) continue;
          break;
        }
        this.aiQ.push({ r: row, c: cc });
        break;
      }
    } else {
      hits.sort((a, b) => a.r - b.r);
      const col = hits[0].c;
      for (let rr = hits[0].r - 1; rr >= 0; rr--) {
        if (this.aS[rr][col]) {
          if (this.pB[rr][col] && this.pB[rr][col] === this.aiHuntTarget) continue;
          break;
        }
        this.aiQ.push({ r: rr, c: col });
        break;
      }
      for (let rr = hits[hits.length - 1].r + 1; rr < this.sz; rr++) {
        if (this.aS[rr][col]) {
          if (this.pB[rr][col] && this.pB[rr][col] === this.aiHuntTarget) continue;
          break;
        }
        this.aiQ.push({ r: rr, c: col });
        break;
      }
    }
  }

  aiOnHit(r, c, sn) {
    this.aiHits.push({ r, c, sn });
    if (!this.aiHuntTarget) {
      this.aiStartHunt(r, c);
    } else if (sn === this.aiHuntTarget) {
      this.aiHuntHits.push({ r, c });
      if (this.aiHuntHits.length >= 2 && !this.aiHuntDir) {
        // Easy mode: confusion chance
        if (this.cfg.confusionChance > 0 && this.rng() < this.cfg.confusionChance) {
          const h = this.aiHuntHits[0];
          this.aiQ = [];
          [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
            const nr = h.r + dr, nc = h.c + dc;
            if (this.ib(nr, nc) && !this.aS[nr][nc]) this.aiQ.push({ r: nr, c: nc });
          });
        } else {
          const h0 = this.aiHuntHits[0], h1 = this.aiHuntHits[1];
          this.aiHuntDir = h0.r === h1.r ? 'h' : 'v';
        }
      }
      if (this.aiHuntDir) this.aiExtendLine();
    }
    // Hit a different ship: saved in aiHits for later
  }

  aiOnSink(sn) {
    this.aiHits = this.aiHits.filter((h) => h.sn !== sn);
    this.aiHuntTarget = null;
    this.aiHuntHits = [];
    this.aiHuntDir = null;
    this.aiQ = [];
    if (this.aiHits.length) {
      const next = this.aiHits[0];
      this.aiStartHunt(next.r, next.c);
      const tgt = this.pB[next.r][next.c];
      this.aiHits
        .filter((h) => h.sn === tgt && (h.r !== next.r || h.c !== next.c))
        .forEach((h) => {
          this.aiHuntHits.push({ r: h.r, c: h.c });
        });
      if (this.aiHuntHits.length >= 2) {
        const h0 = this.aiHuntHits[0], h1 = this.aiHuntHits[1];
        this.aiHuntDir = h0.r === h1.r ? 'h' : 'v';
        this.aiExtendLine();
      }
    }
  }

  aiOnMiss() {
    if (!this.aiHuntTarget) return;
    if (this.aiHuntDir) {
      this.aiExtendLine();
      if (this.aiQ.length === 0) {
        const origDir = this.aiHuntDir;
        this.aiHuntDir = origDir === 'h' ? 'v' : 'h';
        this.aiExtendLine();
        if (this.aiQ.length === 0) {
          this.aiHuntTarget = null;
          this.aiHuntHits = [];
          this.aiHuntDir = null;
        }
      }
    } else {
      if (this.aiQ.length === 0 && this.aiHuntHits.length) {
        const h = this.aiHuntHits[0];
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
          const nr = h.r + dr, nc = h.c + dc;
          if (this.ib(nr, nc) && !this.aS[nr][nc]) this.aiQ.push({ r: nr, c: nc });
        });
        if (this.aiQ.length === 0) {
          this.aiHuntTarget = null;
          this.aiHuntHits = [];
          this.aiHuntDir = null;
        }
      }
    }
  }

  /* ═══ PROBABILITY MAP (for suggestions & hard AI) ═══ */

  /**
   * Calculate probability density map for the AI board (player's perspective)
   * or the player board (AI's perspective, for hard mode).
   * @param {'player'|'ai'} perspective - whose shots we're computing for
   */
  calcProbMap(perspective = 'ai') {
    const sz = this.sz;
    const map = Array.from({ length: sz }, () => Array(sz).fill(0));
    const shotBoard = perspective === 'ai' ? this.aS : this.pS;
    const shipBoard = perspective === 'ai' ? this.pB : this.aB;
    const hp = perspective === 'ai' ? this.pH : this.aH;
    const boost = this.cfg.hitAdjacentBoost;

    const remaining = this.ships.filter((s) => hp[s.name] > 0);
    remaining.forEach((ship) => {
      ['right', 'down'].forEach((ori) => {
        for (let r = 0; r < sz; r++) {
          for (let c = 0; c < sz; c++) {
            const cells = sCells(r, c, ship.size, ori);
            let valid = true;
            for (const p of cells) {
              if (!this.ib(p.r, p.c) || shotBoard[p.r][p.c]) {
                valid = false;
                break;
              }
            }
            if (valid) cells.forEach((p) => { map[p.r][p.c]++; });
          }
        }
      });
    });

    // Boost cells adjacent to known hits on unsunk ships
    if (boost > 0) {
      for (let r = 0; r < sz; r++) {
        for (let c = 0; c < sz; c++) {
          if (shotBoard[r][c] && shipBoard[r][c] && hp[shipBoard[r][c]] > 0) {
            [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
              const nr = r + dr, nc = c + dc;
              if (this.ib(nr, nc) && !shotBoard[nr][nc]) map[nr][nc] += boost;
            });
          }
        }
      }
    }

    // Zero out already-fired cells
    for (let r = 0; r < sz; r++) {
      for (let c = 0; c < sz; c++) {
        if (shotBoard[r][c]) map[r][c] = 0;
      }
    }

    return map;
  }

  /* ═══ SIMULATION HELPERS ═══ */

  /**
   * Run a full automated game: AI vs random player placement.
   * Only simulates AI shots. Returns statistics.
   */
  static simulateAIGame(opts = {}) {
    const engine = new GameEngine(opts);
    engine.placePlayerRandom();
    engine.placeAI();
    engine.phase = 'playing';
    engine.turn = 'ai';

    const hitCounts = Array.from({ length: engine.sz }, () => Array(engine.sz).fill(0));
    let turns = 0;
    const maxTurns = engine.sz * engine.sz;

    while (engine.phase === 'playing' && turns < maxTurns) {
      const result = engine.aiTurn();
      if (!result) break;
      hitCounts[result.r][result.c] = turns + 1; // record order of fire
      turns++;
      // Stay as AI turn for simulation
      engine.turn = 'ai';
    }

    return {
      turns,
      winner: engine.winner,
      hitCounts,
      aShots: engine.aShots,
      aHits: engine.aHits,
      accuracy: engine.aShots ? engine.aHits / engine.aShots : 0,
      shotBoard: engine.aS,
      playerBoard: engine.pB,
    };
  }
}

export { SHIPS, DIFFICULTY_CONFIG };
