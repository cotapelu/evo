# Agent OS 🚀

**Self-Evolving Autonomous Agent System**

[![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)](https://github.com)
[![Version](https://img.shields.io/badge/version-1.0--RC-blue)](https://github.com)
[![Node](https://img.shields.io/badge/node-%3E%3D16-brightgreen)](https://nodejs.org)

Agent OS là một hệ thống agent tự tiến hóa, tự sửa lỗi, tự mở rộng có khả năng:

- ✨ **Tự Evolution** - Đọc & sửa code của chính nó
- 🧠 **Tự Nhận thức** - Phân tích code, phát hiện weaknesses
- 📈 **Tự Cải tiến** - Thêm tính năng, fix bugs tự động
- 🧬 **Tự Nhân bản** - Spawn child agents
- 🔄 **Self-Healing** - Auto-rollback khi gặp lỗi
- 📊 **Observable** - HTTP metrics API, health checks
- 🔌 **Extensible** - Plugin system
- 🐳 **Containerized** - Docker ready

---

## 🏃 Quick Start

```bash
# Clone & install
git clone <repo>
cd agent-os
npm install

# Run locally
npm start

# Or with Docker
docker-compose up -d
```

Access metrics: `http://localhost:3456/metrics`  
Health check: `http://localhost:3456/health`

---

## 📖 Documentation

- **[Production Deployment Guide](PRODUCTION_DEPLOYMENT.md)** - Full ops guide
- **[Agent OS v1.0 Summary](AGENT_OS_v1.0_SUMMARY.md)** - Feature overview
- **[AGENTS.md](AGENTS.md)** - Evolution specification

---

## 🔧 Configuration

See `.env.example` for all options.

Quick config:

```bash
export AGENT_METRICS_PORT=3456
export AGENT_MAX_CHILDREN=10
export AGENT_ENABLE_DATABASE=true
npm start
```

---

## 🧪 Testing

```bash
# Quick health check
curl http://localhost:3456/health

# Full metrics
curl http://localhost:3456/metrics

# Trigger shutdown
curl -X POST http://localhost:3456/shutdown
```

---

## 📦 Docker

```bash
# Build
docker build -t agent-os .

# Run
docker run -p 3456:3456 -v $(pwd)/data:/data agent-os

# Or docker-compose
docker-compose up -d
```

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Make changes (ensure tests pass)
4. Submit PR

Note: Agent can modify its own code. Use with caution!

---

## 📜 License

MIT - See LICENSE file.

---

## 🙏 Acknowledgments

Built with ❤️ by the self-evolving agent system.
Inspired by biological evolution and distributed systems.
