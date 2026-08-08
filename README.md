# SillyTavern Relations Tracker

An advanced, highly-customizable relationship tracking extension for SillyTavern. It gives the AI the ability to track, analyze, and actively update relationship dynamics between any characters in the chat over time.

## 🌟 Key Features

* **Advanced Bond Types (v3)**
  Track relationships with 6 distinct bond types, each with its own CP constraints, transition rules, and contextual tier names:
  * `[R] Romantic` 💋
  * `[PL] Platonic Love` 💛 (Found family / Inseparable bond)
  * `[P] Platonic` 🤝
  * `[F] Family` 🏠 (Capped at 70 CP max, cannot directly become romantic)
  * `[C] Complicated` 🌀
  * `[H] Hostile` ⚔
* **Dynamic Multi-Character Tracking**
  The AI will automatically detect significant interactions between *any* characters in the chat (e.g. Bruce Wayne and Damian Wayne) and dynamically spawn new relationship cards for them.
* **Hybrid Mode & History Log**
  Choose between Auto (AI applies changes instantly) or Hybrid (AI suggests changes, you confirm). Track exactly *when* and *why* relationships changed with the built-in History Log on every card.
* **Smart Scan Context Compression**
  Enable "Smart Scan" to compress chat history (removing HTML and long descriptions, keeping dialogue). This allows you to scan 3-4x more messages for the same token cost.
* **Custom API Profiles**
  Select a specific Connection Profile (e.g. Claude for roleplay, but a cheaper/faster model like DeepSeek for relation tracking) directly from the settings.
* **Mobile-Friendly Premium UI**
  Glassmorphism design that inherits your SillyTavern theme colors, with dynamic colored accents and sliders based on the bond type.

## 🚀 Installation
Currently, this extension is installed manually:
1. Open your SillyTavern extensions folder: `SillyTavern/data/default-user/extensions/`
2. Create a folder named `sillytavern-relations-tracker`
3. Copy all files from this repository into that folder.
4. Restart SillyTavern.

## 🛠️ Usage

1. Open the **Relations Tracker** drawer in the extensions panel.
2. Click **Add** to manually create a tracker between two characters, or simply chat and wait for the AI to spawn one if it detects a relationship!
3. Open **Settings ⚙** to configure:
   * **AI Mode**: Manual, Auto, or Hybrid.
   * **Smart Scan**: Compress context to save tokens.
   * **Context Depth**: How many messages the AI scans backwards.
   * **Connection Profile**: Choose the API used for the background analysis.

## 📜 How Rules & Tiers Work

The extension dynamically updates the `Tier` dropdown text depending on the chosen `Bond Type`.
For example, if Charm Points (CP) are at `100`:
- If Bond is **Romantic**, the Tier is `Deeply in love`.
- If Bond is **Platonic**, the Tier is `Soulmates`.
- If Bond is **Family**, the Tier is `Unbreakable`.

The AI is also constrained by code logic:
- Family bonds are hard-capped at 70 CP.
- Family bonds can never directly transition into Romantic bonds.

## 💾 Export & Import
Use the **Export** button to download a `.json` backup of your relationship data (including the history log) for a specific chat. Use **Import** to load it back in.
