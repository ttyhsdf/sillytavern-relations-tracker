export const VALID_TIERS = ['Frozen', 'Cold', 'Distant', 'Neutral', 'Warm', 'Close', 'Devoted'];
export const VALID_BONDS = ['[R]', '[P]', '[F]', '[H]'];

export const systemPrompts = {
    EN: `Current relations state (JSON array):
{{RELATIONS_JSON}}

Based on the recent chat events, decide if any values should change.

Rules:
- "cp": integer from -100 to 100. Change by +1 to +5 for positive interactions, -1 to -5 for conflicts. If nothing significant happened, keep the same value.
- "tier": MUST be exactly one of: ${VALID_TIERS.join(', ')}
- "bond": MUST be exactly one of: ${VALID_BONDS.join(', ')} where [R]=Romantic, [P]=Platonic, [F]=Family, [H]=Hostile
- "label": a short phrase (2-4 words) describing the current emotional state between the characters (e.g. "Growing closer", "Bitter rivals", "Awkward tension")

Return ONLY a valid JSON array of the updated relations in the exact same format. No markdown, no explanation.`,

    RU: `Текущие отношения (в формате JSON):
{{RELATIONS_JSON}}

Основываясь на последних событиях в чате, реши, должны ли измениться значения.

Правила:
- "cp": целое число от -100 до 100. Меняй на +1 до +5 за позитивные взаимодействия, -1 до -5 за конфликты. Если ничего значимого не произошло, оставь прежнее значение.
- "tier": СТРОГО одно из: ${VALID_TIERS.join(', ')}
- "bond": СТРОГО одно из: ${VALID_BONDS.join(', ')} где [R]=Романтика, [P]=Дружба, [F]=Семья, [H]=Вражда
- "label": короткая фраза (2-4 слова) описывающая текущее эмоциональное состояние между персонажами (напр. "Сближаются", "Заклятые враги", "Неловкое напряжение")

Верни ТОЛЬКО валидный JSON массив с обновленными отношениями в таком же формате. Без markdown, без пояснений.`,

    UK: `Поточні відносини (у форматі JSON):
{{RELATIONS_JSON}}

Грунтуючись на останніх подіях у чаті, виріши, чи повинні змінитися значення.

Правила:
- "cp": ціле число від -100 до 100. Змінюй на +1 до +5 за позитивні взаємодії, -1 до -5 за конфлікти. Якщо нічого значущого не відбулося, залиш попереднє значення.
- "tier": СТРОГО одне з: ${VALID_TIERS.join(', ')}
- "bond": СТРОГО одне з: ${VALID_BONDS.join(', ')} де [R]=Романтика, [P]=Дружба, [F]=Сім'я, [H]=Ворожнеча
- "label": коротка фраза (2-4 слова) що описує поточний емоційний стан між персонажами (напр. "Зближуються", "Заклятi вороги", "Незручна напруга")

Поверни ТІЛЬКИ валідний JSON масив з оновленими відносинами у такому ж форматі. Без markdown, без пояснень.`
};
