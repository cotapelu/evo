/**
 * Changelog utilities for Evo Agent
 * Parse and filter CHANGELOG.md entries.
 */

import * as path from 'node:path';
import { getChangelogPath as getPkgChangelogPath } from '../config.js';

/**
 * Get changelog path (from package)
 */
export function getChangelogPath(): string {
	return getPkgChangelogPath();
}

/**
 * Parse changelog markdown into entries.
 * Returns array of { version, date, content } (simplified)
 */
export function parseChangelog(content: string): any[] {
	const entries: any[] = [];
	const lines = content.split('\n');
	let current: any = null;
	for (const line of lines) {
		if (line.startsWith('## ')) {
			if (current) entries.push(current);
			current = { version: line.slice(3).trim(), content: [] };
		} else if (current && line.trim()) {
			current.content.push(line);
		}
	}
	if (current) entries.push(current);
	return entries;
}

/**
 * Get new entries since last version
 */
export function getNewEntries(entries: any[], lastVersion: string): any[] {
	const result: any[] = [];
	for (const entry of entries) {
		if (compareVersions(entry.version, lastVersion) > 0) {
			result.push(entry);
		}
	}
	return result;
}

function compareVersions(v1: string, v2: string): number {
	// Simple compare: remove leading 'v' and split
	const a = v1.replace(/^v/, '').split('.').map(Number);
	const b = v2.replace(/^v/, '').split('.').map(Number);
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		const na = a[i] ?? 0;
		const nb = b[i] ?? 0;
		if (na > nb) return 1;
		if (na < nb) return -1;
	}
	return 0;
}
