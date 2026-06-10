#!/usr/bin/env node
/**
 * Evo Main - Sử dụng main() từ pi-coding-agent
 *
 * Tự động load extensions từ src/extensions qua extensionFactories
 */
import { main as piMain } from '@earendil-works/pi-coding-agent';
import { getExtensionFactories } from './extensions/index.js';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { realpathSync } from 'fs';
export async function main() {
    const args = process.argv.slice(2);
    try {
        await piMain(args, {
            extensionFactories: getExtensionFactories(),
        });
    }
    catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}
// Auto-run khi execute trực tiếp (không khi import)
// Xử lý symlinks bằng cách so sánh canonical paths
const mainScript = process.argv[1];
if (mainScript) {
    try {
        const importPath = fileURLToPath(import.meta.url);
        const resolvedImport = resolve(importPath);
        const resolvedMain = resolve(mainScript);
        // Kiểm tra khớp trực tiếp
        if (resolvedImport === resolvedMain) {
            await main();
        }
        else {
            // resolve symlinks để xem có cùng file không
            const realImport = realpathSync(importPath);
            const realMain = realpathSync(mainScript);
            if (realImport === realMain) {
                await main();
            }
            // else: file này được import, không chạy
        }
    }
    catch (error) {
        console.error('Startup error:', error);
        process.exit(1);
    }
}
//# sourceMappingURL=evo.js.map