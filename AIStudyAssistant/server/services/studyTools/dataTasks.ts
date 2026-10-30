import type { CodeLanguage, CodeResult, Language } from "../../../src/models/index.js";

// Exact code for list tasks on the student's own data ("Али, Елжан, Думан...:
// take the first letters, put them in an array, sort it"). The data is written
// into the program as given, the steps run in the order asked, and the sample
// output is computed here, so the answer is always right. Tasks this cannot
// cover fully are left to the AI.

type Item = string | number;
type Step =
  | { kind: "first" | "last" | "length" }
  | { kind: "sort"; desc: boolean }
  | { kind: "reverse" | "unique" }
  | { kind: "filter"; keep: "even" | "odd" | "positive" | "negative" }
  | { kind: "aggregate"; op: "sum" | "average" | "max" | "min" | "count" };

export interface DataTask {
  data: Item[];
  steps: Step[];
  /** Set when the task asks to type the data in: the program reads it, `data` is a sample. */
  input?: { count: number | null };
}

// Kazakh typed on a Russian keyboard is common, so text is compared with Kazakh letters folded.
const FOLD: Record<string, string> = { қ: "к", ғ: "г", ң: "н", ү: "у", ұ: "у", ө: "о", ә: "а", і: "и", һ: "х", ё: "е" };
const foldLetters = (text: string) => text.replace(/[қғңүұөәіһё]/gu, (c) => FOLD[c]);
const fold = (text: string) => foldLetters(text.toLowerCase());

// Each step with the phrases (folded) that ask for it; the position in the text sets the order.
const STEP_PHRASES_RAW: [RegExp, Step][] = [
  [/(бас|бірінші|алғашқы|first|перв\p{L}*) (әріп|letter|букв)\p{L}*|initials?|инициал\p{L}*/gu, { kind: "first" }],
  [/(соңғы|ақырғы|last|последн\p{L}*) (әріп|letter|букв)\p{L}*/gu, { kind: "last" }],
  [/(ұзындығ|length|длин)\p{L}*|әріп сан\p{L}*/gu, { kind: "length" }],
  [/(кему|кемімелі|descending|по убыв\p{L}*|убыва\p{L}*)( ретімен| order| порядк\p{L}*)?( (сұрыпта|сортта|сортир|sort|ретте)\p{L}*)?/gu, { kind: "sort", desc: true }],
  [/(сұрыпта|сортта|сортир|отсортир|sort|ретте|упорядоч)\p{L}*|(әліппе|алфавит|alphabet|өсу|ascending|возраст)\p{L}* (ретімен|order|порядк\p{L}*)|(әліппе|алфавит)\p{L}* (бойынша|бойынш\p{L}*)|по алфавиту|alphabetical\p{L}*/gu, { kind: "sort", desc: false }],
  [/кері (ретпен|қарай)|reverse\p{L}*|перевер\p{L}*|разверн\p{L}*/gu, { kind: "reverse" }],
  [/(қайталанбайтын|unique|уникальн\p{L}*|без повтор\p{L}*|повтор\p{L}*|дубликат\p{L}*|duplicates?)/gu, { kind: "unique" }],
  [/(?<!\p{L})(жұп|even|ч[её]тн\p{L}*)( сан\p{L}*| числ\p{L}*| numbers?)?/gu, { kind: "filter", keep: "even" }],
  [/(?<!\p{L})(тақ|odd|неч[её]тн\p{L}*)( сан\p{L}*| числ\p{L}*| numbers?)?/gu, { kind: "filter", keep: "odd" }],
  [/(?<!\p{L})(оң|positive|положительн\p{L}*)( сан\p{L}*| числ\p{L}*| numbers?)?/gu, { kind: "filter", keep: "positive" }],
  [/(?<!\p{L})(теріс|negative|отрицательн\p{L}*)( сан\p{L}*| числ\p{L}*| numbers?)?/gu, { kind: "filter", keep: "negative" }],
  [/(қосынды|sum|сумм)\p{L}*/gu, { kind: "aggregate", op: "sum" }],
  [/(орташа|average|mean|средн)\p{L}*( мән\p{L}*| знач\p{L}*)?/gu, { kind: "aggregate", op: "average" }],
  [/(ең үлкен|max\p{L}*|largest|biggest|наибольш\p{L}*|максим\p{L}*)\p{L}*/gu, { kind: "aggregate", op: "max" }],
  [/(ең кіші|min\p{L}*|smallest|наименьш\p{L}*|миним\p{L}*)\p{L}*/gu, { kind: "aggregate", op: "min" }],
  [/(?<!\p{L})(саны|санын|count|how many|количеств\p{L}*|сколько)(?!\p{L})/gu, { kind: "aggregate", op: "count" }],
];
// Patterns are written in Kazakh and compared in folded form, like the text.
const STEP_PHRASES: [RegExp, Step][] = STEP_PHRASES_RAW.map(([re, step]) => [new RegExp(foldLetters(re.source), re.flags), step]);

