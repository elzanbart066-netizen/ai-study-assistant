import type { AskResult, CodeLanguage, Language } from "../src/models/index.js";
import { newId, nowIso } from "../server/lib/ids.js";
import { hashPassword } from "../server/lib/security.js";
import type { DataStore } from "../server/repositories/types.js";
import type { HistoryService } from "../server/services/historyService.js";
import { codeFromTemplate } from "../server/services/studyTools/codeTemplates.js";
import { solveLocally } from "../server/services/studyTools/mathSolver.js";

export const DEMO_EMAIL = "demo@study.kz";
export const DEMO_PASSWORD = "demo12345";

const EQUATIONS = [
  "2x + 5 = 13",
  "3x - 7 = 2x + 4",
  "x^2 - 5x + 6 = 0",
  "2x^2 + 3x - 2 = 0",
  "(12 + 8) * 3 - 15 / 5",
  "5(x - 2) = 3x + 6",
  "x^2 + 4x + 4 = 0",
  "A and B -> A",
  "(A or B) and not A",
  "2^10 - 24",
  "x/4 + 3 = 7",
  "A xor B",
];

const CODE_TASKS: [string, CodeLanguage][] = [
  ["Factorial of n", "python"],
  ["Fibonacci numbers", "javascript"],
  ["Check if a number is prime", "java"],
  ["Sort an array", "cpp"],
  ["Reverse a string and check palindrome", "csharp"],
  ["Sum and average of numbers", "python"],
  ["Факториал числа", "java"],
  ["Сұрыптау алгоритмі", "python"],
  ["Фибоначчи сандары", "cpp"],
  ["Простое число", "csharp"],
];

// Short explanations written for the demo; they cite no sources on purpose.
const ASK: [string, Language, string, string][] = [
  ["Фотосинтез дегеніміз не?", "kk", "Фотосинтез — өсімдіктердің жарық энергиясы арқылы көмірқышқыл газы мен судан глюкоза мен оттегі түзуі.", "Процесс хлоропластарда өтеді: жарық фазасында су ыдырап, оттегі бөлінеді; қараңғы фазада СО₂ глюкозаға айналады."],
  ["Ньютонның екінші заңы", "kk", "Дененің үдеуі оған әсер ететін күшке тура, массасына кері пропорционал: F = m·a.", "Мысалы, 2 кг денеге 10 Н күш әсер етсе, үдеу 5 м/с² болады."],
  ["Что такое дробь?", "ru", "Дробь — число, которое показывает часть целого: числитель делится на знаменатель.", "В дроби 3/4 целое разделено на 4 части, и взято 3 из них."],
  ["Как работает цикл for?", "ru", "Цикл for повторяет блок кода заданное число раз или для каждого элемента коллекции.", "В Python `for i in range(3)` выполнит тело для i = 0, 1, 2."],
  ["What is a variable in programming?", "en", "A variable is a named place in memory that stores a value which can change while the program runs.", "In `age = 17`, the name age refers to the value 17; later `age = 18` replaces it."],
  ["Explain the Pythagorean theorem", "en", "In a right triangle, the square of the hypotenuse equals the sum of the squares of the other two sides: a² + b² = c².", "With legs 3 and 4, the hypotenuse is √(9 + 16) = 5."],
  ["Абай Құнанбайұлы кім?", "kk", "Абай Құнанбайұлы (1845–1904) — қазақ ақыны, ағартушы, жазба әдебиетінің негізін салушылардың бірі.", "Ол «Қара сөздер» шығармасымен және орыс, шығыс әдебиетін аударуымен белгілі."],
  ["Что такое ДНК?", "ru", "ДНК — молекула, которая хранит наследственную информацию живых организмов.", "Она состоит из двух цепочек нуклеотидов (A, T, G, C), закрученных в двойную спираль."],
];

/** Fills a store with a demo student and ~30 history records for the prototype. */
export async function seedDemo(
  store: DataStore,
  history: HistoryService,
  email = DEMO_EMAIL,
  name = "Демо Студент",
): Promise<string> {
  const existing = await store.findUserByEmail(email);
  if (existing) return existing.id;
  const userId = newId();
  await store.createUser(
    { id: userId, name, email, passwordHash: await hashPassword(DEMO_PASSWORD), role: "student", createdAt: nowIso() },
    { userId, language: "kk", saveHistory: true },
  );
  const langs: Language[] = ["kk", "ru", "en"];
  for (const [i, eq] of EQUATIONS.entries()) {
    const lang = langs[i % 3];
    const result = solveLocally(eq, lang);
    if (result) await history.record({ userId, type: "solve", prompt: eq, answer: result, language: lang });
  }
  for (const [i, [task, codeLanguage]] of CODE_TASKS.entries()) {
    const lang = langs[i % 3];
    const result = codeFromTemplate(task, codeLanguage, lang);
    if (result) await history.record({ userId, type: "code", prompt: task, answer: result, language: lang });
  }
  for (const [prompt, lang, summary, explanation] of ASK) {
    const result: AskResult = {
      summary,
      explanation,
      example: "",
      sources: [],
      uncertainty: "",
      usedWebSearch: false,
      provider: "offline",
    };
    const saved = await history.record({ userId, type: "ask", prompt, answer: result, language: lang });
    if (saved && prompt.startsWith("Ньютон")) await history.setSaved(userId, saved.messageId, true);
  }
  return userId;
}
