/**
 * Version check utilities for Evo Agent
 * Checks for new package versions asynchronously.
 */
import { VERSION } from '../config.js';
import { spawnCapture } from './shell.js';
const NPM_REGISTRY = 'https://registry.npmjs.org';
const PACKAGE_NAME = '@earendil-works/pi-coding-agent';
/**
 * Check for new version of pi-coding-agent package.
 * Returns new version string if available, otherwise null.
 */
export async function checkForNewPiVersion() {
    if (process.env.PI_OFFLINE) {
        return null;
    }
    try {
        // Use global fetch (Node 18+) or undici if needed
        const response = await fetch(`${NPM_REGISTRY}/${PACKAGE_NAME}/latest`, {
            method: 'GET',
            headers: {
                'User-Agent': `EvoAgent/${VERSION}`,
            },
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        const latestVersion = data.version;
        // Compare versions (simple string compare works for semver in most cases)
        if (latestVersion > VERSION) {
            return latestVersion;
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Check for updates to installed npm packages.
 * Returns array of package names with newer versions available.
 */
export async function checkForPackageUpdates() {
    if (process.env.PI_OFFLINE) {
        return [];
    }
    try {
        // Check if npm is available using spawnCapture
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const result = await spawnCapture(npmCmd, ['outdated', '--json']);
        if (result.code !== 0) {
            return [];
        }
        const outdated = JSON.parse(result.stdout || '{}');
        return Object.keys(outdated);
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=version-check.js.map