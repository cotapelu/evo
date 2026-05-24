import { Evolver } from '../evolver.js';

describe('Evolver gitCmd error reporting', () => {
  let evolver: Evolver;

  beforeEach(() => {
    evolver = new Evolver(true); // dryRun
  });

  it('should throw error with command and args on non-zero exit', async () => {
    // Use an invalid git subcommand to force failure
    const ev = evolver as any;
    await expect(ev.gitCmd('invalid-subcommand-xyz', [])).rejects.toThrow(
      /git command failed: git invalid-subcommand-xyz/
    );
  });

  it('should include exit code and stderr in error message on failure', async () => {
    const ev = evolver as any;
    try {
      await ev.gitCmd('commit', ['-m', 'test'], 5000);
      // Should fail because not a git repo
      fail('Expected git command to throw');
    } catch (err: any) {
      expect(err.message).toMatch(/git command failed: git commit -m test/);
      expect(err.message).toContain('exit code:');
      // It may also include STDERR and STDOUT labels
      expect(err.message).toContain('STDERR:');
    }
  });
});
