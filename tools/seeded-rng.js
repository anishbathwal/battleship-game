/**
 * Seeded pseudo-random number generator (mulberry32).
 * Produces deterministic sequences given the same seed.
 *
 * Usage:
 *   import { createRNG } from './seeded-rng.js';
 *   const rng = createRNG(42);
 *   rng();      // 0..1
 *   rng.int(n); // 0..n-1
 */

export function createRNG(seed) {
  let s = seed | 0;

  function next() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  next.int = (n) => Math.floor(next() * n);

  next.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = next.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  next.pick = (arr) => arr[next.int(arr.length)];

  return next;
}
