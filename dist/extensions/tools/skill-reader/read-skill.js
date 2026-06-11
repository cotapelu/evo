import { Type } from "typebox";
import * as fs from "fs/promises";
import * as path from "path";
/**
 * Schema for read_skill command
 */
export const schema = Type.Object({
    skill: Type.Optional(Type.String({ description: "Skill name to retrieve (without .md). If omitted, lists all available skills." })),
});
/**
 * Get skills directory (bundled with extension)
 * Assumes compiled file sits in dist/extensions/tools/skill-reader/
 */
function getSkillsDir() {
    // When running from built dist, skills are next to compiled file
    // In development, we look for skills/ relative to this source file
    return path.join(process.cwd(), 'src', 'extensions', 'tools', 'skill-reader', 'skills');
}
/**
 * Execute load_skill command
 *
 * Behavior:
 * - No args / empty skill → list all skill names
 * - With skill name → read .md file and return its content
 *
 * IMPORTANT: This tool only RETRIEVES skill content for LLM inspection.
 * It does NOT register skills with Pi or modify system state.
 */
export async function executeLoadSkill(args, cwd, signal, ctx) {
    const { skill } = args;
    const skillsDir = getSkillsDir();
    try {
        // Check directory exists
        try {
            const stat = await fs.stat(skillsDir);
            if (!stat.isDirectory()) {
                return {
                    stdout: `Skills directory not found: ${skillsDir}`,
                    stderr: "",
                    code: 1,
                };
            }
        }
        catch (e) {
            return {
                stdout: "",
                stderr: `Cannot access skills directory: ${skillsDir} (${e.message})`,
                code: 1,
            };
        }
        // Read all .md files
        const files = await fs.readdir(skillsDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        if (mdFiles.length === 0) {
            return {
                stdout: `No skill templates found in ${skillsDir}`,
                stderr: "",
                code: 0,
            };
        }
        // Build skill map: name → file path
        const skillMap = new Map();
        for (const file of mdFiles) {
            const name = path.basename(file, '.md');
            skillMap.set(name, path.join(skillsDir, file));
        }
        // ── DISCOVERY MODE: No skill specified → list all ────────────────────────
        if (!skill) {
            const lines = [
                `Available skills (${skillMap.size}) in ${skillsDir}:`,
                ...Array.from(skillMap.keys()).sort().map(s => `  • ${s}`),
                "",
                `To view a skill: skill_reader({ command:'read_skill', args:{ skill:'<name>' } })`
            ];
            return {
                stdout: lines.join('\n'),
                stderr: "",
                code: 0,
            };
        }
        // ── GET MODE: Retrieve specific skill content ────────────────────────────
        if (!skillMap.has(skill)) {
            return {
                stdout: "",
                stderr: `Skill not found: ${skill}. Available: ${Array.from(skillMap.keys()).sort().join(', ')}`,
                code: 1,
            };
        }
        const skillFile = skillMap.get(skill);
        const content = await fs.readFile(skillFile, 'utf-8');
        return {
            stdout: content,
            stderr: "",
            code: 0,
        };
    }
    catch (error) {
        return {
            stdout: "",
            stderr: `Error reading skill: ${error.message}`,
            code: 1,
        };
    }
}
//# sourceMappingURL=read-skill.js.map