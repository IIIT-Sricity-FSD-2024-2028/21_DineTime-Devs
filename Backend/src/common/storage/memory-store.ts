import { restoreIdCounters, exportIdCounters } from 'src/common/utils/id.util';

/**
 * Process-local store used until a real persistence layer is integrated.
 * Nothing in this class is written to disk; restarting the API clears all data.
 */
export class InMemoryStore {
  private readonly collections = new Map<string, unknown[]>();
  private queue: Promise<void> = Promise.resolve();

  collection<T>(name: string, defaults: T[] = []): T[] {
    if (!this.collections.has(name)) this.collections.set(name, defaults);
    return this.collections.get(name) as T[];
  }

  snapshot(): Record<string, unknown[]> {
    return Object.fromEntries(this.collections);
  }

  async transaction<T>(action: () => T | Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((done) => { release = done; });
    await previous;
    const before = structuredClone(this.snapshot());
    const counters = exportIdCounters();
    try {
      return await action();
    } catch (error) {
      for (const [name, rows] of this.collections) {
        rows.splice(0, rows.length, ...(before[name] || []));
      }
      restoreIdCounters(counters);
      throw error;
    } finally {
      release();
    }
  }

  close() {
    // The in-memory store has no external resources to close.
  }
}

export const store = new InMemoryStore();
