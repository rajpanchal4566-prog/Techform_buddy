import crypto from 'crypto';
import { FormFieldMapping, FormMapRequest } from './types';

import { getDb } from '../db';

interface CacheEntry {
  mappings: FormFieldMapping[];
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 500;

class FormMappingCache {
  private cache = new Map<string, CacheEntry>();

  public generateKey(request: FormMapRequest): string {
    const signature = request.fields
      .map((f) => `${f.id}:${f.type}:${f.label}`)
      .sort()
      .join('|');
    const hash = crypto.createHash('sha256').update(signature).digest('hex').slice(0, 16);
    return `${request.siteHost}:${hash}:${request.language}`;
  }

  public get(key: string): FormFieldMapping[] | null {
    const entry = this.cache.get(key);
    if (entry) {
      if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        this.cache.delete(key);
      } else {
        return entry.mappings;
      }
    }

    try {
      const db = getDb();
      const row = db.prepare('SELECT mappings, timestamp FROM form_mapping_cache WHERE key = ?').get(key) as any;
      if (row && Date.now() - row.timestamp <= CACHE_TTL_MS) {
        const parsed = JSON.parse(row.mappings);
        this.cache.set(key, { mappings: parsed, timestamp: row.timestamp });
        return parsed;
      }
    } catch {}

    return null;
  }

  public set(key: string, mappings: FormFieldMapping[]): void {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    const now = Date.now();
    this.cache.set(key, { mappings, timestamp: now });

    try {
      const db = getDb();
      db.prepare(`
        CREATE TABLE IF NOT EXISTS form_mapping_cache (
          key TEXT PRIMARY KEY,
          mappings TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `).run();
      db.prepare(`
        INSERT OR REPLACE INTO form_mapping_cache (key, mappings, timestamp)
        VALUES (?, ?, ?)
      `).run(key, JSON.stringify(mappings), now);
    } catch {}
  }

  public clear(): void {
    this.cache.clear();
    try {
      const db = getDb();
      db.prepare('DELETE FROM form_mapping_cache').run();
    } catch {}
  }
}

export const formMappingCache = new FormMappingCache();
