import { App, TFile } from "obsidian";
import { NoteInfo } from "../types";
import { RecentNotes } from "./recent-notes";

export const CONTEXT_TOP_N = 3;
export const MAX_CONTEXT_BOOST_COUNT = 5;
export const EDITED_ACTIVITY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type BoostReason = "used" | "edited" | "open";

export interface ContextPriorityEntry {
	title: string;
	timestamp: number;
	reason: BoostReason;
}

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
	now: number,
): TimedTitle[] {
	const edited: TimedTitle[] = [];
	for (const note of relevantCandidates) {
		const file = app.vault.getAbstractFileByPath(note.path);
		if (!(file instanceof TFile)) continue;
		const mtime = (file as TFile & { stat?: { mtime?: number } }).stat?.mtime;
		if (typeof mtime !== "number") continue;
		if (now - mtime > EDITED_ACTIVITY_WINDOW_MS) continue;
		edited.push({ title: note.title, timestamp: mtime });
	}
	edited.sort((a, b) => b.timestamp - a.timestamp);
	return dedupeTimed(edited).slice(0, n);
}

export function selectOpenTop(
	app: App,
	relevantTitles: Set<string>,
	n: number,
	now: number,
): TimedTitle[] {
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

	return dedupeTitles(titles)
		.slice(0, n)
		.map((title, index) => ({ title, timestamp: now - index }));
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

export function buildContextPriorityEntries(
	input: BuildContextPriorityInput,
): ContextPriorityEntry[] {
	const topN = input.topN ?? CONTEXT_TOP_N;
	const maxBoostCount = input.maxBoostCount ?? MAX_CONTEXT_BOOST_COUNT;
	const now = input.now ?? Date.now();

	const relevantTitles = new Set(input.relevantCandidates.map((n) => n.title));
	const usedTop = selectUsedTop(input.recentNotes, relevantTitles, topN);
	const editedTop = selectEditedTop(input.app, input.relevantCandidates, topN, now);
	const openTop = selectOpenTop(input.app, relevantTitles, topN, now);

	const merged = new Map<string, { timestamp: number; reason: BoostReason }>();
	for (const item of usedTop) {
		mergeReasonedEntry(merged, item.title, item.timestamp, "used");
	}
	for (const item of editedTop) {
		mergeReasonedEntry(merged, item.title, item.timestamp, "edited");
	}
	for (const item of openTop) {
		mergeReasonedEntry(merged, item.title, item.timestamp, "open");
	}

	return [...merged.entries()]
		.filter(([title]) => relevantTitles.has(title))
		.map(([title, data]) => ({
			title,
			timestamp: data.timestamp,
			reason: data.reason,
		}))
		.sort((a, b) => {
			const tsCmp = b.timestamp - a.timestamp;
			if (tsCmp !== 0) return tsCmp;
			const reasonCmp = compareReasonPriority(a.reason, b.reason);
			if (reasonCmp !== 0) return reasonCmp;
			return a.title.localeCompare(b.title);
		})
		.slice(0, maxBoostCount);
}

export function buildContextPriorityTitles(input: BuildContextPriorityInput): string[] {
	return buildContextPriorityEntries(input).map((entry) => entry.title);
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
	const maybeLeaf = leaf as { view?: { file?: { basename?: string } } } | null;
	const basename = maybeLeaf?.view?.file?.basename;
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

function mergeReasonedEntry(
	target: Map<string, { timestamp: number; reason: BoostReason }>,
	title: string,
	timestamp: number,
	reason: BoostReason,
): void {
	const prev = target.get(title);
	if (!prev || timestamp > prev.timestamp) {
		target.set(title, { timestamp, reason });
		return;
	}
	if (timestamp === prev.timestamp && compareReasonPriority(reason, prev.reason) < 0) {
		target.set(title, { timestamp, reason });
	}
}

function compareReasonPriority(a: BoostReason, b: BoostReason): number {
	return reasonPriority(a) - reasonPriority(b);
}

function reasonPriority(reason: BoostReason): number {
	switch (reason) {
		case "used":
			return 0;
		case "edited":
			return 1;
		case "open":
			return 2;
	}
}
