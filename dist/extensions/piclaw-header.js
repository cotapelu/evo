import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { Text } from "@earendil-works/pi-tui";
import { VERSION as PI_VERSION, getAgentDir } from "@earendil-works/pi-coding-agent";
// Default values (fallback)
let PICLAW_APP_NAME = "piclaw";
let PICLAW_VERSION = "0.0.1";
// Try to read package.json from agent directory
const agentDir = getAgentDir();
const pkgPath = join(agentDir, "package.json");
try {
    if (existsSync(pkgPath)) {
        const content = readFileSync(pkgPath, "utf-8");
        const pkg = JSON.parse(content);
        if (pkg.name)
            PICLAW_APP_NAME = pkg.name;
        if (pkg.version)
            PICLAW_VERSION = pkg.version;
    }
}
catch (e) {
    console.debug('[PiclawHeader] Using default app name/version (could not read package.json):', e instanceof Error ? e.message : e);
}
async function checkForUpdate() {
    if (process.env.PI_SKIP_VERSION_CHECK || process.env.PI_OFFLINE)
        return undefined;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch("https://registry.npmjs.org/@earendil-works/pi-coding-agent/latest", {
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok)
            return undefined;
        const data = await response.json();
        const latestVersion = data.version;
        if (latestVersion && latestVersion !== PI_VERSION) {
            return latestVersion;
        }
    }
    catch (e) {
        // Only log at debug level - network errors are common and expected
        if (!process.env.PI_SKIP_VERSION_CHECK && !process.env.PI_OFFLINE) {
            console.debug('[PiclawHeader] Version check failed (network or parse error):', e instanceof Error ? e.message : e);
        }
    }
    return undefined;
}
export default function (api) {
    api.on("session_start", async (_event, ctx) => {
        if (ctx.hasUI) {
            const updateVersion = await checkForUpdate();
            ctx.ui.setHeader((_tui, theme) => {
                let header = `${theme.fg("dim", `${PICLAW_APP_NAME} agent build on top of pi.dev sdk.`)} \n`;
                header += `${theme.bold(theme.fg("accent", PICLAW_APP_NAME))}${theme.fg("dim", ` v${PICLAW_VERSION}`)}`;
                if (updateVersion) {
                    header += `\n${theme.fg("warning", "Update Available")}`;
                    header += `\n${theme.fg("dim", `New version ${updateVersion} is available.`)}`;
                    header += `\n${theme.bold("Run piclaw update")}`;
                }
                return new Text(header, 1, 0);
            });
        }
    });
}
//# sourceMappingURL=piclaw-header.js.map