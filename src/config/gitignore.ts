import fs from 'fs';
import path from 'path';

const REQUIRED_ENTRIES = [
  'claude/',
  '.agent-cli/',
  'node_modules/',
  'dist/',
];

export function ensureGitignore(): void {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  let content = '';
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  }

  const lines = content.split('\n');
  const missing = REQUIRED_ENTRIES.filter(entry => !lines.some(l => l.trim() === entry));

  if (missing.length > 0) {
    const toAdd = '\n# AgentFlow auto-managed\n' + missing.join('\n') + '\n';
    fs.appendFileSync(gitignorePath, toAdd, 'utf-8');
    console.log(`[gitignore] Added: ${missing.join(', ')}`);
  }
}

export function hasGitignoreEntry(entry: string): boolean {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (!fs.existsSync(gitignorePath)) return false;
  const content = fs.readFileSync(gitignorePath, 'utf-8');
  return content.split('\n').some(l => l.trim() === entry);
}
