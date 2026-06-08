/**
 * Clipboard utilities for Evo Agent
 * Handles copying text and reading images from clipboard.
 */
import { spawn } from 'node:child_process';
import * as os from 'node:os';
/**
 * Copy text to system clipboard.
 */
export async function copyToClipboard(text) {
    const platform = os.platform();
    if (platform === 'darwin') {
        // macOS: pbpaste/pbcopy
        await new Promise((resolve, reject) => {
            const proc = spawn('pbcopy', [], { stdio: ['pipe', 'ignore', 'pipe'] });
            proc.on('error', reject);
            proc.on('close', (code) => {
                if (code === 0)
                    resolve();
                else
                    reject(new Error(`pbcopy exited with code ${code}`));
            });
            proc.stdin?.write(text);
            proc.stdin?.end();
        });
    }
    else if (platform === 'win32') {
        // Windows: use clip.exe
        await new Promise((resolve, reject) => {
            const proc = spawn('clip', [], { stdio: ['pipe', 'ignore', 'pipe'] });
            proc.on('error', reject);
            proc.on('close', (code) => {
                if (code === 0)
                    resolve();
                else
                    reject(new Error(`clip exited with code ${code}`));
            });
            proc.stdin?.write(text);
            proc.stdin?.end();
        });
    }
    else {
        // Linux: try xclip, fallback to xsel
        try {
            await new Promise((resolve, reject) => {
                const proc = spawn('xclip', ['-selection', 'clipboard'], { stdio: ['pipe', 'ignore', 'pipe'] });
                proc.on('error', reject);
                proc.on('close', (code) => {
                    if (code === 0)
                        resolve();
                    else
                        reject(new Error(`xclip exited with code ${code}`));
                });
                proc.stdin?.write(text);
                proc.stdin?.end();
            });
        }
        catch {
            // Fallback to xsel
            await new Promise((resolve, reject) => {
                const proc = spawn('xsel', ['--clipboard', '--input'], { stdio: ['pipe', 'ignore', 'pipe'] });
                proc.on('error', reject);
                proc.on('close', (code) => {
                    if (code === 0)
                        resolve();
                    else
                        reject(new Error(`xsel exited with code ${code}`));
                });
                proc.stdin?.write(text);
                proc.stdin?.end();
            });
        }
    }
}
/**
 * Read image from clipboard (if available).
 * Returns { bytes: Uint8Array, mimeType: string } or null.
 */
export async function readClipboardImage() {
    const platform = os.platform();
    try {
        if (platform === 'darwin') {
            // macOS: use png format
            const pngData = await new Promise((resolve, reject) => {
                const proc = spawn('pbpaste', ['-Prefer', 'png']);
                let chunks = [];
                proc.stdout?.on('data', (chunk) => chunks.push(chunk));
                proc.stderr?.on('data', (chunk) => {
                    const msg = chunk.toString();
                    if (msg.includes('not'))
                        reject(new Error('No image in clipboard'));
                });
                proc.on('close', (code) => {
                    if (code === 0)
                        resolve(Buffer.concat(chunks));
                    else
                        reject(new Error(`pbpaste exited with code ${code}`));
                });
                proc.on('error', reject);
            });
            return { bytes: new Uint8Array(pngData), mimeType: 'image/png' };
        }
        else if (platform === 'win32') {
            // Windows: PowerShell approach (simplified)
            // In practice, this is complex; return null for now
            return null;
        }
        else {
            // Linux: try xclip -t image/png
            try {
                const pngData = await new Promise((resolve, reject) => {
                    const proc = spawn('xclip', ['-selection', 'clipboard', '-t', 'image/png', '-o']);
                    let chunks = [];
                    proc.stdout?.on('data', (chunk) => chunks.push(chunk));
                    proc.stderr?.on('data', () => {
                        // ignore errors, we'll catch on close
                    });
                    proc.on('close', (code) => {
                        if (code === 0)
                            resolve(Buffer.concat(chunks));
                        else
                            reject(new Error('No image in clipboard or xclip not available'));
                    });
                    proc.on('error', reject);
                });
                return { bytes: new Uint8Array(pngData), mimeType: 'image/png' };
            }
            catch {
                return null;
            }
        }
    }
    catch {
        return null;
    }
}
/**
 * Get file extension for image MIME type.
 */
export function extensionForImageMimeType(mimeType) {
    switch (mimeType) {
        case 'image/png':
            return 'png';
        case 'image/jpeg':
        case 'image/jpg':
            return 'jpg';
        case 'image/gif':
            return 'gif';
        case 'image/webp':
            return 'webp';
        case 'image/svg+xml':
            return 'svg';
        default:
            return null;
    }
}
//# sourceMappingURL=clipboard.js.map