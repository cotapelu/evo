#!/usr/bin/env node
/**
 * Evo Package Manager (Simplified)
 *
 * Minimal implementation for install/remove/list and resource resolution.
 * Uses .evo directory.
 */
import { spawn, spawnSync } from "child_process";
import chalk from "chalk";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from "fs";
import { homedir } from "os";
import { dirname, join, relative, resolve, sep } from "node:path";
import minimatch from "minimatch";
import { logger } from "./utils/logger.js";
import { CONFIG_DIR_NAME } from "./config/config-manager.js";
// ============================================================================
const RESOURCE_TYPES = ["extensions", "skills", "prompts", "themes"];
const FILE_PATTERNS = {
    extensions: /\.(ts|js)$/,
    skills: /\.md$/,
    prompts: /\.md$/,
    themes: /\.json$/,
};
function toPosixPath(p) {
    return p.split(sep).join("/");
}
function matchesAnyPattern(filePath, patterns) {
    for (const pattern of patterns) {
        if (minimatch(filePath, pattern, { matchBase: true, dot: true })) {
            return true;
        }
    }
    return false;
}
function getHomeDir() {
    return process.env.HOME || homedir();
}
// ============================================================================
export class EvoPackageManager {
    cwd;
    agentDir;
    progressCallback;
    constructor(options) {
        this.cwd = options.cwd;
        this.agentDir = options.agentDir;
    }
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }
    emitProgress(event) {
        this.progressCallback?.(event);
    }
    async withProgress(action, source, message, operation) {
        this.emitProgress({ type: "start", action, source, message });
        try {
            await operation();
            this.emitProgress({ type: "complete", action, source });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.emitProgress({ type: "error", action, source, message: errorMessage });
            throw error;
        }
    }
    // ============================================================================
    // Settings
    // ============================================================================
    getProjectSettingsPath() {
        return join(this.cwd, CONFIG_DIR_NAME, "settings.json");
    }
    getGlobalSettingsPath() {
        return join(this.agentDir, "settings.json");
    }
    loadSettings(path) {
        if (existsSync(path)) {
            try {
                return JSON.parse(readFileSync(path, "utf-8"));
            }
            catch {
                return { packages: [] };
            }
        }
        return { packages: [] };
    }
    saveSettings(path, settings) {
        const dir = dirname(path);
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        writeFileSync(path, JSON.stringify(settings, null, 2), "utf-8");
    }
    addSourceToSettings(source, options) {
        const scope = options?.local ? "project" : "user";
        const path = scope === "project" ? this.getProjectSettingsPath() : this.getGlobalSettingsPath();
        const settings = this.loadSettings(path);
        if (!settings.packages)
            settings.packages = [];
        // Check duplicate by source string
        const sourceStr = typeof source === "string" ? source : source.source;
        const exists = settings.packages.some(p => (typeof p === "string" ? p : p.source) === sourceStr);
        if (!exists) {
            settings.packages.push(source);
            this.saveSettings(path, settings);
            return true;
        }
        return false;
    }
    removeSourceFromSettings(source, options) {
        const scope = options?.local ? "project" : "user";
        const path = scope === "project" ? this.getProjectSettingsPath() : this.getGlobalSettingsPath();
        const settings = this.loadSettings(path);
        if (!settings.packages)
            return false;
        const before = settings.packages.length;
        settings.packages = settings.packages.filter((p) => {
            if (typeof p === "string")
                return p !== source;
            if (typeof p === "object" && p.source)
                return p.source !== source;
            return true;
        });
        if (settings.packages.length < before) {
            this.saveSettings(path, settings);
            return true;
        }
        return false;
    }
    // ============================================================================
    // Install/Remove
    // ============================================================================
    getInstalledPath(source, scope) {
        const parsed = this.parseSource(source);
        if (parsed.type === "npm") {
            const path = this.getNpmInstallPath(parsed, scope);
            return existsSync(path) ? path : undefined;
        }
        if (parsed.type === "git") {
            const path = this.getGitInstallPath(parsed, scope);
            return existsSync(path) ? path : undefined;
        }
        if (parsed.type === "local") {
            const baseDir = scope === "project" ? this.cwd : this.agentDir;
            const path = resolve(baseDir, parsed.path);
            return existsSync(path) ? path : undefined;
        }
        return undefined;
    }
    async install(source, options) {
        const scope = options?.local ? "project" : "user";
        await this.withProgress("install", source, `Installing ${source}...`, async () => {
            const parsed = this.parseSource(source);
            this.validateParsed(parsed);
            if (options?.dryRun) {
                logger.log(chalk.yellow(`[DRY-RUN] Would install ${source}`));
                return;
            }
            if (parsed.type === "npm") {
                await this.installNpm(parsed, scope);
                return;
            }
            if (parsed.type === "git") {
                await this.installGit(parsed, scope);
                return;
            }
            if (parsed.type === "local") {
                const resolved = resolve(this.cwd, parsed.path);
                if (!existsSync(resolved))
                    throw new Error(`Path does not exist: ${resolved}`);
                return;
            }
            throw new Error(`Unsupported install source: ${source}`);
        });
    }
    async installAndPersist(source, options) {
        await this.install(source, options);
        if (!options?.dryRun) {
            // Attach filter if provided
            this.addSourceToSettings({ source, filter: options?.filter }, { local: options?.local });
        }
        else {
            logger.log(chalk.yellow(`[DRY-RUN] Would add ${source} to settings`));
        }
    }
    async remove(source, options) {
        await this.withProgress("remove", source, `Removing ${source}...`, async () => {
            const parsed = this.parseSource(source);
            if (options?.dryRun) {
                logger.log(chalk.yellow(`[DRY-RUN] Would remove ${source}`));
                return;
            }
            if (parsed.type === "npm") {
                await this.uninstallNpm(parsed, options?.local ? "project" : "user");
                return;
            }
            if (parsed.type === "git") {
                await this.uninstallGit(parsed, options?.local ? "project" : "user");
                return;
            }
        });
    }
    async removeAndPersist(source, options) {
        await this.remove(source, options);
        if (!options?.dryRun) {
            return this.removeSourceFromSettings(source, options);
        }
        else {
            logger.log(chalk.yellow(`[DRY-RUN] Would remove ${source} from settings`));
            return true;
        }
    }
    getConfiguredEntries() {
        const globalSettings = this.loadSettings(this.getGlobalSettingsPath());
        const projectSettings = this.loadSettings(this.getProjectSettingsPath());
        const result = [];
        for (const src of globalSettings.packages || []) {
            if (typeof src === "string") {
                result.push({ source: src, scope: "user" });
            }
            else if (src && typeof src === "object" && src.source) {
                result.push({ source: src.source, scope: "user", filter: src.filter });
            }
        }
        for (const src of projectSettings.packages || []) {
            if (typeof src === "string") {
                result.push({ source: src, scope: "project" });
            }
            else if (src && typeof src === "object" && src.source) {
                result.push({ source: src.source, scope: "project", filter: src.filter });
            }
        }
        return result;
    }
    listConfiguredPackages() {
        const entries = this.getConfiguredEntries();
        return entries.map(entry => ({
            source: entry.source,
            scope: entry.scope,
            installedPath: this.getInstalledPath(entry.source, entry.scope),
            filtered: !!entry.filter,
        }));
    }
    async resolveExtensionSources(sources, options) {
        const accumulator = {
            extensions: new Map(),
            skills: new Map(),
            prompts: new Map(),
            themes: new Map(),
        };
        for (const source of sources) {
            const parsed = this.parseSource(source);
            const scope = options?.local ? "project" : "user";
            if (parsed.type === "npm") {
                const installedPath = this.getNpmInstallPath(parsed, scope);
                if (existsSync(installedPath)) {
                    this.collectPackageResources(installedPath, accumulator, undefined, {
                        source,
                        scope,
                        origin: "package",
                        baseDir: installedPath,
                    });
                }
            }
            else if (parsed.type === "git") {
                const installedPath = this.getGitInstallPath(parsed, scope);
                if (existsSync(installedPath)) {
                    this.collectPackageResources(installedPath, accumulator, undefined, {
                        source,
                        scope,
                        origin: "package",
                        baseDir: installedPath,
                    });
                }
            }
            else if (parsed.type === "local") {
                const baseDir = scope === "project" ? this.cwd : this.agentDir;
                const resolved = resolve(baseDir, parsed.path);
                if (existsSync(resolved)) {
                    this.collectPackageResources(resolved, accumulator, undefined, {
                        source,
                        scope,
                        origin: "package",
                        baseDir: resolved,
                    });
                }
            }
        }
        return {
            extensions: Array.from(accumulator.extensions.values()).map((e) => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
            skills: Array.from(accumulator.skills.values()).map((e) => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
            prompts: Array.from(accumulator.prompts.values()).map((e) => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
            themes: Array.from(accumulator.themes.values()).map((e) => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
        };
    }
    async resolve(_onMissing) {
        const entries = this.getConfiguredEntries();
        const accumulator = {
            extensions: new Map(),
            skills: new Map(),
            prompts: new Map(),
            themes: new Map(),
        };
        for (const entry of entries) {
            const parsed = this.parseSource(entry.source);
            const metadata = {
                source: entry.source,
                scope: entry.scope,
                origin: "package",
            };
            if (parsed.type === "npm") {
                const installedPath = this.getNpmInstallPath(parsed, entry.scope);
                if (existsSync(installedPath)) {
                    metadata.baseDir = installedPath;
                    this.collectPackageResources(installedPath, accumulator, entry.filter, metadata);
                }
            }
            else if (parsed.type === "git") {
                const installedPath = this.getGitInstallPath(parsed, entry.scope);
                if (existsSync(installedPath)) {
                    metadata.baseDir = installedPath;
                    this.collectPackageResources(installedPath, accumulator, entry.filter, metadata);
                }
            }
            else if (parsed.type === "local") {
                const base = entry.scope === "project" ? this.cwd : this.agentDir;
                const resolved = resolve(base, parsed.path);
                if (existsSync(resolved)) {
                    metadata.baseDir = resolved;
                    this.collectPackageResources(resolved, accumulator, entry.filter, metadata);
                }
            }
        }
        return {
            extensions: Array.from(accumulator.extensions.values()).map(e => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
            skills: Array.from(accumulator.skills.values()).map(e => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
            prompts: Array.from(accumulator.prompts.values()).map(e => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
            themes: Array.from(accumulator.themes.values()).map(e => ({ path: e.path, enabled: e.enabled, metadata: e.metadata })),
        };
    }
    async update(source, options) {
        const scope = options?.local ? "project" : "user";
        // Get configured entries for the target scope
        const allEntries = this.getConfiguredEntries().filter(e => e.scope === scope);
        const targetEntries = source ? allEntries.filter(e => e.source === source) : allEntries;
        if (targetEntries.length === 0) {
            logger.log(chalk.gray("No packages to update."));
            return;
        }
        for (const entry of targetEntries) {
            const parsed = this.parseSource(entry.source);
            if (options?.dryRun) {
                logger.log(chalk.yellow(`[DRY-RUN] Would update ${entry.source}`));
                continue;
            }
            if (parsed.type === "npm") {
                await this.withProgress("update", entry.source, `Updating ${entry.source}...`, async () => {
                    await this.updateNpm(parsed, scope);
                });
            }
            else if (parsed.type === "git") {
                await this.withProgress("update", entry.source, `Updating ${entry.source}...`, async () => {
                    await this.updateGit(parsed, scope);
                });
            }
            else {
                logger.log(chalk.yellow(`Skipping ${entry.source}: unsupported source type`));
            }
        }
    }
    async updateNpm(source, scope) {
        const installedPath = this.getNpmInstallPath(source, scope);
        if (!existsSync(installedPath)) {
            logger.log(chalk.yellow(`Skipping ${source.name}: not installed`));
            return;
        }
        // Check if pinned version
        if (source.pinned) {
            logger.log(chalk.gray(`Skipping ${source.name}: pinned version`));
            return;
        }
        // Get installed version
        const installedVersion = this.getInstalledNpmVersion(installedPath);
        if (!installedVersion) {
            logger.log(chalk.yellow(`Skipping ${source.name}: no version info`));
            return;
        }
        // Get latest version from npm
        try {
            const latestVersion = await this.getLatestNpmVersion(source.name);
            if (installedVersion === latestVersion) {
                logger.log(chalk.green(`${source.name} is already at latest version ${latestVersion}`));
                return;
            }
            logger.log(chalk.cyan(`Updating ${source.name} from ${installedVersion} to ${latestVersion}`));
        }
        catch (err) {
            // Cannot check latest, proceed with reinstall anyway
            logger.log(chalk.yellow(`Could not check latest version for ${source.name}, attempting reinstall...`));
        }
        // Reinstall
        if (scope === "user") {
            await this.runNpmCommand(["install", "-g", source.name, "--no-audit", "--no-fund"]);
        }
        else {
            const root = this.getProjectNpmRoot();
            await this.runNpmCommand(["install", source.name, "--prefix", root, "--no-audit", "--no-fund"]);
        }
    }
    async updateGit(source, scope) {
        const targetDir = this.getGitInstallPath(source, scope);
        if (!existsSync(targetDir)) {
            logger.log(chalk.yellow(`Skipping ${source.host}/${source.path}: not installed`));
            return;
        }
        // Fetch latest from remote
        logger.log(chalk.cyan(`Updating git ${source.host}/${source.path}`));
        await this.withRetry(() => this.runCommand("git", ["pull", "--rebase"], { cwd: targetDir })).catch(async (err) => {
            // If pull fails, try fetch + reset
            await this.runCommand("git", ["fetch", "origin"], { cwd: targetDir }).catch(() => { });
            const remoteRef = source.ref || "origin/HEAD";
            await this.runCommand("git", ["reset", "--hard", remoteRef], { cwd: targetDir }).catch(() => { });
        });
        // Run npm install if package.json exists
        const packageJsonPath = join(targetDir, "package.json");
        if (existsSync(packageJsonPath)) {
            await this.runNpmCommand(["install", "--prefix", targetDir]);
        }
    }
    getInstalledNpmVersion(installedPath) {
        const packageJsonPath = join(installedPath, "package.json");
        if (!existsSync(packageJsonPath))
            return undefined;
        try {
            const content = readFileSync(packageJsonPath, "utf-8");
            const pkg = JSON.parse(content);
            return pkg.version;
        }
        catch {
            return undefined;
        }
    }
    async getLatestNpmVersion(packageName) {
        const stdout = await this.withRetry(() => this.runCommandCapture("npm", ["view", packageName, "version", "--json"]));
        const raw = stdout.trim();
        if (!raw)
            throw new Error("Empty response from npm view");
        return JSON.parse(raw);
    }
    runCommandCapture(command, args, options) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                cwd: options?.cwd,
                stdio: ["ignore", "pipe", "pipe"],
                shell: process.platform === "win32",
            });
            let stdout = "";
            child.stdout.on("data", (data) => (stdout += data));
            child.on("close", (code) => {
                if (code === 0)
                    resolve(stdout);
                else
                    reject(new Error(`${command} exited with code ${code}`));
            });
            child.on("error", reject);
        });
    }
    // ============================================================================
    // Private Implementation
    // ============================================================================
    parseSource(source) {
        if (source.startsWith("npm:")) {
            const spec = source.slice(4);
            const match = spec.match(/^(@?[^@]+(?:\/[^@]+)?)(?:@(.+))?$/);
            const name = match ? match[1] : spec;
            return { type: "npm", name, pinned: !!match?.[2] };
        }
        if (source.startsWith("git:")) {
            const rest = source.slice(4);
            let host;
            let path;
            let ref;
            // git:github.com/user/repo
            // git:git@github.com:user/repo
            // git:https://github.com/user/repo
            if (rest.startsWith("git@")) {
                const atIdx = rest.indexOf("@");
                const colonIdx = rest.indexOf(":", atIdx);
                if (colonIdx !== -1) {
                    host = rest.slice(atIdx + 1, colonIdx);
                    path = rest.slice(colonIdx + 1);
                }
                else {
                    host = "";
                    path = rest;
                }
            }
            else if (rest.startsWith("https://")) {
                try {
                    const url = new URL(rest);
                    host = url.hostname;
                    path = url.pathname.replace(/^\//, "");
                    if (url.hash) {
                        ref = url.hash.slice(1);
                    }
                }
                catch {
                    host = "";
                    path = rest;
                }
            }
            else {
                // github.com/user/repo
                const slashIdx = rest.indexOf("/");
                if (slashIdx !== -1) {
                    host = rest.slice(0, slashIdx);
                    path = rest.slice(slashIdx + 1);
                }
                else {
                    host = "";
                    path = rest;
                }
            }
            return { type: "git", host, path, ref };
        }
        return { type: "local", path: source };
    }
    validateParsed(parsed) {
        if (parsed.type === "npm") {
            if (!parsed.name || parsed.name.trim() === "") {
                throw new Error("Invalid npm source: missing package name");
            }
        }
        else if (parsed.type === "git") {
            if (!parsed.host || !parsed.path) {
                throw new Error("Invalid git source: missing host or path");
            }
            if (!parsed.path.includes("/")) {
                throw new Error("Invalid git source: path must be in the form host/path (e.g., github.com/user/repo)");
            }
        }
    }
    getNpmInstallPath(source, scope) {
        if (scope === "project") {
            return join(this.cwd, CONFIG_DIR_NAME, "npm", "node_modules", source.name);
        }
        const root = this.getGlobalNpmRoot();
        return join(root, source.name);
    }
    getGitInstallRoot(scope) {
        if (scope === "project") {
            return join(this.cwd, CONFIG_DIR_NAME, "git");
        }
        return join(this.agentDir, "git");
    }
    getGitInstallPath(source, scope) {
        const root = this.getGitInstallRoot(scope);
        return join(root, source.host, source.path);
    }
    async installGit(source, scope) {
        const targetDir = this.getGitInstallPath(source, scope);
        if (existsSync(targetDir))
            return;
        const gitRoot = this.getGitInstallRoot(scope);
        if (!existsSync(gitRoot))
            mkdirSync(gitRoot, { recursive: true });
        mkdirSync(dirname(targetDir), { recursive: true });
        const repo = `https://${source.host}/${source.path}.git`;
        await this.withRetry(() => this.runCommand("git", ["clone", repo, targetDir]));
        if (source.ref) {
            const ref = source.ref;
            await this.withRetry(() => this.runCommand("git", ["checkout", ref], { cwd: targetDir }));
        }
        // Install dependencies if package.json exists
        const packageJsonPath = join(targetDir, "package.json");
        if (existsSync(packageJsonPath)) {
            await this.runNpmCommand(["install", "--prefix", targetDir]);
        }
    }
    async uninstallGit(source, scope) {
        const targetDir = this.getGitInstallPath(source, scope);
        if (!existsSync(targetDir))
            return;
        rmSync(targetDir, { recursive: true, force: true });
        this.pruneEmptyParents(dirname(targetDir), this.getGitInstallRoot(scope));
    }
    pruneEmptyParents(dir, root) {
        if (!root)
            return;
        const resolvedRoot = resolve(root);
        let current = dir;
        while (current.startsWith(resolvedRoot) && current !== resolvedRoot) {
            if (!existsSync(current)) {
                current = dirname(current);
                continue;
            }
            const entries = readdirSync(current);
            if (entries.length > 0)
                break;
            try {
                rmSync(current, { recursive: true, force: true });
            }
            catch {
                break;
            }
            current = dirname(current);
        }
    }
    async installNpm(source, scope) {
        const spec = source.name + (source.pinned ? `@${source.pinned}` : "");
        if (scope === "user") {
            await this.runNpmCommand(["install", "-g", spec]);
        }
        else {
            const root = this.getProjectNpmRoot();
            this.ensureNpmProject(root);
            await this.runNpmCommand(["install", spec, "--prefix", root, "--no-audit", "--no-fund"]);
        }
    }
    async uninstallNpm(source, scope) {
        if (scope === "user") {
            await this.runNpmCommand(["uninstall", "-g", source.name]);
        }
        else {
            const root = this.getProjectNpmRoot();
            await this.runNpmCommand(["uninstall", source.name, "--prefix", root]);
        }
    }
    getProjectNpmRoot() {
        return join(this.cwd, CONFIG_DIR_NAME, "npm");
    }
    getGlobalNpmRoot() {
        try {
            const result = spawnSync("npm", ["root", "-g"], { encoding: "utf-8" });
            if (result.status === 0)
                return result.stdout.trim();
        }
        catch { }
        return join(getHomeDir(), ".npm", "global", "node_modules");
    }
    ensureNpmProject(root) {
        if (!existsSync(root))
            mkdirSync(root, { recursive: true });
        const packageJsonPath = join(root, "package.json");
        if (!existsSync(packageJsonPath)) {
            writeFileSync(packageJsonPath, JSON.stringify({ name: "evo-extensions", private: true }, null, 2), "utf-8");
        }
    }
    runNpmCommand(args, cwd) {
        return this.withRetry(() => this.runCommand("npm", args, { cwd }));
    }
    async withRetry(operation, maxAttempts = 3, baseDelay = 1000) {
        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            }
            catch (err) {
                lastError = err;
                if (attempt === maxAttempts)
                    break;
                const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000) + Math.random() * baseDelay;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }
    async runCommand(command, args, options) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                cwd: options?.cwd,
                stdio: "inherit",
                shell: process.platform === "win32",
            });
            child.on("close", (code) => {
                if (code === 0)
                    resolve();
                else
                    reject(new Error(`${command} exited with code ${code}`));
            });
            child.on("error", reject);
        });
    }
    // ============================================================================
    // Resource Collection
    // ============================================================================
    collectPackageResources(packageRoot, accumulator, filter, metadata) {
        const collectFiles = (dir, pattern) => {
            const files = [];
            if (!existsSync(dir))
                return files;
            try {
                const entries = readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.name.startsWith(".") || entry.name === "node_modules")
                        continue;
                    const fullPath = join(dir, entry.name);
                    const stats = entry.isSymbolicLink() ? statSync(fullPath) : entry;
                    if (stats.isDirectory()) {
                        files.push(...collectFiles(fullPath, pattern));
                    }
                    else if (stats.isFile() && pattern.test(entry.name)) {
                        files.push(fullPath);
                    }
                }
            }
            catch { }
            return files;
        };
        const collectSkillFiles = (dir) => {
            const files = [];
            if (!existsSync(dir))
                return files;
            try {
                const entries = readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.name.startsWith(".") || entry.name === "node_modules")
                        continue;
                    const fullPath = join(dir, entry.name);
                    const stats = entry.isSymbolicLink() ? statSync(fullPath) : entry;
                    if (stats.isDirectory()) {
                        const skillMd = join(fullPath, "SKILL.md");
                        if (existsSync(skillMd)) {
                            files.push(skillMd);
                        }
                        else {
                            files.push(...collectSkillFiles(fullPath));
                        }
                    }
                    else if (stats.isFile() && entry.name.endsWith(".md")) {
                        files.push(fullPath);
                    }
                }
            }
            catch { }
            return files;
        };
        const addResource = (map, filePath, enabled) => {
            const key = toPosixPath(filePath);
            if (!map.has(key)) {
                map.set(key, { path: filePath, metadata, enabled });
            }
        };
        // Extensions
        const extFiles = collectFiles(packageRoot, /\.(ts|js)$/);
        for (const f of extFiles) {
            addResource(accumulator.extensions, f, true);
        }
        // Skills
        const skillFiles = collectSkillFiles(packageRoot);
        for (const f of skillFiles) {
            addResource(accumulator.skills, f, true);
        }
        // Prompts
        const promptFiles = collectFiles(packageRoot, /\.md$/).filter((p) => !p.endsWith("SKILL.md"));
        for (const f of promptFiles) {
            addResource(accumulator.prompts, f, true);
        }
        // Themes
        const themeFiles = collectFiles(packageRoot, /\.json$/);
        for (const f of themeFiles) {
            addResource(accumulator.themes, f, true);
        }
        // Apply filter if provided
        if (filter) {
            const applyFilter = (map, type) => {
                const patterns = filter[type];
                if (patterns === undefined)
                    return; // no filter for this type
                for (const [key, entry] of map.entries()) {
                    const relPath = toPosixPath(relative(packageRoot, entry.path));
                    if (!matchesAnyPattern(relPath, patterns)) {
                        map.delete(key);
                    }
                }
            };
            applyFilter(accumulator.extensions, "extensions");
            applyFilter(accumulator.skills, "skills");
            applyFilter(accumulator.prompts, "prompts");
            applyFilter(accumulator.themes, "themes");
        }
    }
}
//# sourceMappingURL=evo-package-manager.js.map