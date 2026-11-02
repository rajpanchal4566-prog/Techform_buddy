import type { EnemyKind } from './config';
import type { GameSnapshot } from './entities';

export interface GameTestHook {
  getState: () => GameSnapshot;
  spawnEnemy: (kind: EnemyKind, x?: number, y?: number) => void;
  spawnHeal: (x?: number, y?: number) => void;
}
