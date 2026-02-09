/**
 * Maximum number of recent note entries to store.
 * Oldest entries are pruned when this limit is exceeded.
 */
export const MAX_RECENT_COUNT = 1000;

/**
 * Default number of recent notes to boost to the top of search results.
 */
export const MAX_BOOST_COUNT = 3;

/**
 * Tracks recently selected notes by title and timestamp.
 * Used to boost recently used notes in search results.
 */
export class RecentNotes {
	private entries: Map<string, number>;

	constructor(data?: Record<string, number>) {
		this.entries = new Map(Object.entries(data ?? {}));
	}

	/**
	 * Record a note selection with the current timestamp.
	 * Prunes oldest entries if the map exceeds MAX_RECENT_COUNT.
	 */
	record(noteTitle: string): void {
		this.entries.set(noteTitle, Date.now());
		this.prune();
	}

	/**
	 * Boost recently selected notes to the top of search results.
	 *
	 * From `results`, finds items whose title (extracted via `getTitle`) exists
	 * in the recent map. Sorts those by most recent first, takes the top `count`,
	 * and prepends them. The remaining results keep their original order.
	 *
	 * Items that are recent but beyond the `count` limit stay in their original position.
	 */
	boostRecent<T>(
		results: T[],
		getTitle: (item: T) => string,
		count: number = MAX_BOOST_COUNT,
	): T[] {
		// Find recently used notes among results with their indices
		const recentInResults: { index: number; timestamp: number }[] = [];

		for (let i = 0; i < results.length; i++) {
			const title = getTitle(results[i]!);
			const ts = this.entries.get(title);
			if (ts !== undefined) {
				recentInResults.push({ index: i, timestamp: ts });
			}
		}

		if (recentInResults.length === 0) {
			return results;
		}

		// Sort by most recent first, take top `count`
		recentInResults.sort((a, b) => b.timestamp - a.timestamp);
		const boostedIndices = new Set(
			recentInResults.slice(0, count).map((r) => r.index),
		);

		// Build result: boosted first (sorted by recency), then rest in original order
		const boosted = recentInResults
			.slice(0, count)
			.map((r) => results[r.index]!);
		const rest = results.filter((_, i) => !boostedIndices.has(i));

		return [...boosted, ...rest];
	}

	/**
	 * Serialize for storage in data.json.
	 */
	toJSON(): Record<string, number> {
		return Object.fromEntries(this.entries);
	}

	/**
	 * Remove oldest entries to keep the map within MAX_RECENT_COUNT.
	 */
	private prune(): void {
		if (this.entries.size <= MAX_RECENT_COUNT) return;

		const sorted = [...this.entries.entries()].sort(
			(a, b) => b[1] - a[1],
		);
		this.entries = new Map(sorted.slice(0, MAX_RECENT_COUNT));
	}
}
