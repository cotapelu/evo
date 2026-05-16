# 🚀 RUNNING EVOLUTION: Step-by-Step Guide

## 📋 PREREQUISITES

1. **Node.js 20+** ( bạn có: v24.11.1 ✅)
2. **API Key** cho Anthropic hoặc OpenAI
3. **pi-coding-agent** quyền truy cập

---

## 🔑 STEP 1: Setup API Key

```bash
# Create pi agent directory (if not exists)
mkdir -p ~/.pi/agent

# Create auth.json with your API key
cat > ~/.pi/agent/auth.json <<EOF
{
  "anthropic": "sk-ant-api-...your-key-here",
  "openai": "sk-...your-key-here"
}
EOF

# Secure permissions
chmod 600 ~/.pi/agent/auth.json
```

---

## 🎯 STEP 2: Select Default Model

```bash
# Build first
npm run build

# Run pi to set model (or edit settings.json directly)
npm start

# Trong TUI, type:
/model anthropic/claude-sonnet-4-20250514
```

Hoặc edit `settings.json`:

```json
{
  "defaultModel": "anthropic/claude-sonnet-4-20250514",
  "defaultThinkingLevel": "medium",
  "evo": {
    "evolutionInterval": 300000,
    "autoApply": false,
    "evolutionStrategy": "genetic",
    "enableGeneticStrategy": true,
    "validation": {
      "runTests": false
    }
  }
}
```

---

## 🏃 STEP 3: Start Evolution

```bash
# TUI mode (recommended)
npm start

# When in TUI, type:
/evolution start 300000   # Start daemon, 5 phút interval
```

Hoặc non-interactive (headless):

```bash
# Create a script to run one cycle
node -e "import('./dist/src/system.js').then(s => s.EvoSystem.getInstance().then(sys => sys.initialize().then(() => sys.getEvolutionEngine().cycle().then(r => console.log('Cycle result:', r)))))"
```

---

## 📊 STEP 4: Monitor Progress

Trong TUI, dùng các commands:

| Command | Purpose |
|---------|---------|
| `/evo` | Xem trạng thái nhanh (level, uptime, memory) |
| `/evolution-metrics` | Xem chi tiết metrics (success rate, cycle time) |
| `/evolution-history` | Xem lịch sử improvements |
| `/evolution-logs` | Xem log files đã rotate |
| `/agents` | Xem agents đang chạy |
| `/spawn-agent coder "Review evolution-engine.ts"` | Spawn agent công việc cụ thể |

---

## 📁 STEP 5: Check Artifacts

**Logs:**
```bash
tail -f ~/.pi/agent/evo.log
```

**Backups:**
```bash
ls -la ~/.pi/agent/.evo/backups/
```

**History:**
```bash
cat ~/.pi/agent/.evo/backups/history.json | jq .
```

**Sessions:**
```bash
ls ~/.pi/agent/sessions/
```

---

## 🔄 STEP 6: Rollback Nếu Cần

Nếu evolution tạo ra code lỗi:

```text
/evolution-rollback 0   # rollback về level 0 (trước khi apply)
```

Hoặc xem history trước:

```text
/evolution-history
# Output: Level 1: Added validation runner...
#         Level 2: Improved diff parsing...
# Choose level to rollback to
```

---

## 🧪 STEP 7: Testing Evolution Cycle

Để kiểm tra pipeline hoạt động, bạn có thể:

### **Option A: Dry-run (autoApply: false)**
`settings.json`:
```json
"evo": {
  "autoApply": false
}
```
→ Cycle sẽ chỉ tạo diff, không apply. Bạn xem diff rồi quyết định thủ công.

### **Option B: Auto-apply với validation**
`settings.json`:
```json
"evo": {
  "autoApply": true,
  "validation": {
    "runTests": true
  }
}
```
→ Hệ thống sẽ tự apply, rồi chạy `tsc --noEmit` và Jest. Nếu thất bại → auto-rollback.

---

## 🎨 STEP 8: Web UI (Optional)

```text
/web-ui-start 3000
```

Mở browser: http://localhost:3000

Dashboard hiển thị:
- System status (uptime, memory, evolution level)
- Evolution controls (Start/Stop/Run Cycle)
- Running agents table
- Metrics charts

---

## ⚙️ STEP 9: Hot-Reload Configuration

Bạn có thể thay đổi config mà không restart:

```text
/reload-config
```

Thay đổi có hiệu lực ngay:
- `evolutionInterval`
- `evolutionStrategy`
- `enableGeneticStrategy`
- `enablePromptOptimization`
- ...

---

## 🚨 TROUBLESHOOTING

### **"No default model configured"**
→ Chạy `/model` trong TUI hoặc set `defaultModel` trong `settings.json`.

### **"Evolution engine not available"**
→ EvoSystem chưa khởi tạo. Phải chạy `npm start` để vào TUI, extensions mới load.

### **LLM API errors**
→ Check API key trong `~/.pi/agent/auth.json`
→ Check network connectivity
→ Check provider status (status.anthropic.com, status.openai.com)

### **Validation fails**
Nếu `tsc --noEmit` fails → auto-rollback.
Xem lỗi trong `~/.pi/agent/evo.log`.
Sửa code thủ công, rồi chạy lại cycle.

### **Out of memory**
→ Codebase lớn quá 100k tokens. Tăng `maxTokens` trong CodeAnalyzer:
```typescript
// src/system.ts (hoặc config)
const codeAnalyzer = new CodeAnalyzer(cwd, 200000, logger); // 200k tokens
```

---

## 📈 EXPECTED BEHAVIOR

**Khi evolution chạy auto:**

1. Mỗi 5 phút, engine chạy 1 cycle
2. Đọc codebase (evo.ts + src/**/*.ts)
3. Gửi prompt #1 đến LLM: "Analyze and suggest improvements"
4. LLM trả về JSON: `{ improvements: [...] }`
5. Chọn improvement tốt nhất (theo strategy)
6. Gửi prompt #2: "Generate diff for file X, Y, Z"
7. Nhận diff, apply (nếu autoApply)
8. Validate: syntax + type-check + tests
9. Nếu pass: level++, lưu history, update metrics
10. Nếu fail: rollback, log error, circuit breaker đếm

**Sau vài giờ:**
- Level tăng dần (nếu có improvements)
- Metrics hiển thị success rate
- Log file `evo.log` chứa chi tiết từng cycle
- Backups được tạo ở `~/.pi/agent/.evo/backups/`

---

## 🧬 GENETIC STRATEGY ĐẶC BIỆT

Khi `enableGeneticStrategy: true`:

- Engine duy trì population 10 individuals
- Mỗi individual có genes (priority weight, category preference, risk tolerance, ...)
- Sau mỗi cycle, record outcome (success/fail) vào individual
- Cứ 5 evaluations → evolve population (crossover, mutation)
- Cycle sau dùng best individual để chọn improvement

**Kết quả:** System tự học cách chọn improvements phù hợp với codebase.

---

## 📚 MORE INFO

- **Architecture deep-dive**: `ARCHITECTURE-ANALYSIS.md`
- **Changelog**: `CHANGELOG-v2.md`
- **Original spec**: `EVOLUTION.md`
- **Logs**: `~/.pi/agent/evo.log`

---

**May the evolution be ever in your favor!** 🚀🧬
