import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { EvoSystem } from '../system.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getAgentDir } from '@earendil-works/pi-coding-agent';

let webServer: any = null;
let webPort: number = 3000;

// Simple HTML dashboard template
const DASHBOARD_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Evo Dashboard</title>
  <style>
    body { font-family: sans-serif; margin: 20px; background: #f5f5f5; }
    .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .metric { font-size: 24px; font-weight: bold; color: #333; }
    .label { color: #666; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; }
    button { padding: 8px 16px; margin: 2px; border: none; border-radius: 4px; background: #007bff; color: white; cursor: pointer; }
    button:hover { background: #0056b3; }
    button.danger { background: #dc3545; }
    button.danger:hover { background: #a71d2a; }
    #refresh { background: #28a745; }
    #refresh:hover { background: #1e7e34; }
  </style>
</head>
<body>
  <h1>🧬 Evo Dashboard</h1>
  
  <div class="card">
    <h2>System Status</h2>
    <div id="status">Loading...</div>
  </div>

  <div class="card">
    <h2>Evolution Controls</h2>
    <button onclick="startEvolution()">Start Auto-Evolution</button>
    <button onclick="stopEvolution()">Stop Auto-Evolution</button>
    <button onclick="triggerCycle()">Run One Cycle</button>
    <button onclick="getMetrics()">Refresh Metrics</button>
  </div>

  <div class="card">
    <h2>Running Agents</h2>
    <button id="refresh" onclick="listAgents()">Refresh</button>
    <table id="agents-table">
      <thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>

  <script>
    async function fetchJSON(url) {
      const res = await fetch(url);
      return res.json();
    }

    async function updateStatus() {
      const data = await fetchJSON('/api/status');
      document.getElementById('status').innerHTML = \`
        <div><span class="label">Uptime:</span> <span class="metric">\${Math.round(data.uptime / 60)}m</span></div>
        <div><span class="label">Evolution Level:</span> <span class="metric">\${data.evolution?.level || 0}</span></div>
        <div><span class="label">Auto-Running:</span> <span class="metric">\${data.evolution?.autoRunning ? 'Yes' : 'No'}</span></div>
        <div><span class="label">Active Agents:</span> <span class="metric">\${data.agents?.length || 0}</span></div>
        <div><span class="label">Memory RSS:</span> <span class="metric">\${Math.round(data.memory.rss / 1024 / 1024)} MB</span></div>
      \`;
    }

    async function getMetrics() {
      await updateStatus();
      const metrics = await fetchJSON('/api/metrics');
      alert('Metrics:\\n' + JSON.stringify(metrics, null, 2));
    }

    async function startEvolution() {
      const res = await fetch('/api/evolution/start', { method: 'POST' });
      const data = await res.json();
      alert(data.message);
      updateStatus();
    }

    async function stopEvolution() {
      const res = await fetch('/api/evolution/stop', { method: 'POST' });
      const data = await res.json();
      alert(data.message);
      updateStatus();
    }

    async function triggerCycle() {
      const res = await fetch('/api/evolution/cycle', { method: 'POST' });
      const data = await res.json();
      alert(data.message);
      updateStatus();
    }

    async function listAgents() {
      const agents = await fetchJSON('/api/agents');
      const tbody = document.querySelector('#agents-table tbody');
      tbody.innerHTML = agents.map(a => \`
        <tr>
          <td>\${a.id.substring(0, 12)}...</td>
          <td>\${a.type}</td>
          <td>\${a.status}</td>
          <td>\${new Date(a.createdAt).toLocaleString()}</td>
          <td><button onclick="stopAgent('\${a.id}')">Stop</button></td>
        </tr>
      \`).join('');
    }

    async function stopAgent(id) {
      if (!confirm('Stop agent ' + id.substring(0, 12) + '?')) return;
      const res = await fetch('/api/agents/' + id, { method: 'DELETE' });
      const data = await res.json();
      alert(data.message);
      listAgents();
    }

    // Auto-refresh every 10s
    setInterval(() => { updateStatus(); listAgents(); }, 10000);
    // Initial load
    updateStatus(); listAgents();
  </script>
</body>
</html>
`;

export default function (pi: ExtensionAPI) {
  // Commands to control Web UI
  pi.registerCommand('web-ui-start', {
    description: 'Start Web UI dashboard (default port 3000). Usage: /web-ui-start [port]',
    handler: async (argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const config = system.getSettingsManager()?.getProjectSettings() as any;
      const evoSettings = config?.evo || {};
      const port = parseInt(argsStr.trim() || evoSettings.webUIPort?.toString() || '3000', 10);

      if (webServer) {
        await pi.sendMessage({ customType: 'text', content: `⚠️ Web UI already running on port ${webPort}`, display: true });
        return;
      }

      try {
        // Simple HTTP server using Node's http module (would ideally use express)
        const http = await import('http');
        const url = await import('url');

        webPort = port;
        webServer = http.createServer(async (req, res) => {
          const parsed = url.parse(req.url || '', true);
          const pathname = parsed.pathname || '';

          if (req.method === 'GET' && pathname === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(DASHBOARD_HTML);
            return;
          }

          if (req.method === 'GET' && pathname === '/api/status') {
            const engine = system.getEvolutionEngine();
            const agentManager = system.getAgentManager();
            const status: any = {
              uptime: process.uptime(),
              memory: process.memoryUsage(),
              timestamp: new Date().toISOString(),
            };
            if (engine) {
              status.evolution = { level: engine.getLevel(), autoRunning: !!engine['autoInterval'] };
            }
            if (agentManager) {
              status.agents = agentManager.listAgents().map((a: any) => ({
                id: a.id,
                type: a.config.type,
                status: a.status,
                createdAt: a.createdAt,
              }));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(status));
            return;
          }

          if (req.method === 'GET' && pathname === '/api/metrics') {
            const engine = system.getEvolutionEngine();
            if (!engine) {
              res.writeHead(503);
              res.end(JSON.stringify({ error: 'Evolution engine not available' }));
              return;
            }
            const metrics = await engine.getMetrics();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(metrics));
            return;
          }

          if (req.method === 'POST' && pathname === '/api/evolution/start') {
            const engine = system.getEvolutionEngine();
            if (!engine) {
              res.writeHead(503);
              res.end(JSON.stringify({ error: 'Evolution engine not available' }));
              return;
            }
            const interval = evoSettings.evolutionInterval || 300000;
            engine.startAuto(interval);
            res.writeHead(200);
            res.end(JSON.stringify({ message: `✅ Auto-evolution started (interval: ${interval}ms)` }));
            return;
          }

          if (req.method === 'POST' && pathname === '/api/evolution/stop') {
            const engine = system.getEvolutionEngine();
            if (engine) {
              engine.stopAuto();
              res.writeHead(200);
              res.end(JSON.stringify({ message: '⏹️ Auto-evolution stopped' }));
            } else {
              res.writeHead(404);
              res.end(JSON.stringify({ error: 'Evolution engine not found' }));
            }
            return;
          }

          if (req.method === 'POST' && pathname === '/api/evolution/cycle') {
            const engine = system.getEvolutionEngine();
            if (!engine) {
              res.writeHead(503);
              res.end(JSON.stringify({ error: 'Evolution engine not available' }));
              return;
            }
            try {
              const result = await engine.cycle();
              res.writeHead(200);
              res.end(JSON.stringify({ message: result ? '✅ Cycle completed' : '⚠️ No improvements', result }));
            } catch (e: any) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: e.message }));
            }
            return;
          }

          if (req.method === 'GET' && pathname.startsWith('/api/agents')) {
            const agentManager = system.getAgentManager();
            if (!agentManager) {
              res.writeHead(503);
              res.end(JSON.stringify({ error: 'Agent manager not available' }));
              return;
            }
            if (req.method === 'GET') {
              const agents = agentManager.listAgents();
              res.writeHead(200);
              res.end(JSON.stringify(agents));
              return;
            }
          }

          if (req.method === 'DELETE' && pathname.match(/^\/api\/agents\/[^/]+$/)) {
            const agentId = pathname.split('/')[2];
            const agentManager = system.getAgentManager();
            if (!agentManager) {
              res.writeHead(503);
              res.end(JSON.stringify({ error: 'Agent manager not available' }));
              return;
            }
            const success = await agentManager.stopAgent(agentId);
            if (success) {
              res.writeHead(200);
              res.end(JSON.stringify({ message: `Agent ${agentId} stopped` }));
            } else {
              res.writeHead(404);
              res.end(JSON.stringify({ error: `Agent ${agentId} not found` }));
            }
            return;
          }

          res.writeHead(404);
          res.end('Not found');
        });

        webServer.listen(port, () => {
          pi.sendMessage({ customType: 'text', content: `🌐 Web UI started at http://localhost:${port}`, display: true });
        });
      } catch (e: any) {
        await pi.sendMessage({ customType: 'text', content: `❌ Failed to start Web UI: ${e.message}`, display: true });
      }
    },
  });

  pi.registerCommand('web-ui-stop', {
    description: 'Stop Web UI dashboard',
    handler: async (_argsStr: string, ctx: ExtensionCommandContext) => {
      if (!webServer) {
        await pi.sendMessage({ customType: 'text', content: '⚠️ Web UI not running', display: true });
        return;
      }
      await new Promise<void>((resolve, reject) => {
        webServer.close((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      webServer = null;
      await pi.sendMessage({ customType: 'text', content: '⏹️ Web UI stopped', display: true });
    },
  });
}
