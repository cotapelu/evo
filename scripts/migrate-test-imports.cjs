#!/usr/bin/env node
/**
 * Migrate test imports from relative paths to @extensions alias.
 * - Replaces `from "../extensions/...` and `from "../../extensions/...` etc.
 * - Replaces `vi.mock("../extensions/...` etc.
 */

const fs = require('fs');
const path = require('path');

const TEST_DIRS = ['src/tests', 'src/__tests__'];

function walk(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, callback);
    } else if (entry.isFile() && full.endsWith('.test.ts')) {
      callback(full);
    }
  }
}

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace import statements
  content = content.replace(/(from\s+["'])(\.\.\/extensions\/|\.\.\/\.\.\/extensions\/|\.\.\/\.\.\/\.\.\/extensions\/)(["'])/g, (m, p1, p2, p3) => {
    return p1 + '@extensions/' + p3;
  });

  // Replace vi.mock calls
  content = content.replace(/(vi\.mock\()(["'])(\.\.\/extensions\/|\.\.\/\.\.\/extensions\/|\.\.\/\.\.\/\.\.\/extensions\/)(["'])/g, (m, p1, p2, p3, p4) => {
    return p1 + '"@extensions/' + p4;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Migrated:', filePath);
}

for (const dir of TEST_DIRS) {
  if (fs.existsSync(dir)) {
    walk(dir, migrateFile);
  }
}

console.log('Migration complete.');