// Words that only frame the task (folded). Anything else left over means the task asks
// for more than these steps, and the AI should write it instead.
const FILLER = new Set(
  fold(`беріл деген атты аттар есім сөздер сөз сандар сан тізім массив олар осылар осы мына бұл және мен да де қолдан пайдалан орында ала алып отырып
сал шығар бер жаз жаса код программа бағдарлама әр әрбір барлық элемент әліппе әріп ретімен ретпен түрінде жаңа нәтиже экран қарай
тап табу тауып есепте есептеп қалдыр қалдырып ішінен арасынан ішіндегі және
дано даны данные имена слова числа числ список массив используя используй возьми положи сложи сделай напиши выведи
программ код их эти из в и на по с каждого каждое все новый результат найди найти посчитай вычисли оставь удали отсортируй
given names words numbers list array use using take put into the a an and of in each every them these write print program code new result
find compute calculate keep remove show get then from only word
адам оқушы студент атын есімін бойынша енгіз ендір пернетақта клавиатура арқылы баға балл ұпай
введи введите ввод вводит человек людей студент ученик клавиатур с оцен балл enter input read type people person student user keyboard grades scores marks`).split(/\s+/),
);

const NAME_HINT = /(^|\s)(ат|есім|name|им[яеё]н|имена)/u;
const MARKER = /^(берилген|берилгени|деген|атты|аттар\p{L}*|есимдер\p{L}*|создер\p{L}*|сандар\p{L}*|given|names|words|numbers|даны|дано|данные|имена|слова|числа)$/u;

/** Finds the data and the steps of a list task, or null when the task is not one. */
export function parseDataTask(prompt: string): DataTask | null {
  const text = fold(prompt);
  const typed = INPUT_WORD.test(text) ? typedData(prompt, text) : null;
  const data = typed ?? extractData(prompt);
  if (!data || data.items.length < 2) return null;

  const found: { at: number; end: number; step: Step }[] = [];
  for (const [re, step] of STEP_PHRASES) {
    for (const m of text.matchAll(re)) {
      const at = m.index ?? 0;
      if (found.some((f) => at < f.end && f.at < at + m[0].length)) continue;
      found.push({ at, end: at + m[0].length, step });
    }
  }
  if (found.length === 0) return null;
  found.sort((a, b) => a.at - b.at);
  // "sort descending" / "сорттап кему ретімен": one sort, in the stated direction.
  for (let i = found.length - 1; i > 0; i--) {
    const [a, b] = [found[i - 1], found[i]];
    if (a.step.kind === "sort" && b.step.kind === "sort" && b.at - a.end <= 3) found.splice(b.step.desc ? i - 1 : i, 1);
  }
  const steps: Step[] = [];
  for (const { step } of found) {
    if (steps.some((s) => JSON.stringify(s) === JSON.stringify(step))) continue;
    steps.push(step);
  }

  // Everything else must be filler: data, step phrases and framing words only.
  let rest = text;
  for (const { at, end } of [...found].sort((a, b) => b.at - a.at)) rest = rest.slice(0, at) + " " + rest.slice(end);
  // Kazakh adds endings to words ("сандарының"), so a filler word also covers its longer forms.
  const isFiller = (w: string) => FILLER.has(w) || [...FILLER].some((f) => f.length >= 3 && w.startsWith(f));
  const leftover = (rest.match(/[\p{L}]+/gu) ?? []).filter((w) => w.length > 2 && !isFiller(w) && !data.tokens.has(w));
  if (leftover.length > 1) return null;

  const numeric = typeof data.items[0] === "number";
  // Steps must fit the data: letters need words, number filters need numbers.
  if (steps.some((s) => (s.kind === "first" || s.kind === "last" || s.kind === "length") && numeric)) return null;
  if (steps.some((s) => s.kind === "filter") && !numeric) return null;
  if (steps.filter((s) => s.kind === "aggregate").length > 1) return null;
  const aggregateAt = steps.findIndex((s) => s.kind === "aggregate");
  if (aggregateAt >= 0 && aggregateAt !== steps.length - 1) return null;

  // Names typed in lower case are written with a capital, as names are.
  const items = !numeric && NAME_HINT.test(text)
    ? data.items.map((w) => capitalize(String(w)))
    : data.items;
  return { data: items, steps, ...(typed ? { input: typed.input } : {}) };
}

