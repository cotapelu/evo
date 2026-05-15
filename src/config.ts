import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export class Config {
  agentDir!: string;
  model!: string;
  thinkingLevel!: string;
  logLevel!: string;
  logPath!: string;
  enableExtensions!: boolean;
  evolutionInterval!: number;

  private static defaultConfig = {
    agentDir: join(process.env.HOME || process.env.USERPROFILE || '.', '.pi', 'evo'),
    model: 'anthropic/claude-sonnet-4-20250514',
    thinkingLevel: 'medium',
    logLevel: 'info',
    logPath: join(process.cwd(), 'evo.log'),
    enableExtensions: true,
    evolutionInterval: 300000,
  };

  static load(): Config {
    const configPath = join(process.cwd(), '.pi', 'evo.config.tson');
    let config = { ...this.defaultConfig };

    if (existsSync(configPath)) {
      try {
        const loaded = JSON.parse(readFileSync(configPath, 'utf-8'));
        config = { ...config, ...loaded };
      } catch (e: any) {
        console.warn('Failed to load config:', e.message);
      }
    } else {
      const configDir = dirname(configPath);
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }
      writeFileSync(configPath, JSON.stringify(this.defaultConfig, null, 2));
    }

    return Object.assign(new Config(), config);
  }
}
