# SillyTavern Relations Tracker

A premium extension for SillyTavern that visualizes and tracks relationship points (CP), tiers, and bond types directly in the UI.

This extension completely eliminates the need to force the AI to output tracking tags at the end of every message, saving tokens and improving reliability.

## Features
- **Beautiful UI:** A floating modal seamlessly integrated with your active SillyTavern theme.
- **Independent State Management:** The extension manages the relationship archive independently.
- **Context Injection:** Automatically injects the latest relationship state into the system prompt behind the scenes, ensuring the AI always knows the relationship tier without polluting the chat history.
- **Interactive Controls:** Edit Charm Points, Bond Types, and Relationship Labels manually.

## Installation
1. Navigate to your SillyTavern installation directory.
2. Go to `public/scripts/extensions/third-party/`
3. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/sillytavern-relations-tracker.git
   ```
4. Refresh your SillyTavern page.

## Usage
- Click the floating **Heart** icon in the bottom right corner of the chat window to open the Relations Tracker.
- Add relationships manually or let the extension parse existing `<!--RELATIONS_ARCHIVE:...-->` tags from your chat history.
- The extension will automatically inject the tracker into the prompt before generation.