// "5 адам атын енгізіп ...": the program reads the data, so a sample stands in for it here.
const INPUT_WORD = /енгиз|ендир|пернетакта|введ|ввод|клавиатур|(?<!\p{L})(input|enter|type in|read)(?!\p{L})/u;
const SAMPLE_NAMES = ["Саят", "Али", "Нуржан", "Елжан", "Думан", "Айгерим", "Бекзат", "Дана", "Ерлан", "Мадина", "Асель", "Тимур"];
const SAMPLE_NAMES_LATIN = ["Sam", "Ann", "Tom", "Eve", "Bob", "Kate", "Max", "Lily", "Dan", "Mia", "Leo", "Zoe"];
const SAMPLE_WORDS_LATIN = ["school", "book", "pen", "desk", "map", "ruler", "bag", "board", "chalk", "globe", "paper", "table"];
const SAMPLE_WORDS = ["мектеп", "кітап", "дәптер", "қалам", "сызғыш", "сөмке", "парта", "тақта", "бор", "глобус", "сурет", "кесте"];

function typedData(prompt: string, text: string): { items: Item[]; tokens: Set<string>; input: { count: number | null } } | null {
  const numbers = prompt.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
  if (numbers.length > 1) return null;
  const count = numbers.length ? Number(numbers[0]) : null;
  const numeric = /(?<!\p{L})(сан|бага|балл|упай|number|grade|score|mark|числ|чисел|оцен)\p{L}*/u.test(text) && !/(?<!\p{L})(ат|есим|соз|name|word|им[яеё]н|имена|слов)\p{L}*/u.test(text);
  const latin = !/\p{Script=Cyrillic}/u.test(prompt);
  const words = /(?<!\p{L})(ат|есим|name|им[яеё]н|имена)\p{L}*/u.test(text)
    ? latin ? SAMPLE_NAMES_LATIN : SAMPLE_NAMES
    : /(?<!\p{L})(соз|word|слов)\p{L}*/u.test(text) ? latin ? SAMPLE_WORDS_LATIN : SAMPLE_WORDS : null;
  if (!numeric && !words) return null;
  if (count !== null && (!Number.isInteger(count) || count < 2 || count > 12)) return null;
  const n = count ?? 5;
  const items: Item[] = numeric ? [7, 3, 12, 5, 9, 4, 10, 1, 8, 6, 2, 11].slice(0, n) : words!.slice(0, n);
  return { items, tokens: new Set(), input: { count } };
}

function capitalize(word: string) {
  return word.charAt(0).toLocaleUpperCase() + word.slice(1);
}

/** The student's data: numbers, a comma/colon list, or the words before "берілген"/"given". */
function extractData(prompt: string): { items: Item[]; tokens: Set<string> } | null {
  const numbers = prompt.match(/-?\d+(?:[.,]\d+)?/g);
  if (numbers && numbers.length >= 2) {
    const items = numbers.map((n) => Number(n.replace(",", ".")));
    return { items, tokens: new Set() };
  }
  const words = prompt.match(/[\p{L}]+(?:-[\p{L}]+)?/gu) ?? [];
  const folded = words.map(fold);
  // A comma list: "аттар: Али, Елжан, Думан" or "apple, banana and kiwi".
  const listed = /[\p{L}-]+(?:\s*[,;]\s*[\p{L}-]+)+(?:\s+(?:және|мен|and|и)\s+[\p{L}-]+)?/u.exec(prompt)?.[0];
  if (listed) {
    const items = listed.split(/\s*[,;]\s*|\s+(?:және|мен|and|и)\s+/u).filter(Boolean);
    if (items.length >= 2) return { items, tokens: new Set(items.map(fold)) };
  }
  // Words just before a marker: "али елжан думан нуржан саят берілген аттарды...".
  const marker = folded.findIndex((w) => MARKER.test(w));
  if (marker >= 2) {
    let start = marker;
    while (start > 0 && !FILLER.has(folded[start - 1]) && words[start - 1].length >= 2) start--;
    const items = words.slice(start, marker);
    if (items.length >= 2) return { items, tokens: new Set(items.map(fold)) };
  }
  return null;
}

/** Runs the steps here, to show the program's exact output. */
export function runDataTask({ data, steps }: DataTask): Item[] | number | string {
  let list: Item[] = [...data];
  for (const step of steps) {
    switch (step.kind) {
      case "first":
        list = list.map((w) => [...String(w)][0] ?? "");
        break;
      case "last":
        list = list.map((w) => [...String(w)].at(-1) ?? "");
        break;
      case "length":
        list = list.map((w) => [...String(w)].length);
        break;
      case "sort":
        list = [...list].sort((a, b) => compare(a, b) * (step.desc ? -1 : 1));
        break;
      case "reverse":
        list = [...list].reverse();
        break;
      case "unique":
        list = list.filter((v, i) => list.indexOf(v) === i);
        break;
      case "filter":
        list = list.filter((v) => keep(Number(v), step.keep));
        break;
      case "aggregate":
        return aggregate(list, step.op);
    }
  }
  return list;
}

