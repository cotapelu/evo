// __tests__/filesystem.test.ts - Unit tests for FileSystem module

import { FileSystem } from '../filesystem.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FileSystem', () => {
  let fsInstance: FileSystem;
  const testDir = path.join(__dirname, 'test-fixtures');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    fsInstance = new FileSystem({
      basePath: testDir,
      allowedPaths: [testDir],
      blockedOperations: ['/etc/', '/sys/']
    });
  });

  afterEach(() => {
    // Cleanup test files
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(testDir, file));
        } catch {
          // ignore
        }
      }
    }
  });

  test('should write and read file', () => {
    fsInstance.writeFile('test.txt', 'Hello, World!');
    const content = fsInstance.readFile('test.txt');
    expect(content).toBe('Hello, World!');
  });

  test('should check if file exists', () => {
    expect(fsInstance.exists('nonexistent.txt')).toBe(false);
    fsInstance.writeFile('exists.txt', 'test');
    expect(fsInstance.exists('exists.txt')).toBe(true);
  });

  test('should list files in directory', () => {
    fsInstance.writeFile('a.txt', 'a');
    fsInstance.writeFile('b.txt', 'b');
    const files = fsInstance.listFiles('.');
    expect(files).toContain('a.txt');
    expect(files).toContain('b.txt');
  });

  test('should delete file', () => {
    fsInstance.writeFile('delete-me.txt', 'content');
    expect(fsInstance.exists('delete-me.txt')).toBe(true);
    fsInstance.deleteFile('delete-me.txt');
    expect(fsInstance.exists('delete-me.txt')).toBe(false);
  });

  test('should create directory', () => {
    fsInstance.mkdir('subdir');
    expect(fsInstance.exists('subdir')).toBe(true);
  });

  test('should get file stats', () => {
    fsInstance.writeFile('stats.txt', 'test content');
    const stats = fsInstance.getStats('stats.txt');
    expect(stats).not.toBeNull();
    expect(stats!.size).toBe(12);
    expect(stats!.isFile).toBe(true);
    expect(stats!.isDirectory).toBe(false);
  });

  test('should block access to disallowed paths', () => {
    expect(() => fsInstance.readFile('/etc/passwd')).toThrow('Access denied');
    expect(() => fsInstance.writeFile('../../../etc/passwd', 'hacked')).toThrow('Access denied');
  });

  test('should block disallowed operations', () => {
    // Use a path inside allowed directory but containing blocked substring
    expect(() => fsInstance.writeFile('sys/evil', 'bad')).toThrow('Blocked operation');
  });

  test('should backup file', () => {
    fsInstance.writeFile('original.txt', 'original content');
    const backupPath = fsInstance.backup('original.txt');
    expect(fs.existsSync(backupPath)).toBe(true);
    const backupContent = fsInstance.readFile(path.relative(testDir, backupPath));
    expect(backupContent).toBe('original content');
  });
});
