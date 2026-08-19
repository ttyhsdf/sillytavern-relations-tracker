# 💕 Relations Tracker — SillyTavern Extension

A powerful relationship management extension for [SillyTavern](https://github.com/SillyTavern/SillyTavern) that tracks, visualizes, and dynamically updates character relationships using AI.

## ✨ Features

### 🎯 Core
- **6 Bond Types**: Romantic 💋, Platonic 🤝, Platonic Love 💛, Family 🏠, Hostile ⚔, Complicated 🌀
- **Dynamic CP Slider**: Color-coded progress bar that changes based on bond type
- **Context-Dependent Tiers**: Each bond type has unique tier names (e.g., Family uses "Unbreakable" instead of "Devoted")
- **Multi-Character Tracking**: Track relationships between ALL characters, not just User ↔ Character

### 🤖 AI Modes
| Mode | Description |
|------|-------------|
| **Manual** | Full manual control, no AI interference |
| **Auto** | AI analyzes every new message and updates relations automatically |
| **Hybrid** | AI suggests changes, you approve or dismiss via a notification banner |

### 🛡️ Bond Rules & Transitions
The extension enforces logical relationship boundaries:
- **Family → Romantic**: ❌ **Blocked** (always)
- **Family CP cap**: 70 (warm family bonds, no "Devoted")
- **Platonic → Romantic**: ✅ Allowed when CP > 60
- **Hostile → Romantic**: ✅ Enemies-to-lovers when CP > 20
- **Complicated**: Transitional state, AI will try to resolve it
- **Lock checkbox**: 🔒 Prevents AI from changing a relationship's bond type

### 📱 Mobile Responsive
Fully optimized for mobile devices — names truncate with ellipsis, cards stack properly, and touch-friendly controls.

### 📜 History Log
Every CP, Tier, Bond, and Label change is recorded with timestamps. Click the 🕐 icon on any card to view the change history.

### 🧠 Smart Scan
Compresses chat messages before sending to AI — strips HTML/markdown and truncates to 400 chars per message. Analyze 20+ messages for the cost of 5.

### 💾 Export / Import
- **Export**: Download all relationships as a JSON file
- **Import**: Load relationships from a previously exported file

### 🔌 Connection Profile Support
Use a separate API (e.g., DeepSeek) for background AI analysis via SillyTavern's Connection Manager.

## 📁 File Structure

```
sillytavern-relations-tracker/
├── manifest.json   # Extension metadata
├── index.js        # Main orchestrator
├── index.html      # UI template
├── style.css       # Styles (mobile-first)
├── prompts.js      # AI system prompts (EN/RU/UK)
├── rules.js        # Bond type rules & transitions
├── tiers.js        # Context-dependent tier labels
├── history.js      # Change history management
├── scanner.js      # Smart context compression
└── README.md       # This file
```

## 🚀 Installation

1. Navigate to your SillyTavern extensions folder:
   ```
   SillyTavern/data/default-user/extensions/
   ```
2. Clone or copy this repository:
   ```bash
   git clone https://github.com/ttyhsdf/sillytavern-relations-tracker.git
   ```
3. Restart SillyTavern or refresh the page (F5)
4. Open the Extensions panel → find "Relations Tracker"

## 📖 Usage

1. **Open a chat** with any character
2. Click **"Add"** to create a new relationship card (auto-detects character/user names)
3. Choose a **Bond Type** and adjust **CP** with the slider
4. Enable **Auto** or **Hybrid** mode for AI-driven updates
5. (Optional) Select a **Connection Profile** for a separate analysis API

## 🌐 Multi-Language Support

AI analysis prompts are available in:
- 🇬🇧 English
- 🇷🇺 Russian
- 🇺🇦 Ukrainian

## 📄 License

MIT