function compare(a: Item, b: Item) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  // Ordinal (code point) order, the same in every language's default string sort.
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function keep(n: number, rule: "even" | "odd" | "positive" | "negative") {
  if (rule === "even") return Number.isInteger(n) && n % 2 === 0;
  if (rule === "odd") return Number.isInteger(n) && Math.abs(n % 2) === 1;
  return rule === "positive" ? n > 0 : n < 0;
}

function aggregate(list: Item[], op: "sum" | "average" | "max" | "min" | "count"): number | string {
  if (op === "count") return list.length;
  if (list.length === 0) return op === "sum" ? 0 : "-";
  if (op === "max" || op === "min") return [...list].sort(compare)[op === "max" ? list.length - 1 : 0];
  const sum = list.reduce<number>((s, v) => s + Number(v), 0);
  return op === "sum" ? sum : (sum / list.length).toFixed(2);
}

function formatOutput(result: Item[] | number | string): string {
  if (Array.isArray(result)) return result.map(String).join(", ");
  return String(result);
}

/** The program for the task, or null when it is not a list task this can cover. */
export function codeFromData(prompt: string, language: CodeLanguage, lang: Language): CodeResult | null {
  const task = parseDataTask(prompt);
  if (!task) return null;
  const numeric = typeof task.data[0] === "number";
  const decimals = numeric && task.data.some((n) => !Number.isInteger(n));
  return {
    language,
    code: GENERATORS[language](task, numeric, decimals),
    explanation: explain(task, lang),
    sampleInput: task.input ? [...(task.input.count === null ? [String(task.data.length)] : []), ...task.data.map(String)].join("\n") : "-",
    sampleOutput: formatOutput(runDataTask(task)),
    provider: "offline",
  };
}

const KEEP_TEXT = {
  kk: { even: "жұп сандар", odd: "тақ сандар", positive: "оң сандар", negative: "теріс сандар" },
  ru: { even: "чётные числа", odd: "нечётные числа", positive: "положительные числа", negative: "отрицательные числа" },
  en: { even: "even numbers", odd: "odd numbers", positive: "positive numbers", negative: "negative numbers" },
};
const AGGREGATE_TEXT = {
  kk: { sum: "қосындысы", average: "орташа мәні", max: "ең үлкені", min: "ең кішісі", count: "саны" },
  ru: { sum: "сумма", average: "среднее", max: "максимум", min: "минимум", count: "количество" },
  en: { sum: "sum", average: "average", max: "largest item", min: "smallest item", count: "count" },
};
const STEP_WORDS = {
  kk: {
    first: "әр сөздің бірінші әрпі алынады",
    last: "әр сөздің соңғы әрпі алынады",
    length: "әр сөздің ұзындығы есептеледі",
    asc: "өсу (әліппе) ретімен сұрыпталады",
    desc: "кему ретімен сұрыпталады",
    reverse: "реті керісінше айналдырылады",
    unique: "қайталанатындары алынып тасталады",
    keep: (x: string) => `${x} қалдырылады`,
    aggregate: (x: string) => `${x} есептеледі`,
  },
  ru: {
    first: "берётся первая буква каждого слова",
    last: "берётся последняя буква каждого слова",
    length: "считается длина каждого слова",
    asc: "сортируется по возрастанию (по алфавиту)",
    desc: "сортируется по убыванию",
    reverse: "порядок разворачивается",
    unique: "удаляются повторы",
    keep: (x: string) => `остаются ${x}`,
    aggregate: (x: string) => `считается ${x}`,
  },
  en: {
    first: "the first letter of each word is taken",
    last: "the last letter of each word is taken",
    length: "the length of each word is counted",
    asc: "the list is sorted in ascending (alphabetical) order",
    desc: "the list is sorted in descending order",
    reverse: "the order is reversed",
    unique: "repeated items are removed",
    keep: (x: string) => `only ${x} are kept`,
    aggregate: (x: string) => `the ${x} is computed`,
  },
};

function stepText(s: Step, lang: Language): string {
  const w = STEP_WORDS[lang];
  switch (s.kind) {
    case "sort":
      return s.desc ? w.desc : w.asc;
    case "filter":
      return w.keep(KEEP_TEXT[lang][s.keep]);
    case "aggregate":
      return w.aggregate(AGGREGATE_TEXT[lang][s.op]);
    default:
      return w[s.kind];
  }
}

