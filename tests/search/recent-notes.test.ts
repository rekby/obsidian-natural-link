import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	RecentNotes,
	MAX_RECENT_COUNT,
	MAX_BOOST_COUNT,
} from "../../src/search/recent-notes";

describe("RecentNotes", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("record and toJSON", () => {
		it("stores a note with current timestamp", () => {
			vi.setSystemTime(new Date("2025-01-15T10:00:00Z"));
			const recent = new RecentNotes();
			recent.record("My Note");

			const json = recent.toJSON();
			expect(json["My Note"]).toBe(
				new Date("2025-01-15T10:00:00Z").getTime(),
			);
		});

		it("overwrites timestamp on re-record", () => {
			vi.setSystemTime(new Date("2025-01-15T10:00:00Z"));
			const recent = new RecentNotes();
			recent.record("My Note");

			vi.setSystemTime(new Date("2025-01-15T11:00:00Z"));
			recent.record("My Note");

			const json = recent.toJSON();
			expect(json["My Note"]).toBe(
				new Date("2025-01-15T11:00:00Z").getTime(),
			);
		});

		it("stores multiple notes", () => {
			const recent = new RecentNotes();
			vi.setSystemTime(new Date("2025-01-15T10:00:00Z"));
			recent.record("Note A");
			vi.setSystemTime(new Date("2025-01-15T11:00:00Z"));
			recent.record("Note B");

			const json = recent.toJSON();
			expect(Object.keys(json)).toHaveLength(2);
			expect(json["Note A"]).toBeDefined();
			expect(json["Note B"]).toBeDefined();
		});
	});

	describe("constructor hydration", () => {
		it("hydrates from saved data", () => {
			const data = { "Note A": 1000, "Note B": 2000 };
			const recent = new RecentNotes(data);

			const json = recent.toJSON();
			expect(json).toEqual(data);
		});

		it("handles undefined data", () => {
			const recent = new RecentNotes(undefined);
			expect(recent.toJSON()).toEqual({});
		});

		it("handles empty object", () => {
			const recent = new RecentNotes({});
			expect(recent.toJSON()).toEqual({});
		});
	});

	describe("boostRecent", () => {
		it("moves recently used items to the front", () => {
			const recent = new RecentNotes({
				B: 1000,
			});
			const results = ["A", "B", "C"];
			const boosted = recent.boostRecent(results, (x) => x);

			expect(boosted).toEqual(["B", "A", "C"]);
		});

		it("sorts boosted items by most recent first", () => {
			const recent = new RecentNotes({
				C: 3000,
				A: 1000,
			});
			const results = ["A", "B", "C", "D"];
			const boosted = recent.boostRecent(results, (x) => x);

			// C is most recent, then A
			expect(boosted).toEqual(["C", "A", "B", "D"]);
		});

		it("boosts at most MAX_BOOST_COUNT items", () => {
			const recent = new RecentNotes({
				A: 4000,
				B: 3000,
				C: 2000,
				D: 1000,
			});
			const results = ["A", "B", "C", "D", "E"];
			const boosted = recent.boostRecent(results, (x) => x);

			// Only top 3 (A, B, C) should be boosted; D stays in original position
			expect(boosted).toEqual(["A", "B", "C", "D", "E"]);
		});

		it("preserves original order for non-boosted items", () => {
			const recent = new RecentNotes({
				D: 5000,
			});
			const results = ["A", "B", "C", "D", "E"];
			const boosted = recent.boostRecent(results, (x) => x);

			// D boosted to front; rest keep their relative order
			expect(boosted).toEqual(["D", "A", "B", "C", "E"]);
		});

		it("returns results unchanged when no recent items match", () => {
			const recent = new RecentNotes({
				X: 1000,
				Y: 2000,
			});
			const results = ["A", "B", "C"];
			const boosted = recent.boostRecent(results, (x) => x);

			expect(boosted).toEqual(["A", "B", "C"]);
		});

		it("returns results unchanged when history is empty", () => {
			const recent = new RecentNotes();
			const results = ["A", "B", "C"];
			const boosted = recent.boostRecent(results, (x) => x);

			expect(boosted).toEqual(["A", "B", "C"]);
		});

		it("handles fewer recent items than boost count", () => {
			const recent = new RecentNotes({
				C: 2000,
			});
			const results = ["A", "B", "C", "D"];
			const boosted = recent.boostRecent(results, (x) => x);

			expect(boosted).toEqual(["C", "A", "B", "D"]);
		});

		it("works with custom getTitle function", () => {
			const recent = new RecentNotes({
				"Note B": 1000,
			});
			const results = [
				{ note: { title: "Note A" } },
				{ note: { title: "Note B" } },
				{ note: { title: "Note C" } },
			];
			const boosted = recent.boostRecent(
				results,
				(r) => r.note.title,
			);

			expect(boosted[0]!.note.title).toBe("Note B");
			expect(boosted[1]!.note.title).toBe("Note A");
			expect(boosted[2]!.note.title).toBe("Note C");
		});

		it("handles empty results array", () => {
			const recent = new RecentNotes({ A: 1000 });
			const boosted = recent.boostRecent([], (x: string) => x);
			expect(boosted).toEqual([]);
		});

		it("accepts custom count parameter", () => {
			const recent = new RecentNotes({
				A: 3000,
				B: 2000,
				C: 1000,
			});
			const results = ["A", "B", "C", "D"];
			const boosted = recent.boostRecent(results, (x) => x, 1);

			// Only 1 item boosted
			expect(boosted).toEqual(["A", "B", "C", "D"]);
		});

		it("items beyond boost count stay in their original position", () => {
			const recent = new RecentNotes({
				A: 5000,
				B: 4000,
				C: 3000,
				D: 2000,
				E: 1000,
			});
			const results = ["E", "D", "C", "B", "A"];
			const boosted = recent.boostRecent(results, (x) => x);

			// Top 3 by recency: A(5000), B(4000), C(3000) → boosted
			// D and E stay in their original relative order
			expect(boosted).toEqual(["A", "B", "C", "E", "D"]);
		});
	});

	describe("pruning", () => {
		it("prunes oldest entries when exceeding MAX_RECENT_COUNT", () => {
			const recent = new RecentNotes();

			// Fill to the limit
			for (let i = 0; i < MAX_RECENT_COUNT; i++) {
				vi.setSystemTime(i * 1000);
				recent.record(`Note ${i}`);
			}
			expect(Object.keys(recent.toJSON())).toHaveLength(
				MAX_RECENT_COUNT,
			);

			// One more should trigger pruning
			vi.setSystemTime(MAX_RECENT_COUNT * 1000);
			recent.record("Extra Note");

			const json = recent.toJSON();
			expect(Object.keys(json)).toHaveLength(MAX_RECENT_COUNT);
			// The newest should be kept
			expect(json["Extra Note"]).toBeDefined();
			// The oldest (Note 0) should be pruned
			expect(json["Note 0"]).toBeUndefined();
		});
	});
});
