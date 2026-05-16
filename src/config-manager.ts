import { Logger } from './logger.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import type { AgentConfig } from './agents/base.js';
import { EvolutionEngine } from './evolution-engine.js';

export interface EvoConfigExport {
  version: string;
  exportedAt: string;
  evoSettings: Record<string, any>;
  agentTemplates: Record<string, AgentConfig>;
  evolutionStrategies?: any;
  metrics?: any;
}

/**
 * Configuration Manager for Export/Import of Evo system configurations
 */
export class ConfigManager {
  private logger: Logger;
  private agentDir: string;

  constructor(logger: Logger, agentDir?: string) {
    this.logger = logger;
    this.agentDir = agentDir || getAgentDir();
  }

  /**
   * Export current configuration to a JSON file
   */
  async exportConfig(filePath?: string): Promise<string> {
    const exportPath = filePath || join(this.agentDir, 'evo-config-export.json');

    try {
      // 1. Read current settings
      const settingsPath = join(this.agentDir, 'settings.json');
      let settings: Record<string, any> = {};
      try {
        const raw = await readFile(settingsPath, 'utf-8');
        settings = JSON.parse(raw);
      } catch (e) {
        this.logger.warn('Could not read settings.json for export:', e);
      }

      // 2. Extract evo-specific settings
      const evoSettings = settings.evo || {};

      // 3. Collect agent templates from settings
      const agentTemplates: Record<string, AgentConfig> = {};
      const customTemplates = settings.evo?.agentTemplates as Record<string, any> | undefined;
      if (customTemplates) {
        for (const [type, template] of Object.entries(customTemplates)) {
          agentTemplates[type] = {
            type,
            systemPrompt: template.systemPrompt,
            model: 'USE_DEFAULT_MODEL', // placeholder, will use defaultModel on import
            thinkingLevel: template.thinkingLevel || 'medium',
            tools: template.tools || [],
            customTools: template.customTools,
          };
        }
      }

      // 4. Get strategy configuration if available
      const evolutionStrategy = evoSettings.evolutionStrategy || 'genetic';
      const enableGeneticStrategy = evoSettings.enableGeneticStrategy || false;

      // 5. Build export object
      const exportData: EvoConfigExport = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        evoSettings: {
          evolutionInterval: evoSettings.evolutionInterval || 300000,
          autoApply: evoSettings.autoApply || false,
          evolutionStrategy,
          enableGeneticStrategy,
          enableSandbox: evoSettings.enableSandbox || false,
          enablePromptOptimization: evoSettings.enablePromptOptimization || false,
          promptOptimizationInterval: evoSettings.promptOptimizationInterval || 5,
          enableWebUI: evoSettings.enableWebUI || false,
          webUIPort: evoSettings.webUIPort || 3000,
          webhookUrl: evoSettings.webhookUrl,
          maxBackups: evoSettings.maxBackups || 50,
        },
        agentTemplates,
      };

      // 6. Write to file
      await writeFile(exportPath, JSON.stringify(exportData, null, 2));
      this.logger.info(`✅ Configuration exported to ${exportPath}`);
      return exportPath;
    } catch (error: any) {
      this.logger.error('Failed to export configuration:', error.message);
      throw error;
    }
  }

  /**
   * Import configuration from a JSON file and merge/apply to settings.json
   */
  async importConfig(filePath: string, merge: boolean = true): Promise<void> {
    try {
      const raw = await readFile(filePath, 'utf-8');
      const importData: EvoConfigExport = JSON.parse(raw);

      // Validate version
      if (!importData.version) {
        throw new Error('Invalid configuration file: missing version');
      }

      this.logger.info(`📥 Importing configuration (version ${importData.version}, exported ${importData.exportedAt})`);

      // Read current settings
      const settingsPath = join(this.agentDir, 'settings.json');
      let currentSettings: Record<string, any> = {};
      try {
        const existing = await readFile(settingsPath, 'utf-8');
        currentSettings = JSON.parse(existing);
      } catch (e) {
        // File doesn't exist, will create new
      }

      // Ensure evo section exists
      if (!currentSettings.evo) currentSettings.evo = {};

      // Merge/apply evoSettings
      const target = merge ? currentSettings.evo : {};
      Object.assign(target, importData.evoSettings);

      // Update agent templates
      if (importData.agentTemplates && Object.keys(importData.agentTemplates).length > 0) {
        if (!currentSettings.evo.agentTemplates) currentSettings.evo.agentTemplates = {};
        if (merge) {
          Object.assign(currentSettings.evo.agentTemplates, importData.agentTemplates);
        } else {
          currentSettings.evo.agentTemplates = importData.agentTemplates;
        }
        this.logger.info(`📦 Imported ${Object.keys(importData.agentTemplates).length} agent templates`);
      }

      // Write back
      await writeFile(settingsPath, JSON.stringify(currentSettings, null, 2));
      this.logger.info(`✅ Configuration imported to ${settingsPath}`);

      // Notify system to reload if running
      try {
        const { EvoSystem } = await import('./system.js');
        const system = EvoSystem.getInstance();
        if (system) {
          await system.reloadConfiguration();
          this.logger.info('🔄 Live reload triggered');
        }
      } catch (e) {
        // System not running, will take effect on next start
        this.logger.info('ℹ️  Changes will take effect on next restart');
      }
    } catch (error: any) {
      this.logger.error('Failed to import configuration:', error.message);
      throw error;
    }
  }

  /**
   * Create a configuration snapshot (backup) of current settings
   */
  async createSnapshot(name?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotName = name || `snapshot-${timestamp}`;
    const snapshotDir = join(this.agentDir, '.evo', 'snapshots');

    try {
      await mkdir(snapshotDir, { recursive: true });
      const snapshotPath = join(snapshotDir, `${snapshotName}.json`);

      const settingsPath = join(this.agentDir, 'settings.json');
      const raw = await readFile(settingsPath, 'utf-8');
      await writeFile(snapshotPath, raw);

      this.logger.info(`📸 Created snapshot: ${snapshotName}`);
      return snapshotPath;
    } catch (error: any) {
      this.logger.error('Failed to create snapshot:', error.message);
      throw error;
    }
  }

  /**
   * List available snapshots
   */
  async listSnapshots(): Promise<Array<{ name: string; path: string; size: number; created: Date }>> {
    const snapshotDir = join(this.agentDir, '.evo', 'snapshots');
    try {
      const { readdir, stat } = await import('fs/promises');
      const files = await readdir(snapshotDir).catch(() => []);
      const snapshots = await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(async f => {
            const p = join(snapshotDir, f);
            const s = await stat(p);
            return {
              name: f.replace('.json', ''),
              path: p,
              size: s.size,
              created: s.mtime,
            };
          })
      );
      return snapshots.sort((a, b) => b.created.getTime() - a.created.getTime());
    } catch (e) {
      return [];
    }
  }

  /**
   * Restore from a snapshot
   */
  async restoreSnapshot(snapshotName: string): Promise<void> {
    const snapshotDir = join(this.agentDir, '.evo', 'snapshots');
    const snapshotPath = join(snapshotDir, `${snapshotName}.json`);

    try {
      const raw = await readFile(snapshotPath, 'utf-8');
      const settingsPath = join(this.agentDir, 'settings.json');
      await writeFile(settingsPath, raw);
      this.logger.info(`✅ Restored snapshot: ${snapshotName}`);

      // Reload if running
      try {
        const { EvoSystem } = await import('./system.js');
        const system = EvoSystem.getInstance();
        if (system) {
          await system.reloadConfiguration();
        }
      } catch (e) {
        // ignore
      }
    } catch (error: any) {
      this.logger.error('Failed to restore snapshot:', error.message);
      throw error;
    }
  }
}