function explain(task: DataTask, lang: Language): string {
  const intro = task.input
    ? { kk: "Бағдарлама деректерді пернетақтадан оқиды (әр жолға біреуден), мысалы", ru: "Программа читает данные с клавиатуры (по одному в строке), например", en: "The program reads the data from the keyboard (one per line), for example" }[lang]
    : { kk: "Берілген деректер бағдарламаға тікелей жазылды", ru: "Данные из задания записаны прямо в программу", en: "The data from the task is written straight into the program" }[lang];
  const order = { kk: "Содан кейін", ru: "Затем", en: "Then" }[lang];
  const note = {
    kk: "Сұрыптау таңбалардың Unicode реті бойынша жүреді (қазақтың өзіне тән әріптері ә, ғ, қ т.б. әліппеден өзгеше орында тұруы мүмкін).",
    ru: "Сортировка идёт по порядку символов Unicode (особые казахские буквы ә, ғ, қ и др. могут стоять не на своём месте в алфавите).",
    en: "Sorting uses Unicode code point order (special Kazakh letters such as ә, ғ, қ may not follow the Kazakh alphabet).",
  }[lang];
  const steps = task.steps.map((s) => stepText(s, lang)).join("; ");
  const sorts = task.steps.some((s) => s.kind === "sort") && typeof task.data[0] === "string";
  return `${intro}: ${task.data.join(", ")}. ${order}: ${steps}.${sorts ? ` ${note}` : ""}`;
}

// ---- code for each language --------------------------------------------------------------

type Generator = (task: DataTask, numeric: boolean, decimals: boolean) => string;

const quote = (s: string) => JSON.stringify(s);
const literal = (task: DataTask, numeric: boolean, decimals: boolean) =>
  task.data.map((v) => (numeric ? (decimals ? String(v).includes(".") ? String(v) : `${v}.0` : String(v)) : quote(String(v)))).join(", ");

/** The lines that create `items`: the task's data, or reading it when the task asks to type it in. */
function source(language: CodeLanguage, task: DataTask, numeric: boolean, decimals: boolean): string[] {
  const values = literal(task, numeric, decimals);
  const type = numeric ? (decimals ? "real" : "int") : "text";
  if (!task.input) {
    return {
      python: [`items = [${values}]`],
      javascript: [`let items = [${values}];`],
      java: [`List<${{ text: "String", int: "Integer", real: "Double" }[type]}> items = new ArrayList<>(List.of(${values}));`],
      cpp: [`std::vector<${{ text: "std::string", int: "long long", real: "double" }[type]}> items = {${values}};`],
      csharp: [`var items = new List<${{ text: "string", int: "long", real: "double" }[type]}> { ${values} };`],
    }[language];
  }
  const count = task.input.count;
  switch (language) {
    case "python":
      return [
        ...(count === null ? ["n = int(input())"] : []),
        `items = [${numeric ? "int(input())" : "input().strip()"} for _ in range(${count ?? "n"})]`,
      ];
    case "javascript":
      return [
        'const lines = require("fs").readFileSync(0, "utf8").split(/\\r?\\n/).map((s) => s.trim()).filter(Boolean);',
        count === null
          ? `let items = lines.slice(1, Number(lines[0]) + 1)${numeric ? ".map(Number)" : ""};`
          : `let items = lines.slice(0, ${count})${numeric ? ".map(Number)" : ""};`,
      ];
    case "java":
      return [
        'Scanner in = new Scanner(System.in, "UTF-8");',
        count === null ? "int n = Integer.parseInt(in.nextLine().trim());" : `int n = ${count};`,
        `List<${numeric ? "Integer" : "String"}> items = new ArrayList<>();`,
        `for (int i = 0; i < n; i++) items.add(${numeric ? "Integer.parseInt(in.nextLine().trim())" : "in.nextLine().trim()"});`,
      ];
    case "cpp":
      return [
        count === null ? "int n;\nstd::cin >> n;" : `int n = ${count};`,
        `std::vector<${numeric ? "long long" : "std::string"}> items(n);`,
        numeric ? "for (auto& x : items) std::cin >> x;" : "for (auto& x : items) std::getline(std::cin >> std::ws, x);",
      ];
    case "csharp":
      return [
        count === null ? "int n = int.Parse(Console.ReadLine().Trim());" : `int n = ${count};`,
        `var items = new List<${numeric ? "long" : "string"}>();`,
        `for (int i = 0; i < n; i++) items.Add(${numeric ? "long.Parse(Console.ReadLine().Trim())" : "Console.ReadLine().Trim()"});`,
      ];
  }
}

const python: Generator = (task, numeric, decimals) => {
  const lines = source("python", task, numeric, decimals);
  let isList = true;
  for (const s of task.steps) {
    if (s.kind === "first") lines.push("items = [word[0] for word in items]");
    if (s.kind === "last") lines.push("items = [word[-1] for word in items]");
    if (s.kind === "length") lines.push("items = [len(word) for word in items]");
    if (s.kind === "sort") lines.push(s.desc ? "items.sort(reverse=True)" : "items.sort()");
    if (s.kind === "reverse") lines.push("items.reverse()");
    if (s.kind === "unique") lines.push("items = list(dict.fromkeys(items))");
    if (s.kind === "filter")
      lines.push(`items = [x for x in items if ${{ even: "x % 2 == 0", odd: "x % 2 == 1", positive: "x > 0", negative: "x < 0" }[s.keep]}]`);
    if (s.kind === "aggregate") {
      isList = false;
      lines.push(
        {
          sum: "result = sum(items)",
          average: 'result = f"{sum(items) / len(items):.2f}" if items else "-"',
          max: 'result = max(items) if items else "-"',
          min: 'result = min(items) if items else "-"',
          count: "result = len(items)",
        }[s.op],
      );
    }
  }
  lines.push(isList ? 'print(", ".join(str(x) for x in items))' : "print(result)");
  return lines.join("\n");
};

