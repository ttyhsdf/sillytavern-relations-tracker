export const VALID_BONDS = ['[R]', '[PL]', '[P]', '[F]', '[H]', '[C]'];

const sharedInstructions = `Based on the recent chat events, decide if any relationship values should change, or if NEW relationships should be tracked.

**IMPORTANT: MULTI-CHARACTER TRACKING**
If you detect a significant relationship or interaction between ANY two characters in the chat (e.g., Character A and Character B, or User and Character C) that is NOT currently in the JSON array, you MUST add a new relationship object for them to the array.

Rules:
- "cp": integer from -100 to 100. Change by +1 to +5 for positive interactions, -1 to -5 for conflicts. 
  - Family [F] bonds CANNOT exceed 70 CP.
- "bond": MUST be exactly one of: 
  [R]=Romantic (No Family), [PL]=Platonic Love (Deep non-romantic bond/Found family), [P]=Platonic (Friendship), [F]=Family, [H]=Hostile, [C]=Complicated.
- "label": a short phrase (2-4 words) describing their current emotional state (e.g. "Growing closer", "Bitter rivals").
- "source" and "target": The names of the two characters.

Return ONLY a valid JSON array of the updated/new relations in the exact same format. No markdown, no explanation.`;

export const systemPrompts = {
    EN: `Current relations state (JSON array):
{{RELATIONS_JSON}}

${sharedInstructions}`,

    RU: `Текущие отношения (в формате JSON):
{{RELATIONS_JSON}}

Основываясь на последних событиях в чате, реши, должны ли измениться значения или нужно ли добавить НОВЫЕ отношения.

**ВАЖНО: ОТСЛЕЖИВАНИЕ НЕСКОЛЬКИХ ПЕРСОНАЖЕЙ**
Если ты заметил значимое взаимодействие между ЛЮБЫМИ двумя персонажами в чате (например, Персонаж А и Персонаж Б, или Пользователь и Персонаж В), которых еще нет в JSON массиве, ты ДОЛЖЕН добавить для них новый объект отношений в массив.

Правила:
- "cp": целое число от -100 до 100. Меняй на +1 до +5 за позитивные взаимодействия, -1 до -5 за конфликты.
  - Семейные узы [F] НЕ МОГУТ превышать 70 CP.
- "bond": СТРОГО одно из: 
  [R]=Романтика (Семье нельзя), [PL]=Платоническая Любовь (Глубокая связь), [P]=Дружба, [F]=Семья, [H]=Вражда, [C]=Сложные (Complicated).
- "label": короткая фраза (2-4 слова) описывающая текущее состояние (напр. "Сближаются", "Заклятые враги").
- "source" и "target": Имена двух персонажей.

Верни ТОЛЬКО валидный JSON массив. Без markdown, без пояснений.`,

    UK: `Поточні відносини (у форматі JSON):
{{RELATIONS_JSON}}

Грунтуючись на останніх подіях у чаті, виріши, чи повинні змінитися значення або чи потрібно додати НОВІ відносини.

**ВАЖЛИВО: ВІДСТЕЖЕННЯ ДЕКІЛЬКОХ ПЕРСОНАЖІВ**
Якщо ти помітив значущу взаємодію між БУДЬ-ЯКИМИ двома персонажами в чаті (наприклад, Персонаж А і Персонаж Б, або Користувач і Персонаж В), яких ще немає в JSON масиві, ти ПОВИНЕН додати для них новий об'єкт відносин в масив.

Правила:
- "cp": ціле число від -100 до 100. Змінюй на +1 до +5 за позитивні взаємодії, -1 до -5 за конфлікти.
  - Родинні зв'язки [F] НЕ МОЖУТЬ перевищувати 70 CP.
- "bond": СТРОГО одне з: 
  [R]=Романтика (Сім'ї не можна), [PL]=Платонічна Любов (Глибокий зв'язок), [P]=Дружба, [F]=Сім'я, [H]=Ворожнеча, [C]=Складні (Complicated).
- "label": коротка фраза (2-4 слова) що описує поточний стан (напр. "Зближуються", "Закляті вороги").
- "source" і "target": Імена двох персонажів.

Поверни ТІЛЬКИ валідний JSON масив. Без markdown, без пояснень.`
};
