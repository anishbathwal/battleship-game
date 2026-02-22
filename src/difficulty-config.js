/**
 * Difficulty configuration for Battleship AI.
 * All AI behavior parameters are tunable here without code rewrites.
 */

export const DIFFICULTY_CONFIG = {
  easy: {
    /** Chance AI fires randomly instead of following hunt queue (0-1) */
    distractChance: 0.42,
    /** Use checkerboard parity pattern for search? */
    useParity: false,
    /** Use probability density map for search? */
    useProbDensity: false,
    /** Chance AI fails to recognize ship direction after 2 hits (0-1) */
    confusionChance: 0.30,
    /** Chance each adjacent cell is dropped from hunt queue (0-1) */
    adjacentDropChance: 0.30,
    /** Minimum adjacent cells to keep in hunt queue */
    minAdjacentKeep: 1,
    /** Track remaining ship sizes to adjust search spacing? */
    trackShipSizes: false,
    /** Probability density boost for cells adjacent to known hits */
    hitAdjacentBoost: 0,
    /** Description for UI */
    label: 'Easy',
    description: 'AI fires randomly, basic adjacent checking.',
  },
  medium: {
    distractChance: 0.15,
    useParity: true,
    useProbDensity: false,
    confusionChance: 0.0,
    adjacentDropChance: 0.0,
    minAdjacentKeep: 4,
    trackShipSizes: true,
    hitAdjacentBoost: 3,
    label: 'Medium',
    description: 'Checkerboard parity search, systematic hunt-and-extend.',
  },
  hard: {
    distractChance: 0.05,
    useParity: true,
    useProbDensity: true,
    confusionChance: 0.0,
    adjacentDropChance: 0.0,
    minAdjacentKeep: 4,
    trackShipSizes: true,
    hitAdjacentBoost: 5,
    label: 'Hard',
    description: 'Probability density targeting, aggressive hunt-and-extend.',
  },
};

export const SHIPS = [
  { name: 'carrier', label: 'The Devin', size: 5, color: '#3a6b8c' },
  { name: 'battleship', label: 'The Windsurf', size: 4, color: '#4a7a6b' },
  { name: 'cruiser', label: 'The Cascade', size: 3, color: '#6b5a8c' },
  { name: 'submarine', label: 'The SWE-1.5', size: 3, color: '#7a6b4a' },
  { name: 'destroyer', label: 'The ACU', size: 2, color: '#8c4a4a' },
];

export default DIFFICULTY_CONFIG;