const javascript: Generator = (task, numeric, decimals) => {
  const lines = source("javascript", task, numeric, decimals);
  let isList = true;
  for (const s of task.steps) {
    if (s.kind === "first") lines.push("items = items.map((word) => [...word][0]);");
    if (s.kind === "last") lines.push("items = items.map((word) => [...word].at(-1));");
    if (s.kind === "length") lines.push("items = items.map((word) => [...word].length);");
    if (s.kind === "sort")
      lines.push(
        numeric || task.steps.some((t) => t.kind === "length")
          ? `items.sort((a, b) => ${s.desc ? "b - a" : "a - b"});`
          : `items.sort(${s.desc ? "(a, b) => (a < b ? 1 : a > b ? -1 : 0)" : ""});`,
      );
    if (s.kind === "reverse") lines.push("items.reverse();");
    if (s.kind === "unique") lines.push("items = [...new Set(items)];");
    if (s.kind === "filter")
      lines.push(`items = items.filter((x) => ${{ even: "x % 2 === 0", odd: "Math.abs(x % 2) === 1", positive: "x > 0", negative: "x < 0" }[s.keep]});`);
    if (s.kind === "aggregate") {
      isList = false;
      lines.push(
        {
          sum: "const result = items.reduce((s, x) => s + x, 0);",
          average: 'const result = items.length ? (items.reduce((s, x) => s + x, 0) / items.length).toFixed(2) : "-";',
          max: 'const result = items.length ? [...items].sort(numericOrText).at(-1) : "-";',
          min: 'const result = items.length ? [...items].sort(numericOrText)[0] : "-";',
          count: "const result = items.length;",
        }[s.op],
      );
      if (s.op === "max" || s.op === "min")
        lines.unshift('const numericOrText = (a, b) => (typeof a === "number" ? a - b : a < b ? -1 : a > b ? 1 : 0);');
    }
  }
  lines.push(isList ? 'console.log(items.join(", "));' : "console.log(String(result));");
  return lines.join("\n");
};

/** Element type after each step, for the typed languages. */
type ElementType = "text" | "int" | "real";

function typesAfter(task: DataTask, numeric: boolean, decimals: boolean): { start: ElementType; out: ElementType[] } {
  const start: ElementType = numeric ? (decimals ? "real" : "int") : "text";
  let type = start;
  const out: ElementType[] = [];
  for (const s of task.steps) {
    if (s.kind === "length") type = "int";
    out.push(type);
  }
  return { start, out };
}

const java: Generator = (task, numeric, decimals) => {
  const { start, out } = typesAfter(task, numeric, decimals);
  const boxed = { text: "String", int: "Integer", real: "Double" };
  const body: string[] = source("java", task, numeric, decimals);
  let isList = true;
  let n = 0;
  task.steps.forEach((s, i) => {
    const t = boxed[out[i]];
    const fresh = () => `items${++n}`;
    const prev = () => (n === 0 ? "items" : `items${n}`);
    if (s.kind === "first") body.push(`List<String> ${(() => { const p = prev(); const f = fresh(); return `${f} = ${p}.stream().map(w -> w.substring(0, 1)).collect(Collectors.toList())`; })()};`);
    if (s.kind === "last") body.push(`List<String> ${(() => { const p = prev(); const f = fresh(); return `${f} = ${p}.stream().map(w -> w.substring(w.length() - 1)).collect(Collectors.toList())`; })()};`);
    if (s.kind === "length") body.push(`List<Integer> ${(() => { const p = prev(); const f = fresh(); return `${f} = ${p}.stream().map(String::length).collect(Collectors.toList())`; })()};`);
    if (s.kind === "sort") body.push(`${prev()}.sort(${s.desc ? "Comparator.reverseOrder()" : "Comparator.naturalOrder()"});`);
    if (s.kind === "reverse") body.push(`Collections.reverse(${prev()});`);
    if (s.kind === "unique") body.push(`List<${t}> ${(() => { const p = prev(); const f = fresh(); return `${f} = new ArrayList<>(new LinkedHashSet<>(${p}))`; })()};`);
    if (s.kind === "filter") {
      const cond = { even: "x % 2 == 0", odd: "Math.abs(x % 2) == 1", positive: "x > 0", negative: "x < 0" }[s.keep];
      body.push(`List<${t}> ${(() => { const p = prev(); const f = fresh(); return `${f} = ${p}.stream().filter(x -> ${cond}).collect(Collectors.toList())`; })()};`);
    }
    if (s.kind === "aggregate") {
      isList = false;
      const p = prev();
      const sum = out[i] === "real" ? `${p}.stream().mapToDouble(Double::doubleValue).sum()` : `${p}.stream().mapToLong(Integer::longValue).sum()`;
      body.push(
        {
          sum: `String result = ${out[i] === "real" ? `String.valueOf(${sum})` : `String.valueOf(${sum})`};`,
          average: `String result = ${p}.isEmpty() ? "-" : String.format(Locale.US, "%.2f", (double) ${sum} / ${p}.size());`,
          max: `String result = ${p}.isEmpty() ? "-" : String.valueOf(Collections.max(${p}));`,
          min: `String result = ${p}.isEmpty() ? "-" : String.valueOf(Collections.min(${p}));`,
          count: `String result = String.valueOf(${p}.size());`,
        }[s.op],
      );
    }
  });
  const last = n === 0 ? "items" : `items${n}`;
  body.push(
    isList
      ? `System.out.println(${last}.stream().map(String::valueOf).collect(Collectors.joining(", ")));`
      : "System.out.println(result);",
  );
  return `import java.util.*;
import java.util.stream.Collectors;

public class Main {
    public static void main(String[] args) {
${body.map((l) => `        ${l}`).join("\n")}
    }
}`;
};

