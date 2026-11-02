const BEST_SCORE_KEY = 'tfb_buddy_defender_best';

export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readBestScore(storage: StringStorage): number {
  try {
    const value = Number(storage.getItem(BEST_SCORE_KEY) || 0);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export function writeBestScore(storage: StringStorage, score: number): number {
  const best = Math.max(readBestScore(storage), Math.max(0, Math.floor(score)));
  try {
    storage.setItem(BEST_SCORE_KEY, String(best));
  } catch {
    return readBestScore(storage);
  }
  return best;
}

export { BEST_SCORE_KEY };
