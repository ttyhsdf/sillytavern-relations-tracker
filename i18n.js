/**
 * @file i18n.js
 * @description Localization dictionaries and helper functions for the UI.
 */

const dictionaries = {
    EN: {
        // Settings Panel
        'settings.title': 'Relations Tracker',
        'settings.subtitle': 'Settings',
        'settings.aimode': 'AI MODE',
        'settings.manual': 'Manual',
        'settings.auto': 'Auto',
        'settings.hybrid': 'Hybrid',
        'settings.smartScan': 'Smart Scan',
        'settings.debug': 'Debug',
        'settings.advMechanics': 'Advanced Mechanics',
        'settings.enableDecay': 'Enable Decay',
        'settings.enableDecay.desc': '(Inactive relations slowly drop)',
        'settings.enableAdvStats': 'Advanced Stats',
        'settings.enableAdvStats.desc': '(Track Trust & Lust)',
        'settings.depth': 'Scan Depth',
        'settings.promptLang': 'Prompt Lang',
        'settings.uiLang': 'UI Lang',
        'settings.connProfile': 'Connection Profile',
        'settings.resumeMode': 'Resume Mode',
        'settings.resumeMode.short': 'Short',
        'settings.resumeMode.detailed': 'Detailed',
        'settings.resumeMode.nl': 'Natural Language',
        'settings.systemMsgs': 'System Messages',
        'settings.customBonds': 'Custom Bonds',
        'settings.autoRegex': 'Auto-Install Regex Rules',
        'settings.autoRegex.desc': 'Adds rules to beautifully format and hide system events.',
        'settings.cb.desc': 'Define custom relationship types (e.g., Mentor, Pet) for the AI to track.',
        'settings.cb.tagPlaceholder': '[Tag]',
        'settings.cb.namePlaceholder': 'Name',
        'settings.cb.hintPlaceholder': 'Hint (or leave blank) -> click Generate',
        'settings.cb.generate': 'Generate',
        'settings.cb.noBonds': 'No custom bonds yet.',
        'settings.memoryGallery': 'Memory & Gallery',
        'settings.milestonesGallery': 'MILESTONES GALLERY',
        'settings.noResumeCards': 'AI will generate character cards here...',
        'settings.noMilestones': 'No milestones recorded yet.',
        'settings.hybridSuggestion': 'AI Suggestion',
        'settings.hybridApply': 'Apply',
        'settings.hybridDismiss': 'Dismiss',
        'settings.addBtn': 'Add',
        'settings.scanBtn': 'Scan',
        'settings.graphBtn': 'Graph',
        'settings.exportBtn': 'Export',
        'settings.importBtn': 'Import',
        'settings.addRelationship': 'Add Relationship',
        
        // Cards & Labels
        'card.source': 'Source',
        'card.target': 'Target',
        'card.bond': 'Bond Type',
        'card.tier': 'Tier',
        'card.cp': 'CP',
        'card.trust': 'Trust',
        'card.lust': 'Lust',
        'card.trustAbbr': 'Tr',
        'card.lustAbbr': 'Lu',
        'tier.Frozen': 'Frozen',
        'tier.Cold': 'Cold',
        'tier.Distant': 'Distant',
        'tier.Neutral': 'Neutral',
        'tier.Warm': 'Warm',
        'tier.Close': 'Close',
        'tier.Devoted': 'Devoted',
        'card.label': 'Label',
        'card.noRelations': 'No active relationships.',
        'card.noData': 'No relationship data. Open a chat and click "Add" or "Scan Chat".',
        'card.justMet': 'Just met',
        'card.history': 'History',
        'card.milestones': 'Milestones',
        
        // Infoblock
        'infoblock.title': 'Relationship Status',
        'infoblock.noRelations': 'No active relationships.',
        
        // Graph
        'graph.title': 'Relationship Graph',
        
        // Add Modal
        'modal.add.title': 'Add Relationship',
        'modal.add.source': 'Source',
        'modal.add.target': 'Target',
        'modal.add.scan': 'Find Characters (AI)',
        'modal.add.cancel': 'Cancel',
        'modal.add.confirm': 'Create',
        'modal.add.loading': 'Scanning...',
    },
    RU: {
        // Settings Panel
        'settings.title': 'Трекер Отношений',
        'settings.subtitle': 'Настройки',
        'settings.aimode': 'РЕЖИМ ИИ',
        'settings.manual': 'Ручной',
        'settings.auto': 'Авто',
        'settings.hybrid': 'Гибрид',
        'settings.smartScan': 'Умный скан',
        'settings.debug': 'Отладка',
        'settings.advMechanics': 'Продвинутая механика',
        'settings.enableDecay': 'Включить угасание',
        'settings.enableDecay.desc': '(Медленное угасание отношений без взаимодействий)',
        'settings.enableAdvStats': 'Продвинутые статы',
        'settings.enableAdvStats.desc': '(Учет Доверия и Влечения)',
        'settings.depth': 'Глубина скана',
        'settings.promptLang': 'Язык промпта',
        'settings.uiLang': 'Язык UI',
        'settings.connProfile': 'Профиль API',
        'settings.resumeMode': 'Режим саммари',
        'settings.resumeMode.short': 'Краткий',
        'settings.resumeMode.detailed': 'Детальный',
        'settings.resumeMode.nl': 'Текстовый',
        'settings.systemMsgs': 'Системные сообщения',
        'settings.customBonds': 'Кастомные связи',
        'settings.autoRegex': 'Установить правила Regex',
        'settings.autoRegex.desc': 'Добавляет правила для красивого форматирования системных событий.',
        'settings.cb.desc': 'Создавайте свои типы связей (например: Наставник, Питомец), чтобы ИИ мог их отслеживать.',
        'settings.cb.tagPlaceholder': '[Тег]',
        'settings.cb.namePlaceholder': 'Название',
        'settings.cb.hintPlaceholder': 'Подсказка (или пусто) -> нажать Generate',
        'settings.cb.generate': 'Генерация',
        'settings.cb.noBonds': 'Пока нет кастомных связей.',
        'settings.memoryGallery': 'Память и Галерея',
        'settings.milestonesGallery': 'ГАЛЕРЕЯ СОБЫТИЙ',
        'settings.noResumeCards': 'ИИ сгенерирует карточки персонажей здесь...',
        'settings.noMilestones': 'Пока нет записанных событий.',
        'settings.hybridSuggestion': 'Предложение ИИ',
        'settings.hybridApply': 'Применить',
        'settings.hybridDismiss': 'Отклонить',
        'settings.addBtn': 'Добавить',
        'settings.scanBtn': 'Скан',
        'settings.graphBtn': 'Граф',
        'settings.exportBtn': 'Экспорт',
        'settings.importBtn': 'Импорт',
        'settings.addRelationship': 'Добавить отношения',
        
        // Cards & Labels
        'card.source': 'От кого',
        'card.target': 'Кому',
        'card.bond': 'Тип связи',
        'card.tier': 'Уровень',
        'card.cp': 'ОЖ',
        'card.trust': 'Доверие',
        'card.lust': 'Влечение',
        'card.trustAbbr': 'Дов',
        'card.lustAbbr': 'Влеч',
        'tier.Frozen': 'Заморожено',
        'tier.Cold': 'Холод',
        'tier.Distant': 'Отстраненно',
        'tier.Neutral': 'Нейтрально',
        'tier.Warm': 'Тепло',
        'tier.Close': 'Близко',
        'tier.Devoted': 'Преданность',
        'card.label': 'Статус',
        'card.noRelations': 'Нет активных отношений.',
        'card.noData': 'Нет данных об отношениях. Откройте чат и нажмите "Добавить".',
        'card.justMet': 'Только встретились',
        'card.history': 'История',
        'card.milestones': 'Ключевые события',
        
        // Infoblock
        'infoblock.title': 'Статус Отношений',
        'infoblock.noRelations': 'Нет активных отношений.',
        
        // Graph
        'graph.title': 'Граф Отношений',
        
        // Add Modal
        'modal.add.title': 'Добавить отношения',
        'modal.add.source': 'Кто',
        'modal.add.target': 'К кому',
        'modal.add.scan': 'Найти персонажей (ИИ)',
        'modal.add.cancel': 'Отмена',
        'modal.add.confirm': 'Создать',
        'modal.add.loading': 'Сканирование...',
    },
    UK: {
        // Settings Panel
        'settings.title': 'Трекер Відносин',
        'settings.subtitle': 'Налаштування',
        'settings.aimode': 'РЕЖИМ ШІ',
        'settings.manual': 'Ручний',
        'settings.auto': 'Авто',
        'settings.hybrid': 'Гібрид',
        'settings.smartScan': 'Розумний скан',
        'settings.debug': 'Налагодження',
        'settings.advMechanics': 'Просунута механіка',
        'settings.enableDecay': 'Увімкнути згасання',
        'settings.enableDecay.desc': '(Повільне згасання відносин без взаємодій)',
        'settings.enableAdvStats': 'Просунуті стати',
        'settings.enableAdvStats.desc': '(Врахування Довіри та Потягу)',
        'settings.depth': 'Глибина скану',
        'settings.promptLang': 'Мова промпту',
        'settings.uiLang': 'Мова UI',
        'settings.connProfile': 'Профіль API',
        'settings.resumeMode': 'Режим саммарі',
        'settings.resumeMode.short': 'Стислий',
        'settings.resumeMode.detailed': 'Детальний',
        'settings.resumeMode.nl': 'Текстовий',
        'settings.systemMsgs': 'Системні повідомлення',
        'settings.customBonds': 'Кастомні зв\'язки',
        'settings.autoRegex': 'Встановити правила Regex',
        'settings.autoRegex.desc': 'Додає правила для гарного форматування системних подій.',
        'settings.cb.desc': 'Створюйте власні типи зв\'язків (наприклад: Наставник, Улюбленець), щоб ШІ міг їх відстежувати.',
        'settings.cb.tagPlaceholder': '[Тег]',
        'settings.cb.namePlaceholder': 'Назва',
        'settings.cb.hintPlaceholder': 'Підказка (або порожньо) -> натиснути Generate',
        'settings.cb.generate': 'Генерація',
        'settings.cb.noBonds': 'Поки немає кастомних зв\'язків.',
        'settings.memoryGallery': 'Пам\'ять та Галерея',
        'settings.milestonesGallery': 'ГАЛЕРЕЯ ПОДІЙ',
        'settings.noResumeCards': 'ШІ згенерує картки персонажів тут...',
        'settings.noMilestones': 'Поки немає записаних подій.',
        'settings.hybridSuggestion': 'Пропозиція ШІ',
        'settings.hybridApply': 'Застосувати',
        'settings.hybridDismiss': 'Відхилити',
        'settings.addBtn': 'Додати',
        'settings.scanBtn': 'Скан',
        'settings.graphBtn': 'Граф',
        'settings.exportBtn': 'Експорт',
        'settings.importBtn': 'Імпорт',
        'settings.addRelationship': 'Додати відносини',
        
        // Cards & Labels
        'card.source': 'Від кого',
        'card.target': 'Кому',
        'card.bond': 'Тип зв\'язку',
        'card.tier': 'Рівень',
        'card.cp': 'СЖ',
        'card.trust': 'Довіра',
        'card.lust': 'Потяг',
        'card.trustAbbr': 'Дов',
        'card.lustAbbr': 'Пот',
        'tier.Frozen': 'Заморожено',
        'tier.Cold': 'Холод',
        'tier.Distant': 'Відсторонено',
        'tier.Neutral': 'Нейтрально',
        'tier.Warm': 'Тепло',
        'tier.Close': 'Близько',
        'tier.Devoted': 'Відданість',
        'card.label': 'Статус',
        'card.noRelations': 'Немає активних відносин.',
        'card.noData': 'Немає даних про відносини. Відкрийте чат і натисніть "Додати".',
        'card.justMet': 'Щойно зустрілися',
        'card.history': 'Історія',
        'card.milestones': 'Ключові події',
        
        // Infoblock
        'infoblock.title': 'Статус Відносин',
        'infoblock.noRelations': 'Немає активних відносин.',
        
        // Graph
        'graph.title': 'Граф Відносин',
        
        // Add Modal
        'modal.add.title': 'Додати відносини',
        'modal.add.source': 'Хто',
        'modal.add.target': 'До кого',
        'modal.add.scan': 'Знайти персонажів (ШІ)',
        'modal.add.cancel': 'Скасувати',
        'modal.add.confirm': 'Створити',
        'modal.add.loading': 'Сканування...',
    }
};

let currentLang = 'EN';

/**
 * Sets the current UI language.
 */
export function setUILanguage(lang) {
    if (dictionaries[lang]) {
        currentLang = lang;
    }
}

/**
 * Returns the translated string for a given key.
 */
export function t(key) {
    const dict = dictionaries[currentLang] || dictionaries['EN'];
    return dict[key] || key;
}

/**
 * Scans the DOM and updates all elements with a `data-i18n` attribute.
 */
export function translateDOM(container = document) {
    const elements = container.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        // If element is an input button, set value.
        // If it's a text input, set placeholder.
        // Otherwise set textContent safely.
        if (el.tagName === 'INPUT') {
            if (el.type === 'button') {
                el.value = t(key);
            } else if (el.type === 'text') {
                el.placeholder = t(key);
            }
        } else {
            // For elements that might have icons inside, we need to be careful not to overwrite them.
            // A simple approach is to find the nearest text node, or just use spans.
            // Best practice: structure HTML so the translatable text is wrapped in a span with data-i18n.
            el.textContent = t(key);
        }
    });
}