const cpp: Generator = (task, numeric, decimals) => {
  const { start, out } = typesAfter(task, numeric, decimals);
  const ctype = { text: "std::string", int: "long long", real: "double" };
  const needsUtf8 = task.steps.some((s) => s.kind === "first" || s.kind === "last" || s.kind === "length");
  const helpers = needsUtf8
    ? `
// Letters are UTF-8 (Cyrillic takes 2 bytes), so split the text into whole characters.
std::vector<std::string> letters(const std::string& word) {
    std::vector<std::string> out;
    for (size_t i = 0; i < word.size();) {
        unsigned char c = word[i];
        size_t len = c < 0x80 ? 1 : (c >> 5) == 0x6 ? 2 : (c >> 4) == 0xE ? 3 : 4;
        out.push_back(word.substr(i, len));
        i += len;
    }
    return out;
}
`
    : "";
  const body: string[] = source("cpp", task, numeric, decimals);
  let isList = true;
  let n = 0;
  const prev = () => (n === 0 ? "items" : `items${n}`);
  task.steps.forEach((s, i) => {
    const t = ctype[out[i]];
    if (s.kind === "first" || s.kind === "last" || s.kind === "length") {
      const p = prev();
      const f = `items${++n}`;
      body.push(`std::vector<${t}> ${f};`);
      body.push(
        `for (const auto& word : ${p}) ${f}.push_back(${s.kind === "first" ? "letters(word).front()" : s.kind === "last" ? "letters(word).back()" : "static_cast<long long>(letters(word).size())"});`,
      );
    }
    if (s.kind === "sort") body.push(`std::sort(${prev()}.begin(), ${prev()}.end()${s.desc ? `, std::greater<${t}>()` : ""});`);
    if (s.kind === "reverse") body.push(`std::reverse(${prev()}.begin(), ${prev()}.end());`);
    if (s.kind === "unique") {
      const p = prev();
      const f = `items${++n}`;
      body.push(`std::vector<${t}> ${f};`);
      body.push(`for (const auto& x : ${p}) if (std::find(${f}.begin(), ${f}.end(), x) == ${f}.end()) ${f}.push_back(x);`);
    }
    if (s.kind === "filter") {
      const p = prev();
      const f = `items${++n}`;
      const cond = {
        even: out[i] === "real" ? "std::fmod(x, 2) == 0" : "x % 2 == 0",
        odd: out[i] === "real" ? "std::fabs(std::fmod(x, 2)) == 1" : "x % 2 != 0",
        positive: "x > 0",
        negative: "x < 0",
      }[s.keep];
      body.push(`std::vector<${t}> ${f};`);
      body.push(`for (const auto& x : ${p}) if (${cond}) ${f}.push_back(x);`);
    }
    if (s.kind === "aggregate") {
      isList = false;
      const p = prev();
      const sum = `std::accumulate(${p}.begin(), ${p}.end(), ${out[i] === "real" ? "0.0" : "0LL"})`;
      body.push(
        {
          sum: `std::cout << ${sum} << std::endl;`,
          average: `if (${p}.empty()) std::cout << "-" << std::endl;\nelse std::cout << std::fixed << std::setprecision(2) << static_cast<double>(${sum}) / ${p}.size() << std::endl;`,
          max: `if (${p}.empty()) std::cout << "-" << std::endl;\nelse std::cout << *std::max_element(${p}.begin(), ${p}.end()) << std::endl;`,
          min: `if (${p}.empty()) std::cout << "-" << std::endl;\nelse std::cout << *std::min_element(${p}.begin(), ${p}.end()) << std::endl;`,
          count: `std::cout << ${p}.size() << std::endl;`,
        }[s.op],
      );
    }
  });
  if (isList) {
    const last = prev();
    body.push(`for (size_t i = 0; i < ${last}.size(); i++) std::cout << (i ? ", " : "") << ${last}[i];`);
    body.push("std::cout << std::endl;");
  }
  return `#include <algorithm>
#include <cmath>
#include <functional>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <string>
#include <vector>
${helpers}
int main() {
${body.flatMap((l) => l.split("\n")).map((l) => `    ${l}`).join("\n")}
    return 0;
}`;
};

