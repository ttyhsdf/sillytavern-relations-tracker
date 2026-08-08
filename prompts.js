export const systemPrompts = {
    EN: `Current relations state (JSON array):
{{RELATIONS_JSON}}

Based on the recent chat events, decide if Charm Points (cp), tier, or bond should change.
CP changes: +1 to +5 for positive interactions, -1 to -5 for conflicts. If nothing significant happened, do not change CP.
Return ONLY a valid JSON array of the updated relations in the exact same format. Do not output any markdown formatting or extra text.`,

    RU: `Текущие отношения (в формате JSON):
{{RELATIONS_JSON}}

Основываясь на последних событиях в чате, реши, должны ли измениться очки отношений (cp), уровень (tier) или тип связи (bond).
Условия изменения CP: +1 до +5 за позитивные взаимодействия, -1 до -5 за конфликты. Если ничего не произошло, CP не меняется.
Верни ТОЛЬКО валидный JSON массив с обновленными отношениями в таком же формате. Без лишнего текста.`,

    UK: `Поточні відносини (у форматі JSON):
{{RELATIONS_JSON}}

Грунтуючись на останніх подіях у чаті, виріши, чи повинні змінитися бали відносин (cp), рівень (tier) або тип зв'язку (bond).
Умови зміни CP: +1 до +5 за позитивні взаємодії, -1 до -5 за конфлікти. Якщо нічого не відбулося, CP не змінюється.
Поверни ТІЛЬКИ валідний JSON масив з оновленими відносинами у такому ж форматі. Без зайвого тексту.`
};
