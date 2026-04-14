import fs from 'fs';
import path from 'path';

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,       // OpenAI API keys
  /Bearer [a-zA-Z0-9._-]{20,}/g, // Bearer tokens
  /eyJ[a-zA-Z0-9._-]{20,}/g,    // JWT tokens
];

const SCAN_DIRS = ['src/', 'config/'];
const SKIP_DIRS = ['node_modules', 'dist', '.agent-cli', '.git'];

export interface SecurityAuditResult {
  passed: boolean;
  issues: Array<{ file: string; line: number; pattern: string }>;
}

export function runSecurityAudit(): SecurityAuditResult {
  const issues: Array<{ file: string; line: number; pattern: string }> = [];

  function scanDir(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && /\.(ts|js|json|env)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          for (const pattern of SENSITIVE_PATTERNS) {
            if (pattern.test(line)) {
              issues.push({ file: fullPath, line: idx + 1, pattern: pattern.source });
            }
          }
        });
      }
    }
  }

  SCAN_DIRS.forEach(scanDir);
  return { passed: issues.length === 0, issues };
}