const csharp: Generator = (task, numeric, decimals) => {
  const { start, out } = typesAfter(task, numeric, decimals);
  const ctype = { text: "string", int: "long", real: "double" };
  const body: string[] = source("csharp", task, numeric, decimals);
  let isList = true;
  task.steps.forEach((s, i) => {
    if (s.kind === "first") body.push("var items" + (i + 1) + " = items" + (i ? i : "") + '.Select(w => w.Substring(0, 1)).ToList();');
    else if (s.kind === "last") body.push("var items" + (i + 1) + " = items" + (i ? i : "") + ".Select(w => w.Substring(w.Length - 1)).ToList();");
    else if (s.kind === "length") body.push("var items" + (i + 1) + " = items" + (i ? i : "") + ".Select(w => (long)w.Length).ToList();");
    else if (s.kind === "sort")
      body.push(
        "var items" + (i + 1) + " = items" + (i ? i : "") +
          (out[i] === "text"
            ? (s.desc ? ".OrderByDescending(x => x, StringComparer.Ordinal)" : ".OrderBy(x => x, StringComparer.Ordinal)")
            : s.desc ? ".OrderByDescending(x => x)" : ".OrderBy(x => x)") +
          ".ToList();",
      );
    else if (s.kind === "reverse") body.push("var items" + (i + 1) + " = Enumerable.Reverse(items" + (i ? i : "") + ").ToList();");
    else if (s.kind === "unique") body.push("var items" + (i + 1) + " = items" + (i ? i : "") + ".Distinct().ToList();");
    else if (s.kind === "filter") {
      const cond = { even: "x % 2 == 0", odd: "Math.Abs(x % 2) == 1", positive: "x > 0", negative: "x < 0" }[s.keep];
      body.push("var items" + (i + 1) + " = items" + (i ? i : "") + `.Where(x => ${cond}).ToList();`);
    } else if (s.kind === "aggregate") {
      isList = false;
      const p = "items" + (i ? i : "");
      body.push(
        {
          sum: `var result = ${p}.Sum().ToString(CultureInfo.InvariantCulture);`,
          average: `var result = ${p}.Count == 0 ? "-" : ${p}.Average().ToString("F2", CultureInfo.InvariantCulture);`,
          max: `var result = ${p}.Count == 0 ? "-" : ${out[i] === "text" ? `${p}.OrderBy(x => x, StringComparer.Ordinal).Last()` : `${p}.Max().ToString(CultureInfo.InvariantCulture)`};`,
          min: `var result = ${p}.Count == 0 ? "-" : ${out[i] === "text" ? `${p}.OrderBy(x => x, StringComparer.Ordinal).First()` : `${p}.Min().ToString(CultureInfo.InvariantCulture)`};`,
          count: `var result = ${p}.Count.ToString();`,
        }[s.op],
      );
    }
  });
  const last = "items" + (task.steps.length && isList ? task.steps.length : "");
  body.push(
    isList
      ? `Console.WriteLine(string.Join(", ", ${last}.Select(x => Convert.ToString(x, CultureInfo.InvariantCulture))));`
      : "Console.WriteLine(result);",
  );
  return `using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

class Program
{
    static void Main()
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
${body.map((l) => `        ${l}`).join("\n")}
    }
}`;
};

const GENERATORS: Record<CodeLanguage, Generator> = { python, javascript, java, cpp, csharp };

/** The data written in the task, if any, so the AI can be told to use it exactly. */
export function taskData(prompt: string): Item[] | null {
  return extractData(prompt)?.items ?? null;
}

/** True when a program reads from the keyboard or stdin instead of using the given data. */
export function readsInput(code: string): boolean {
  return /\binput\s*\(|\bScanner\b|\bcin\s*>>|\breadline\b|readFileSync\(\s*(0|["']\/dev\/stdin)|Console\.ReadLine|\bprompt\s*\(|sys\.stdin|getline\s*\(\s*cin/u.test(code);
}
