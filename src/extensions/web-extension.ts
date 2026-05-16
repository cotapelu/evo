import type { ExtensionAPI, ExtensionCommandContext, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { EvoSystem } from '../system.js';

// Simple HTTP server for Web UI
let serverInstance: any = null;

export default function (pi: ExtensionAPI) {
  const sendMessage = async (text: string) => {
    await pi.sendMessage({ customType: 'text', content: text, display: true });
  };

  // Start Web UI server
  pi.registerCommand('web-ui-start', {
    description: 'Start Web UI dashboard server',
    handler: async (argsStr: string, ctx: ExtensionCommandContext) => {
      const trimmed = argsStr.trim();
      const port = trimmed ? parseInt(trimmed, 10) : 3000;
      if (trimmed && isNaN(port)) {
        await sendMessage('❌ Invalid port number');
        return;
      }

      try {
        const { createServer } = await import('http');

        serverInstance = createServer(async (req, res) => {
          const url = new URL(req.url || '/', `http://localhost:${port}`);

          // Simple routing
          if (url.pathname === '/' || url.pathname === '/dashboard') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(generateDashboardHTML());
          } else if (url.pathname === '/api/metrics') {
            try {
              const system = EvoSystem.getInstance();
              const engine = system.getEvolutionEngine();
              const agentManager = system.getAgentManager();
              const metrics = await engine?.getMetrics();
              const agents = agentManager?.listAgents();

              const data = {
                metrics,
                agents: agents?.map((a: any) => ({ id: a.id, type: a.config.type, status: a.status })),
                timestamp: new Date().toISOString(),
              };

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(data, null, 2));
            } catch (e: any) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: e.message }));
            }
          } else if (url.pathname === '/api/metrics-history') {
            try {
              const system = EvoSystem.getInstance();
              const engine = system.getEvolutionEngine();
              const metricsHistory = await engine?.getMetricsHistory();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(metricsHistory || [], null, 2));
            } catch (e: any) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: e.message }));
            }
          } else if (url.pathname === '/api/history') {
            try {
              const system = EvoSystem.getInstance();
              const engine = system.getEvolutionEngine();
              const history = await engine?.getHistory();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(history, null, 2));
            } catch (e: any) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: e.message }));
            }
          } else if (url.pathname === '/api/agents') {
            try {
              const system = EvoSystem.getInstance();
              const agentManager = system.getAgentManager();
              const agents = agentManager?.listAgents().map((a: any) => ({ id: a.id, type: a.config.type, status: a.status }));
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(agents, null, 2));
            } catch (e: any) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: e.message }));
            }
          } else if (url.pathname === '/api/evolve') {
            try {
              const system = EvoSystem.getInstance();
              const engine = system.getEvolutionEngine();
              const result = await engine?.cycle();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: result, level: engine?.getLevel() }));
            } catch (e: any) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: e.message }));
            }
          } else if (url.pathname === '/api/rollback') {
            if (req.method !== 'POST') {
              res.writeHead(405);
              res.end('Method Not Allowed');
              return;
            }
            try {
              let body = '';
              req.on('data', chunk => body += chunk);
              req.on('end', () => {
                try {
                  const parsed = JSON.parse(body);
                  EvoSystem.getInstance().getEvolutionEngine()?.rollback(parsed.level).then((success: boolean) => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success }));
                  }).catch((e: any) => {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: e.message }));
                  });
                } catch (e: any) {
                  res.writeHead(400);
                  res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
              });
              return;
            } catch (e: any) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: e.message }));
            }
          } else if (url.pathname === '/api/spawn-agent') {
            if (req.method !== 'POST') {
              res.writeHead(405);
              res.end('Method Not Allowed');
              return;
            }
            try {
              let body = '';
              req.on('data', chunk => body += chunk);
              req.on('end', () => {
                try {
                  const parsed = JSON.parse(body);
                  EvoSystem.getInstance().getAgentManager()?.spawnAgent(parsed.type, { task: parsed.task }).then((agent: any) => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(agent));
                  }).catch((e: any) => {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: e.message }));
                  });
                } catch (e: any) {
                  res.writeHead(400);
                  res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
              });
              return;
            } catch (e: any) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: e.message }));
            }
          } else if (url.pathname === '/api/models') {
            try {
              const system = EvoSystem.getInstance();
              const modelRegistry = system.getModelRegistry ? system.getModelRegistry() : null;
              const models = modelRegistry ? modelRegistry.getAll().map((m: any) => ({ provider: m.provider, id: m.id, name: m.name })) : [];
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(models));
            } catch (e: any) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: e.message }));
            }
          } else if (url.pathname === '/api/model' && req.method === 'POST') {
            try {
              let body = '';
              req.on('data', chunk => body += chunk);
              req.on('end', async () => {
                const { model } = JSON.parse(body);
                const system = EvoSystem.getInstance();
                const settingsManager = system.getSettingsManager();
                if (settingsManager) {
                  settingsManager.setDefaultModel(model);
                  await settingsManager.flush();
                  res.writeHead(200);
                  res.end(JSON.stringify({ success: true }));
                } else {
                  res.writeHead(500);
                  res.end(JSON.stringify({ error: 'Settings not available' }));
                }
              });
              return;
            } catch (e: any) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: e.message }));
            }
          } else {
            res.writeHead(404);
            res.end('Not Found');
          }
        });

        serverInstance.listen(port, () => {
          sendMessage(`✅ Web UI dashboard started on http://localhost:${port}`);
        });

        pi.on('session_shutdown', async () => {
          if (serverInstance) {
            serverInstance.close();
            serverInstance = null;
          }
        });
      } catch (e: any) {
        await sendMessage(`❌ Failed to start Web UI: ${e.message}`);
      }
    },
  });

  pi.registerCommand('web-ui-stop', {
    description: 'Stop Web UI dashboard server',
    handler: async (argsStr: string, ctx: ExtensionCommandContext) => {
      if (serverInstance) {
        serverInstance.close();
        serverInstance = null;
        await sendMessage('✅ Web UI dashboard stopped');
      } else {
        await sendMessage('⚠️ Web UI not running');
      }
    },
  });
}
function generateDashboardHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Evo Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #1a1a1a; color: #fff; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .card { background: #2a2a2a; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
    h1, h2 { margin: 0 0 15px 0; color: #4CAF50; }
    .metric { font-size: 24px; font-weight: bold; margin: 10px 0; }
    .label { color: #888; font-size: 12px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #333; }
    th { color: #888; font-weight: normal; }
    .status-running { color: #4CAF50; }
    .status-stopped { color: #f44336; }
    button { background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px; }
    button:hover { background: #45a049; }
    button.danger { background: #f44336; }
    button.danger:hover { background: #d32f2f; }
    #refresh { background: #2196F3; }
    #refresh:hover { background: #1976D2; }
  </style>
</head>
<body>
  <h1>🚀 Evo Dashboard</h1>
  <div class="grid">
    <div class="card">
      <h2>📊 Metrics</h2>
      <div class="label">Total Cycles</div>
      <div class="metric" id="total-cycles">-</div>
      <div class="label">Success Rate</div>
      <div class="metric" id="success-rate">-</div>
      <div class="label">Avg Cycle Time</div>
      <div class="metric" id="avg-cycle-time">-</div>
      <button id="refresh" onclick="loadData()">Refresh</button>
    </div>
    <div class="card">
      <h2>🤖 Agents</h2>
      <table>
        <thead><tr><th>ID</th><th>Type</th><th>Status</th></tr></thead>
        <tbody id="agents-table"></tbody>
      </table>
      <br>
      <input type="text" id="spawn-type" placeholder="Type: researcher/coder/analyzer" style="width: 150px;">
      <input type="text" id="spawn-task" placeholder="Task (optional)" style="width: 200px;">
      <button onclick="spawnAgent()">Spawn</button>
    </div>
    <div class="card">
      <h2>⚙️ Model</h2>
      <div class="label">Current Model</div>
      <div class="metric" id="current-model">-</div>
      <div class="label">Available Models</div>
      <select id="model-select" style="width: 100%; margin: 10px 0; padding: 5px; background: #333; color: #fff; border: 1px solid #555;">
        <option value="">-- Select Model --</option>
      </select>
      <button onclick="changeModel()">Apply</button>
    </div>
    <div class="card">
      <h2>🔄 Evolution</h2>
      <button onclick="triggerEvolution()">Trigger Evolution</button>
      <button class="danger" onclick="rollbackEvolution()">Rollback Last</button>
      <div style="margin-top: 10px;">
        <div class="label">Current Level</div>
        <div class="metric" id="current-level">-</div>
      </div>
    </div>
    <div class="card" style="grid-column: span 2;">
      <h2>📈 Success Rate History</h2>
      <canvas id="metricsChart"></canvas>
    </div>
    <div class="card">
      <h2>📜 History</h2>
      <table>
        <thead><tr><th>Level</th><th>Improvement</th><th>Time</th></tr></thead>
        <tbody id="history-table"></tbody>
      </table>
    </div>
  </div>
  <script>
    let chartInstance = null;

    async function loadData() {
      try {
        const [metricsRes, agentsRes, historyRes, modelsRes, metricsHistoryRes] = await Promise.all([
          fetch('/api/metrics'),
          fetch('/api/agents'),
          fetch('/api/history'),
          fetch('/api/models'),
          fetch('/api/metrics-history')
        ]);
        const metrics = await metricsRes.json();
        const agents = await agentsRes.json();
        const history = await historyRes.json();
        const models = await modelsRes.json();
        const metricsHistory = await metricsHistoryRes.json();

        document.getElementById('total-cycles').textContent = metrics.totalCycles || 0;
        document.getElementById('success-rate').textContent = (metrics.successRate || 0).toFixed(1) + '%';
        document.getElementById('avg-cycle-time').textContent = ((metrics.avgCycleTimeMs || 0)/1000).toFixed(2) + 's';
        document.getElementById('current-level').textContent = metrics.level || 0;
        document.getElementById('current-model').textContent = metrics.currentModel || 'Unknown';

        // Populate model select
        const select = document.getElementById('model-select');
        select.innerHTML = '<option value=\"\">-- Select Model --</option>' +
          models.map((m) => '<option value=\"' + m.provider + '/' + m.id + '\">' + m.provider + '/' + m.id + '</option>').join('');

        // Agents table
        const agentsTable = document.getElementById('agents-table');
        agentsTable.innerHTML = agents.map(a => '<tr><td>' + a.id + '</td><td>' + (a.config?.type || a.type) + '</td><td class=\"status-' + a.status + '\">' + a.status + '</td></tr>').join('');

        // History table
        const historyTable = document.getElementById('history-table');
        historyTable.innerHTML = (history || []).map(h => '<tr><td>' + h.level + '</td><td>' + (h.improvement?.substring(0, 50) || '') + '...</td><td>' + new Date(h.timestamp).toLocaleTimeString() + '</td></tr>').join('');

        // Metrics chart
        renderChart(metricsHistory);
      } catch (e) {
        console.error('Failed to load data:', e);
      }
    }

    function renderChart(history) {
      const ctx = document.getElementById('metricsChart').getContext('2d');
      if (!history || history.length === 0) {
        if (chartInstance) chartInstance.destroy();
        ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = '#888';
        ctx.fillText('No metrics history yet', 10, 20);
        return;
      }
      const labels = history.map((h, i) => 'Cycle ' + (i+1));
      const successRates = history.map(h => h.successRate);
      if (chartInstance) chartInstance.destroy();
      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Success Rate (%)',
            data: successRates,
            fill: true,
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.2)',
            tension: 0.3,
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: '#fff' } } },
          scales: {
            x: { ticks: { color: '#ccc' }, grid: { color: '#333' } },
            y: { beginAtZero: true, max: 100, ticks: { color: '#ccc' }, grid: { color: '#333' } }
          }
        }
      });
    }

    async function triggerEvolution() {
      const res = await fetch('/api/evolve', { method: 'POST' });
      const data = await res.json();
      alert('Evolution triggered: ' + (data.success ? 'Success' : 'Failed'));
      loadData();
    }

    async function rollbackEvolution() {
      if (!confirm('Rollback to previous level?')) return;
      const res = await fetch('/api/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 0 })
      });
      const data = await res.json();
      alert('Rollback: ' + (data.success ? 'Success' : 'Failed'));
      loadData();
    }

    async function spawnAgent() {
      const type = document.getElementById('spawn-type').value;
      const task = document.getElementById('spawn-task').value;
      if (!type) { alert('Type required'); return; }
      const res = await fetch('/api/spawn-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, task })
      });
      const data = await res.json();
      alert('Spawned: ' + (data.id || 'Error'));
      loadData();
    }

    async function changeModel() {
      const select = document.getElementById('model-select');
      const model = select.value;
      if (!model) { alert('Select a model'); return; }
      const res = await fetch('/api/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model })
      });
      const data = await res.json();
      alert('Model changed: ' + (data.success ? 'Success' : 'Failed'));
      loadData();
    }

    setInterval(loadData, 5000);
    loadData();
  </script>
</body>
</html>`;
}
