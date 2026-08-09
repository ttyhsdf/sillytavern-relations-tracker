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
        'settings.addRelationship': 'Add Relationship',
        'settings.export': 'Export',
        'settings.import': 'Import',
        
        // Cards & Labels
        'card.source': 'Source',
        'card.target': 'Target',
        'card.bond': 'Bond Type',
        'card.tier': 'Tier',
        'card.cp': 'CP',
        'card.trust': 'Trust',
        'card.lust': 'Lust',
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
        'settings.enableDecay.desc': '(Спад при неактивности)',
        'settings.enableAdvStats': 'Продвинутые статы',
        'settings.enableAdvStats.desc': '(Учет Trust и Lust)',
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
        'settings.addRelationship': 'Добавить отношения',
        'settings.export': 'Экспорт',
        'settings.import': 'Импорт',
        
        // Cards & Labels
        'card.source': 'От кого',
        'card.target': 'Кому',
        'card.bond': 'Тип связи',
        'card.tier': 'Уровень',
        'card.cp': 'CP',
        'card.trust': 'Доверие',
        'card.lust': 'Влечение',
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
        'settings.enableDecay.desc': '(Спад при неактивності)',
        'settings.enableAdvStats': 'Просунуті стати',
        'settings.enableAdvStats.desc': '(Облік Trust та Lust)',
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
        'settings.addRelationship': 'Додати відносини',
        'settings.export': 'Експорт',
        'settings.import': 'Імпорт',
        
        // Cards & Labels
        'card.source': 'Від кого',
        'card.target': 'Кому',
        'card.bond': 'Тип зв\'язку',
        'card.tier': 'Рівень',
        'card.cp': 'CP',
        'card.trust': 'Довіра',
        'card.lust': 'Потяг',
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
        // If element is an input button, set value. Otherwise set textContent/innerHTML safely
        if (el.tagName === 'INPUT' && el.type === 'button') {
            el.value = t(key);
        } else {
            // For elements that might have icons inside, we need to be careful not to overwrite them.
            // A simple approach is to find the nearest text node, or just use spans.
            // Best practice: structure HTML so the translatable text is wrapped in a span with data-i18n.
            el.textContent = t(key);
        }
    });
}
