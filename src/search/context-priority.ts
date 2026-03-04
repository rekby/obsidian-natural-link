import { App, TFile } from "obsidian";
import { NoteInfo } from "../types";
import { RecentNotes } from "./recent-notes";

export const CONTEXT_TOP_N = 3;
export const MAX_CONTEXT_BOOST_COUNT = 5;
export const FRESH_ACTIVITY_WINDOW_MS = 5 * 60 * 1000;

interface TimedTitle {
	title: string;
	timestamp: number;
}

interface BuildContextPriorityInput {
	app: App;
	recentNotes: RecentNotes;
	relevantCandidates: NoteInfo[];
	topN?: number;
	maxBoostCount?: number;
	now?: number;
}

export function selectUsedTop(
	recentNotes: RecentNotes,
	relevantTitles: Set<string>,
	n: number,
): TimedTitle[] {
	return recentNotes
		.getTop(n)
		.filter((entry) => relevantTitles.has(entry.title))
		.slice(0, n);
}

export function selectEditedTop(
	app: App,
	relevantCandidates: NoteInfo[],
	n: number,
): TimedTitle[] {
	const edited: TimedTitle[] = [];
	for (const note of relevantCandidates) {
		const file = app.vault.getAbstractFileByPath(note.path);
		if (!(file instanceof TFile)) continue;
		const mtime = (file as TFile & { stat?: { mtime?: number } }).stat?.mtime;
		if (typeof mtime !== "number") continue;
		edited.push({ title: note.title, timestamp: mtime });
	}
	edited.sort((a, b) => b.timestamp - a.timestamp);
	return dedupeTimed(edited).slice(0, n);
}

export function selectOpenTop(
	app: App,
	relevantTitles: Set<string>,
	n: number,
): string[] {
	const workspace = (app as unknown as {
		workspace?: {
			getMostRecentLeaf?: () => unknown;
			getLeavesOfType?: (viewType: string) => unknown[];
		};
	}).workspace;
	if (!workspace?.getLeavesOfType) return [];

	const workspaceApi = workspace as {
		getMostRecentLeaf?: () => unknown;
		getLeavesOfType?: (viewType: string) => unknown[];
	};

	const titles: string[] = [];

	const mostRecentLeaf = workspaceApi.getMostRecentLeaf?.();
	const mostRecentTitle = getLeafTitle(mostRecentLeaf ?? null);
	if (mostRecentTitle && relevantTitles.has(mostRecentTitle)) {
		titles.push(mostRecentTitle);
	}

	const openLeaves = workspaceApi.getLeavesOfType?.("markdown") ?? [];
	for (const leaf of openLeaves) {
		const title = getLeafTitle(leaf);
		if (!title || !relevantTitles.has(title)) continue;
		titles.push(title);
	}

	return dedupeTitles(titles).slice(0, n);
}

export function selectActivityTop(
	usedTop: TimedTitle[],
	editedTop: TimedTitle[],
	n: number,
): TimedTitle[] {
	const merged = new Map<string, number>();
	for (const item of [...usedTop, ...editedTop]) {
		const prev = merged.get(item.title);
		if (prev === undefined || item.timestamp > prev) {
			merged.set(item.title, item.timestamp);
		}
	}
	return [...merged.entries()]
		.map(([title, timestamp]) => ({ title, timestamp }))
		.sort((a, b) => b.timestamp - a.timestamp)
		.slice(0, n);
}

export function buildContextPriorityTitles(input: BuildContextPriorityInput): string[] {
	const topN = input.topN ?? CONTEXT_TOP_N;
	const maxBoostCount = input.maxBoostCount ?? MAX_CONTEXT_BOOST_COUNT;
	const now = input.now ?? Date.now();

	const relevantTitles = new Set(input.relevantCandidates.map((n) => n.title));
	const usedTop = selectUsedTop(input.recentNotes, relevantTitles, topN);
	const editedTop = selectEditedTop(input.app, input.relevantCandidates, topN);
	const openTop = selectOpenTop(input.app, relevantTitles, topN);
	const activityTop = selectActivityTop(usedTop, editedTop, topN);

	const freshEditedOpen = editedTop
		.filter((entry) => now - entry.timestamp < FRESH_ACTIVITY_WINDOW_MS)
		.filter((entry) => openTop.includes(entry.title))
		.sort((a, b) => b.timestamp - a.timestamp)
		.map((entry) => entry.title);

	const freshActivity = activityTop
		.filter((entry) => now - entry.timestamp < FRESH_ACTIVITY_WINDOW_MS)
		.sort((a, b) => b.timestamp - a.timestamp)
		.map((entry) => entry.title);

	const staleActivity = activityTop
		.filter((entry) => now - entry.timestamp >= FRESH_ACTIVITY_WINDOW_MS)
		.sort((a, b) => b.timestamp - a.timestamp)
		.map((entry) => entry.title);

	const tiered = [
		...freshEditedOpen,
		...freshActivity,
		...openTop,
		...staleActivity,
	];

	// Keep deterministic order and remove duplicates across tiers.
	const deduped = dedupeTitles(tiered).filter((title) => {
		// Strict relevance: anything outside the filtered candidate set is ignored.
		return relevantTitles.has(title);
	});

	return deduped.slice(0, maxBoostCount);
}

export function reorderByPriority<T>(
	items: T[],
	getTitle: (item: T) => string,
	priorityTitles: string[],
): T[] {
	if (items.length === 0 || priorityTitles.length === 0) return items;

	const buckets = new Map<string, T[]>();
	for (const item of items) {
		const title = getTitle(item);
		const arr = buckets.get(title);
		if (arr) {
			arr.push(item);
		} else {
			buckets.set(title, [item]);
		}
	}

	const used = new Set<T>();
	const prioritized: T[] = [];
	for (const title of priorityTitles) {
		const arr = buckets.get(title);
		if (!arr || arr.length === 0) continue;
		for (const item of arr) {
			if (!used.has(item)) {
				prioritized.push(item);
				used.add(item);
			}
		}
	}

	const rest = items.filter((item) => !used.has(item));
	return [...prioritized, ...rest];
}

function getLeafTitle(leaf: unknown): string | null {
	const maybeLeaf = leaf as { view?: { file?: { basename?: string } } };
	const basename = maybeLeaf.view?.file?.basename;
	return typeof basename === "string" ? basename : null;
}

function dedupeTitles(titles: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const title of titles) {
		if (seen.has(title)) continue;
		seen.add(title);
		result.push(title);
	}
	return result;
}

function dedupeTimed(items: TimedTitle[]): TimedTitle[] {
	const byTitle = new Map<string, number>();
	for (const item of items) {
		const prev = byTitle.get(item.title);
		if (prev === undefined || item.timestamp > prev) {
			byTitle.set(item.title, item.timestamp);
		}
	}
	return [...byTitle.entries()]
		.map(([title, timestamp]) => ({ title, timestamp }))
		.sort((a, b) => b.timestamp - a.timestamp);
}
