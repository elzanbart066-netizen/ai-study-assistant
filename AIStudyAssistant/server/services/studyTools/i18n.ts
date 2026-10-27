import type { Language } from "../../../src/models/index.js";

// Server-side phrases for generated explanations, in Kazakh, Russian and English.
const PHRASES = {
  given: { kk: "Берілгені", ru: "Дано", en: "Given" },
  methodArithmetic: {
    kk: "Амалдардың орындалу ретімен есептеу (жақша → дәреже → көбейту/бөлу → қосу/азайту).",
    ru: "Вычисление по порядку действий (скобки → степень → умножение/деление → сложение/вычитание).",
    en: "Evaluate by order of operations (parentheses → powers → multiply/divide → add/subtract).",
  },
  methodLinear: {
    kk: "Сызықтық теңдеу: белгісізі бар мүшелерді бір жаққа, сандарды екінші жаққа шығарамыз.",
    ru: "Линейное уравнение: переносим члены с неизвестным в одну сторону, числа — в другую.",
    en: "Linear equation: move the unknown terms to one side and the numbers to the other.",
  },
  methodQuadratic: {
    kk: "Квадрат теңдеу: ax² + bx + c = 0 түріне келтіріп, дискриминант D = b² − 4ac табамыз.",
    ru: "Квадратное уравнение: приводим к виду ax² + bx + c = 0 и находим дискриминант D = b² − 4ac.",
    en: "Quadratic equation: bring it to ax² + bx + c = 0 and compute the discriminant D = b² − 4ac.",
  },
  methodNumeric: {
    kk: "Теңдеу көпмүше емес, сондықтан түбірлер сандық әдіспен (бисекция) [−100; 100] аралығында ізделді.",
    ru: "Уравнение не многочлен, поэтому корни найдены численно (бисекция) на отрезке [−100; 100].",
    en: "The equation is not a polynomial, so roots were found numerically (bisection) on [−100, 100].",
  },
  methodLogic: {
    kk: "Логикалық өрнек ақиқаттық кестесі арқылы тексеріледі: айнымалылардың барлық мәндері қарастырылады.",
    ru: "Логическое выражение проверяется таблицей истинности: перебираются все значения переменных.",
    en: "The logical expression is checked with a truth table covering every combination of values.",
  },
  moveTerms: { kk: "Мүшелерді топтастырамыз", ru: "Группируем члены", en: "Group the terms" },
  divide: { kk: "Екі жағын {a} санына бөлеміз", ru: "Делим обе части на {a}", en: "Divide both sides by {a}" },
  standardForm: { kk: "Стандарт түрі", ru: "Стандартный вид", en: "Standard form" },
  discriminant: { kk: "Дискриминант", ru: "Дискриминант", en: "Discriminant" },
  roots: { kk: "Түбірлер формуласы", ru: "Формула корней", en: "Root formula" },
  noRealRoots: {
    kk: "D < 0, сондықтан нақты түбірлер жоқ.",
    ru: "D < 0, поэтому действительных корней нет.",
    en: "D < 0, so there are no real roots.",
  },
  noSolution: { kk: "Шешімі жоқ", ru: "Решений нет", en: "No solution" },
  anySolution: { kk: "Кез келген сан шешім болады", ru: "Любое число является решением", en: "Every number is a solution" },
  checkOk: { kk: "дұрыс ✓", ru: "верно ✓", en: "correct ✓" },
  checkInverse: { kk: "Кері амалмен тексеру", ru: "Проверка обратным действием", en: "Check with the inverse operation" },
  variables: { kk: "Айнымалылар", ru: "Переменные", en: "Variables" },
  rows: { kk: "Кесте жолдары: 2^{n} = {rows}", ru: "Строк в таблице: 2^{n} = {rows}", en: "Table rows: 2^{n} = {rows}" },
  trueRows: { kk: "Ақиқат жолдар саны: {k} / {rows}", ru: "Истинных строк: {k} из {rows}", en: "True rows: {k} of {rows}" },
  tautology: { kk: "Тавтология (әрқашан ақиқат)", ru: "Тавтология (всегда истинно)", en: "Tautology (always true)" },
  contradiction: { kk: "Қайшылық (әрқашан жалған)", ru: "Противоречие (всегда ложно)", en: "Contradiction (always false)" },
  satisfiable: {
    kk: "Орындалатын өрнек: ақиқат болатын жағдайлары бар",
    ru: "Выполнимое выражение: есть наборы, где оно истинно",
    en: "Satisfiable: true for some assignments",
  },
  logicCheck: {
    kk: "Әр жол өрнекке мәндерді қойып қайта есептелді.",
    ru: "Каждая строка пересчитана подстановкой значений.",
    en: "Every row was recomputed by substituting the values.",
  },
  numericFound: { kk: "Табылған түбірлер", ru: "Найденные корни", en: "Roots found" },
} as const;

export type PhraseKey = keyof typeof PHRASES;

export function phrase(lang: Language, key: PhraseKey, vars: Record<string, string | number> = {}): string {
  let text: string = PHRASES[key][lang];
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}
