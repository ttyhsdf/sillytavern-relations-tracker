# Changelog

## 1.0.2 (2026-08-22)

### 1. Самодокументируемый блок отношений в промпте

В V2 архив отношений впрыскивается в промпт только через `setExtensionPrompt(...)` и не пишется в видимый чат. Старый HTML-комментарий `<!--RELATIONS_ARCHIVE:...-->` был рудиментом от V1 и лишь снижал внимание модели к содержимому.

**Что изменилось:**

- `index.js` — добавлен новый билдер `buildRelationsPromptBlock()` (рядом со старым `buildRelationsTag()`, который сохранён для обратной совместимости/миграции). Формирует самопоясняющий блок без HTML-обёртки:
  - Заголовок `[RELATIONSHIP STATE]` (локализован EN/RU/UK).
  - Легенда связей из `ALL_BONDS` (включая кастомные) — `code name`.
  - Легенда тиров с реальными границами из `getTierIndex()`.
  - Строки по парам: `Source → Target: CP {cp} ({tier}) · {bond} {bondName} · "{label}"`.
  - При включённых `enableAdvStats` добавляются `Trust`/`Lust`; при наличии — `Status`.
  - `source`/`target`/`label`/`status` экранируются через `escapeHtml`.
- `index.js` — в `injectIntoPrompt()` вызов `buildRelationsTag()` заменён на `buildRelationsPromptBlock()`; сигнатура `setExtensionPrompt(extensionName, block, 1, 0)` и логика `nlResume` (`[RELATIONS SUMMARY ...]`) сохранены без изменений.
- `index.js` — добавлен словарь `PROMPT_BLOCK_LABELS` (EN/RU/UK) для заголовка и названий легенды; выбор языка по `settings.promptLang`, фолбэк EN.
- `prompts.js` — диапазоны тиров во всех трёх языках (EN/RU/UK) приведены к границам `getTierIndex()` из `tiers.js`:
  `Frozen ≤ -70 | Cold -69…-40 | Distant -39…-10 | Neutral -9…9 | Warm 10…39 | Close 40…69 | Devoted ≥ 70`.
  Ранее в промптах декларировались другие границы (`-60/-30/-5/15/45/75`), из-за чего фоновая модель могла выставлять tier вопреки выводу кода.

**Не тронуто:** `parseRelationsTag()` (чтение legacy-тегов), фильтры `scanner.js` (`<!--RELATIONS_ARCHIVE:` и `[RT_EVENT]`), `rules.js`, `tiers.js`, `mechanics.js`.

---

### 2. Перетаскиваемый значок инфоблока (сердечко)

Значок инфоблока теперь можно свободно перемещать по экрану, позиция сохраняется между перезагрузками.

**Что изменилось:**

- `infoblock.js` — добавлен drag-and-drop на кнопку `#rt-infoblock-btn` через Pointer Events (`pointerdown/move/up/cancel`) с `setPointerCapture`.
  - Порог срабатывания 5px, чтобы обычный клик по-прежнему открывал/закрывал панель (флаг `suppressClick`).
  - Позиция ограничивается границами окна (клипинг `left`/`top`).
  - Сохранение в `extension_settings.sillytavern-relations-tracker.infoblockPos` через `saveSettingsDebounced()` и восстановление при инициализации (`applySavedPosition`).
- `infoblock.css` — обёртка `#rt-infoblock` получила фиксированную ширину `40px` (убрана flex-колонка), что исключает «прыжок» кнопки при открытии/закрытии панели.
  - Панель теперь `position: absolute; top: 50px; right: 0` — висит под кнопкой и выравнивается по её правому краю.
  - На кнопке `cursor: grab` / `:active` → `grabbing`, добавлены `touch-action: none` и `user-select: none` для корректного перетаскивания (в т.ч. на тач-устройствах).

---

## 1.0.1

- Исправлены синтаксические ошибки `withTimeout`, кастомные связи, сохранение trust/lust, унификация decay, XSS в `milestones.js`/`history.js` и мелкие проблемы.
