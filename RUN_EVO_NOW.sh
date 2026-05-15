#!/bin/bash
# ⚡ QUICK START - RUN EVO AGENT NOW
# One-command launcher for Evo Agent v2.2.0

set -e

cd /home/quangtynu/Qcoder/evo

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║              Evo Agent v2.2.0 - Quick Start Launcher            ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# 1. Check build
echo "🔨 Step 1: Verifying build..."
if [ ! -f "dist/evo.js" ]; then
    echo "   Building first..."
    npm run build
fi
echo "   ✅ Build ready"
echo ""

# 2. Check settings
echo "📝 Step 2: Checking configuration..."
if [ ! -f "$HOME/.pi/agent/settings.json" ]; then
    echo "   ⚠️  settings.json not found in ~/.pi/agent/"
    echo "   📋 Copying SETTINGS_EXAMPLE.json..."
    mkdir -p "$HOME/.pi/agent"
    cp SETTINGS_EXAMPLE.json "$HOME/.pi/agent/settings.json"
    echo "   ✅ Created: $HOME/.pi/agent/settings.json"
    echo "   💡 Edit it to configure: model, API keys, features"
else
    echo "   ✅ settings.json exists"
fi
echo ""

# 3. Check API key
echo "🔑 Step 3: Checking LLM API key..."
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
    echo "   ⚠️  No API keys detected!"
    echo "   💡 Set one of these environment variables:"
    echo "      export ANTHROPIC_API_KEY='your-key-here'"
    echo "      export OPENAI_API_KEY='your-key-here'"
    echo ""
    read -p "   Set ANTHROPIC_API_KEY now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "   Enter your Anthropic API key: " api_key
        export ANTHROPIC_API_KEY="$api_key"
        echo "   ✅ API key set for this session"
        echo "   💡 To make permanent, add to ~/.bashrc or ~/.zshrc:"
        echo "      export ANTHROPIC_API_KEY='$api_key'"
    fi
else
    echo "   ✅ API key found ($(echo ${ANTHROPIC_API_KEY:+Anthropic}${OPENAI_API_KEY:+OpenAI}))"
fi
echo ""

# 4. Show commands
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  🚀 READY TO LAUNCH!                                             ║"
echo "╠═══════════════════════════════════════════════════════════════════╣"
echo "║                                                                 ║"
echo "║  Run now:                                                       ║"
echo "║    npx pi                                                       ║"
echo "║                                                                 ║"
echo "║  Inside pi TUI (π ), use these commands:                       ║"
echo "║    /evolution-start        → Start auto-evolution daemon       ║"
echo "║    /web-ui-start 3000      → Open dashboard at localhost:3000  ║"
echo "║    /evolution-status       → Check engine status               ║"
echo "║    /spawn-agent researcher → Spawn a sub-agent                ║"
echo "║    /help                  → See all commands                  ║"
echo "║                                                                 ║"
echo "║  Or run directly:                                               ║"
echo "║    node dist/evo.js                                            ║"
echo "║                                                                 ║"
echo "║  Dashboard will be at: http://localhost:3000                   ║"
echo "║                                                                 ║"
echo "║  Logs: ~/.pi/agent/evo.log                                     ║"
echo "║  History: ~/.pi/agent/.evo/history.json                        ║"
echo "║  Backups: ~/.pi/agent/.evo/backups/                            ║"
echo "║                                                                 ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "✨ Type 'npx pi' to start evolving! ✨"
echo ""

# Ask if want to start now
read -p "Start pi now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Launching pi... (press Ctrl+C to exit)"
    echo ""
    npx pi
fi