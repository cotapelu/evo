/**
 * Changelog utilities for Evo Agent
 * Adapted from pi-coding-agent
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export function getAgentDir(): string {
	return path.join(require('os').homedir(), '.pi');
}

export function getDocsPath(): string {
	return path.join(getAgentDir(), 'docs');
}

export function getChangelogPath(): string {
	return path.join(getDocsPath(), 'CHANGELOG.md');
}

export function parseChangelog(content: string): any[] {
	// Simple parse: split by top-level entries (e.g., "# v1.0.0")
	// Returns array of entries with version and content
	const entries = [];
	const lines = content.split(/\r?\n/);
	let currentEntry: { version?: string; content: string[] } | null = null;

	for (const line of lines) {
		if (/^#\s+v?\d+\.\d+\.\d+/i.test(line.trim())) {
			if (currentEntry) {
				entries.push(currentEntry);
			}
			currentEntry = {
				version: line.trim().replace(/^#\s+/, ''),
				content: [line],
			};
		} else if (currentEntry) {
			currentEntry.content.push(line);
		}
	}
	if (currentEntry) {
		entries.push(currentEntry);
	}
	return entries.map(e => ({
		version: e.version,
		content: e.content.join('\n'),
	}));
}

export function getNewEntries(all: any[], last: string): any[] {
	// Find entries with version > last
	const lastParts = last.split('.').map(Number);
	function compareVersion(v: string): number {
		const parts = v.split('.').map(Number);
		for (let i = 0; i < 3; i++) {
			const a = parts[i] || 0;
			const b = lastParts[i] || 0;
			if (a !== b) return a - b;
		}
		return 0;
	}
	return all.filter(e => compareVersion(e.version) > 0);
}
