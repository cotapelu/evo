#!/usr/bin/env node
/**
 * Security Audit Tool
 *
 * Runs comprehensive security checks:
 * - npm audit (dependency vulnerabilities)
 * - Basic secret pattern scanning in files
 * - package-lock.json validation
 */
import { readFileSync, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, extname, basename } from "node:path";
function createSecurityAuditTool(api) {
    return {
        name: 'security-audit',
        label: 'Security Audit',
        description: 'Run comprehensive security checks: npm audit, secret scanning, package-lock validation, and insecure pattern detection.',
        promptSnippet: 'security-audit - performs full security assessment of codebase.',
        parameters: {},
        async execute(toolCallId, params, signal, _onUpdate, ctx) {
            const cwd = ctx.cwd;
            const issues = [];
            // 1. npm audit
            const auditExecOptions = { cwd };
            if (signal)
                auditExecOptions.signal = signal;
            try {
                const auditRes = await api.exec('npm', ['audit', '--json'], auditExecOptions);
                if (auditRes.code === 0) {
                    // No vulnerabilities
                }
                else {
                    try {
                        const auditJson = JSON.parse(auditRes.stdout);
                        if (auditJson.vulnerabilities) {
                            for (const [pkg, vuln] of Object.entries(auditJson.vulnerabilities)) {
                                const v = vuln;
                                issues.push({
                                    severity: v.severity || 'medium',
                                    check: 'npm-audit',
                                    message: `${pkg}: ${v.via?.[0]?.title || v.title || 'vulnerability'}`,
                                });
                            }
                        }
                    }
                    catch (e) {
                        // Fallback: raw output
                        issues.push({
                            severity: 'medium',
                            check: 'npm-audit',
                            message: 'npm audit found issues (could not parse JSON)',
                        });
                    }
                }
            }
            catch (e) {
                // npm audit failed to run; ignore and continue with other checks
            }
            // 2. Secret scanning in source files
            const secretIssues = await scanForSecrets(cwd, signal);
            issues.push(...secretIssues);
            // 3. package-lock integrity
            const lockIssue = await checkPackageLock(cwd);
            if (lockIssue) {
                issues.push(lockIssue);
            }
            // 4. Insecure code patterns
            const patternIssues = await scanInsecurePatterns(cwd, signal);
            issues.push(...patternIssues);
            const total = issues.length;
            const high = issues.filter(i => i.severity === 'high').length;
            const medium = issues.filter(i => i.severity === 'medium').length;
            const low = issues.filter(i => i.severity === 'low').length;
            const summary = total === 0
                ? '✅ No security issues found.'
                : `⚠️ Found ${total} security issues: ${high} high, ${medium} medium, ${low} low.`;
            return {
                content: [{ type: 'text', text: summary }],
                details: { total, bySeverity: { high, medium, low }, issues },
                isError: total > 0,
            };
        },
    };
}
async function scanForSecrets(cwd, signal) {
    const issues = [];
    const secretPatterns = [
        { regex: /(?:password|passwd|pwd)\s*=\s*['"]/i, message: 'Possible hardcoded password' },
        { regex: /(?:AKIA|SG\.)[A-Z0-9]{20,}/, message: 'Possible AWS access key' },
        { regex: /ghp_[0-9a-zA-Z]{36}/, message: 'Possible GitHub personal access token' },
        { regex: /sk_live_[0-9a-zA-Z]{24}/, message: 'Possible Stripe live key' },
        { regex: /sk_test_[0-9a-zA-Z]{24}/, message: 'Possible Stripe test key' },
        { regex: /Bearer\s+[A-Za-z0-9\-_]+/i, message: 'Possible Bearer token' },
        { regex: /(?:mongodb|mysql|postgres):\/\/[^/\s]+:[^/\s]+@/i, message: 'Possible DB connection string with credentials' },
    ];
    const scanFile = (filePath, content) => {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            for (const pattern of secretPatterns) {
                if (pattern.regex.test(line)) {
                    issues.push({
                        severity: 'high',
                        check: 'secret-scan',
                        message: pattern.message,
                        file: basename(filePath),
                        line: idx + 1,
                    });
                }
            }
        });
    };
    const walkDir = async (dir) => {
        try {
            const entries = await readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (signal?.aborted)
                    return;
                const full = join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'coverage' || entry.name === 'build' || entry.name === '__tests__' || entry.name === 'llm-context' || entry.name === 'docs')
                        continue;
                    await walkDir(full);
                }
                else if (entry.isFile()) {
                    // Skip test files, this tool file, and docs to avoid false positives
                    const fileName = entry.name;
                    if (/(?:\.test|\.spec)\.[jt]sx?$/.test(fileName) || fileName === 'security-audit-tool.ts') {
                        continue;
                    }
                    const ext = extname(entry.name);
                    if (['.ts', '.js', '.jsx', '.tsx', '.json', '.md', '.env', '.config.js', '.yaml', '.yml'].includes(ext)) {
                        try {
                            const content = readFileSync(full, 'utf-8');
                            scanFile(full, content);
                        }
                        catch (e) { /* ignore read errors */ }
                    }
                }
            }
        }
        catch (e) { /* ignore */ }
    };
    try {
        await walkDir(cwd);
    }
    catch (e) { /* ignore */ }
    return issues;
}
function checkPackageLock(cwd) {
    const pkgLock = join(cwd, 'package-lock.json');
    if (!existsSync(pkgLock)) {
        return {
            severity: 'medium',
            check: 'package-lock',
            message: 'Missing package-lock.json - dependency integrity not guaranteed',
        };
    }
    try {
        const content = readFileSync(pkgLock, 'utf-8');
        const lock = JSON.parse(content);
        if (lock.lockfileVersion && lock.lockfileVersion >= 1) {
            return null;
        }
        return {
            severity: 'low',
            check: 'package-lock',
            message: 'Outdated lockfileVersion - consider regenerating with npm install',
        };
    }
    catch (e) {
        return {
            severity: 'medium',
            check: 'package-lock',
            message: 'package-lock.json is corrupted or unreadable',
        };
    }
}
async function scanInsecurePatterns(cwd, signal) {
    const issues = [];
    const patterns = [
        { regex: /\bmd5\s*\(/g, message: 'Use of MD5 is insecure for cryptographic purposes', severity: 'high' },
        { regex: /\b(?:sha1|sha-1)\s*\(/g, message: 'SHA-1 is considered weak for signatures', severity: 'medium' },
        { regex: /createCrypt\s*\(\s*['"](?:rc4|des|blowfish)['"]/g, message: 'Weak encryption algorithm', severity: 'high' },
        { regex: /eval\s*\(/g, message: 'Use of eval() is dangerous', severity: 'medium' },
        { regex: /innerHTML\s*=/g, message: 'Potential XSS via innerHTML assignment', severity: 'medium' },
        { regex: /new Function\s*\(/g, message: 'Dynamic code execution via Function constructor', severity: 'medium' },
        { regex: /document\.write\s*\(/g, message: 'document.write can lead to XSS', severity: 'medium' },
        { regex: /setTimeout\s*\(\s*[^,]*\)/g, message: 'setTimeout with string arg uses eval internally', severity: 'medium' },
        { regex: /process\.env\s*\[.*\]\s*(?:===|==|!==|!=)/g, message: 'Comparing env vars without defaults can cause issues', severity: 'low' },
    ];
    const walkDir = async (dir) => {
        try {
            const entries = await readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (signal?.aborted)
                    return;
                const full = join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'coverage' || entry.name === 'build' || entry.name === '__tests__' || entry.name === 'llm-context' || entry.name === 'docs')
                        continue;
                    await walkDir(full);
                }
                else if (entry.isFile()) {
                    // Skip test files, this tool file, and docs to avoid false positives
                    const fileName = entry.name;
                    if (/(?:\\.test|\\.spec)\\.[jt]sx?$/.test(fileName) || fileName === 'security-audit-tool.ts') {
                        continue;
                    }
                    const ext = extname(entry.name);
                    if (['.ts', '.js', '.jsx', '.tsx'].includes(ext)) {
                        try {
                            const content = readFileSync(full, 'utf-8');
                            for (const pattern of patterns) {
                                let match;
                                while ((match = pattern.regex.exec(content)) !== null) {
                                    const lineNum = content.substring(0, match.index).split('\n').length;
                                    issues.push({
                                        severity: pattern.severity,
                                        check: 'insecure-pattern',
                                        message: pattern.message,
                                        file: basename(full),
                                        line: lineNum,
                                    });
                                }
                                pattern.regex.lastIndex = 0;
                            }
                        }
                        catch (e) { /* ignore read errors */ }
                    }
                }
            }
        }
        catch (e) { /* ignore */ }
    };
    await walkDir(cwd);
    return issues;
}
export function registerSecurityAuditTool(api) {
    api.registerTool(createSecurityAuditTool(api));
}
//# sourceMappingURL=security-audit-tool.js.map