const SERVICE = 'agentflow';

async function runCommand(
  cmd: string[],
  stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(cmd, {
    stdin: stdin !== undefined ? new TextEncoder().encode(stdin) : 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

export class KeychainService {
  async get(account: string): Promise<string | null> {
    if (process.platform === 'darwin') {
      const result = await runCommand([
        'security',
        'find-generic-password',
        '-w',
        '-s',
        SERVICE,
        '-a',
        account,
      ]);
      if (result.exitCode !== 0) return null;
      return result.stdout || null;
    }

    if (process.platform === 'linux') {
      const result = await runCommand([
        'secret-tool',
        'lookup',
        'service',
        SERVICE,
        'account',
        account,
      ]);
      if (result.exitCode !== 0) return null;
      return result.stdout || null;
    }

    throw new Error(`Unsupported platform: ${process.platform}`);
  }

  async set(account: string, value: string): Promise<void> {
    if (process.platform === 'darwin') {
      const result = await runCommand([
        'security',
        'add-generic-password',
        '-U',
        '-s',
        SERVICE,
        '-a',
        account,
        '-w',
        value,
      ]);
      if (result.exitCode !== 0) {
        throw new Error(`Keychain set failed: ${result.stderr}`);
      }
      return;
    }

    if (process.platform === 'linux') {
      const result = await runCommand(
        [
          'secret-tool',
          'store',
          '--label',
          SERVICE,
          'service',
          SERVICE,
          'account',
          account,
        ],
        value,
      );
      if (result.exitCode !== 0) {
        throw new Error(`Keychain set failed: ${result.stderr}`);
      }
      return;
    }

    throw new Error(`Unsupported platform: ${process.platform}`);
  }

  async delete(account: string): Promise<void> {
    if (process.platform === 'darwin') {
      const result = await runCommand([
        'security',
        'delete-generic-password',
        '-s',
        SERVICE,
        '-a',
        account,
      ]);
      // Exit code 44 means item not found — treat as success
      if (result.exitCode !== 0 && result.exitCode !== 44) {
        throw new Error(`Keychain delete failed: ${result.stderr}`);
      }
      return;
    }

    if (process.platform === 'linux') {
      const result = await runCommand([
        'secret-tool',
        'clear',
        'service',
        SERVICE,
        'account',
        account,
      ]);
      if (result.exitCode !== 0) {
        throw new Error(`Keychain delete failed: ${result.stderr}`);
      }
      return;
    }

    throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

export const keychain = new KeychainService();
