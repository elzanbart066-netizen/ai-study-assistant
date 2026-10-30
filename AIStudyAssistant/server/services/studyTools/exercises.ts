import type { CodeLanguage, CodeResult, Language } from "../../../src/models/index.js";

// "Give me a problem about functions": a complete practice problem with its full
// solution, test calls and exact output, written by hand for the common topics.
// The small keyless model tends to answer such requests with a stub, so these
// come first when no Claude key is set.

type Topic = "class" | "function" | "string" | "list" | "loop" | "condition";

// Checked in order: a request that names both functions and conditions gets the function problem.
const TOPICS: [Topic, RegExp][] = [
  ["class", /класс|(?<!\p{L})(class|classes|ооп|oop|объект\p{L}*|object\p{L}*)(?!\p{L})/iu],
  ["function", /функци|function|(?<!\p{L})(def|әдіс\p{L}*|метод\p{L}*|methods?)(?!\p{L})/iu],
  ["string", /(?<!\p{L})(жол|жолдар\p{L}*|жолды|string\p{L}*|строк\p{L}*|мәтін\p{L}*|пароль\p{L}*|password\p{L}*|құпиясөз\p{L}*)(?!\p{L})/iu],
  ["list", /тізім|массив|(?<!\p{L})(list\p{L}*|array\p{L}*|списк\p{L}*|список)(?!\p{L})/iu],
  ["loop", /цикл|(?<!\p{L})(loops?|for|while|қайталау\p{L}*)(?!\p{L})/iu],
  ["condition", /шарт|услов|ветвл|(?<!\p{L})(if|else|conditions?|conditional)(?!\p{L})/iu],
];

const ASKS_FOR_PROBLEM =
  /(?<!\p{L})(есеп|есептер|есепті|есептерді|есебін|тапсырма\p{L}*|задач\p{L}*|задани\p{L}*|упражнени\p{L}*|exercises?|problems?|tasks?|practice)(?!\p{L})/iu;
const GIVE = /(?<!\p{L})(бер\p{L}*|құрастыр\p{L}*|ойлап|жаса\p{L}*|дай|дайте|придумай\p{L}*|составь\p{L}*|предлож\p{L}*|give|make|create|suggest|write)(?!\p{L})/iu;

/** The topic when the student asks for a practice problem, else null. */
export function exerciseTopic(prompt: string): Topic | null {
  if (!ASKS_FOR_PROBLEM.test(prompt) || !GIVE.test(prompt)) return null;
  // A long request describes its own task; only short "give me a problem about X" asks qualify.
  if ((prompt.match(/[\p{L}\d]+/gu) ?? []).length > 14) return null;
  for (const [topic, re] of TOPICS) if (re.test(prompt)) return topic;
  return null;
}

interface Exercise {
  statement: Record<Language, string>;
  explanation: Record<Language, string>;
  output: string;
  code: Record<CodeLanguage, string>;
}

const EXERCISES: Record<Topic, Exercise> = {
  function: {
    statement: {
      kk: "grade(score) функциясын жазыңыз: 0–100 баллды бағаға айналдырсын (90+ → A, 75+ → B, 60+ → C, 50+ → D, қалғаны F), ал 0–100 аралығынан тыс балл үшін \"invalid\" қайтарсын. passed(score) функциясы оқушы өтті ме, соны тексерсін. Бірнеше баллмен тексеріңіз.",
      ru: "Напишите функцию grade(score): переводит балл 0–100 в оценку (90+ → A, 75+ → B, 60+ → C, 50+ → D, иначе F), а для балла вне 0–100 возвращает \"invalid\". Функция passed(score) проверяет, сдал ли ученик. Проверьте на нескольких баллах.",
      en: "Write a function grade(score) that turns a 0–100 score into a letter (90+ → A, 75+ → B, 60+ → C, 50+ → D, otherwise F) and returns \"invalid\" for a score outside 0–100. A function passed(score) tells whether the student passed. Test it on several scores.",
    },
    explanation: {
      kk: "grade алдымен баллдың дұрыстығын тексереді, содан кейін if/elif тізбегі жоғарыдан төмен қарай бірінші сәйкес келген бағаны қайтарады. passed бағаны қайта есептемей, grade функциясын шақырады: бір ереже бір жерде ғана жазылады. Соңындағы цикл әр баллға екі функцияны да шақырады.",
      ru: "grade сначала проверяет, допустим ли балл, затем цепочка if/elif сверху вниз возвращает первую подходящую оценку. passed не дублирует правила, а вызывает grade. Цикл в конце вызывает обе функции для каждого балла.",
      en: "grade first checks that the score is valid, then an if/elif chain returns the first matching letter from the top down. passed reuses grade instead of repeating the rules. The loop at the end calls both functions for each score.",
    },
    output: "95: A (passed)\n82: B (passed)\n67: C (passed)\n50: D (passed)\n34: F (failed)\n105: invalid (failed)",
    code: {
      python: `def grade(score: int) -> str:
    """Returns the letter grade for a score from 0 to 100."""
    if score < 0 or score > 100:
        return "invalid"
    if score >= 90:
        return "A"
    elif score >= 75:
        return "B"
    elif score >= 60:
        return "C"
    elif score >= 50:
        return "D"
    return "F"


def passed(score: int) -> bool:
    return grade(score) in ("A", "B", "C", "D")


scores = [95, 82, 67, 50, 34, 105]
for s in scores:
    status = "passed" if passed(s) else "failed"
    print(f"{s}: {grade(s)} ({status})")`,
      javascript: `// Returns the letter grade for a score from 0 to 100.
function grade(score) {
  if (score < 0 || score > 100) return "invalid";
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function passed(score) {
  return ["A", "B", "C", "D"].includes(grade(score));
}

const scores = [95, 82, 67, 50, 34, 105];
for (const s of scores) {
  const status = passed(s) ? "passed" : "failed";
  console.log(\`\${s}: \${grade(s)} (\${status})\`);
}`,
      java: `public class Main {
    // Returns the letter grade for a score from 0 to 100.
    static String grade(int score) {
        if (score < 0 || score > 100) return "invalid";
        if (score >= 90) return "A";
        else if (score >= 75) return "B";
        else if (score >= 60) return "C";
        else if (score >= 50) return "D";
        return "F";
    }

    static boolean passed(int score) {
        String g = grade(score);
        return g.equals("A") || g.equals("B") || g.equals("C") || g.equals("D");
    }

    public static void main(String[] args) {
        int[] scores = {95, 82, 67, 50, 34, 105};
        for (int s : scores) {
            String status = passed(s) ? "passed" : "failed";
            System.out.println(s + ": " + grade(s) + " (" + status + ")");
        }
    }
}`,
      cpp: `#include <iostream>
#include <string>
#include <vector>

// Returns the letter grade for a score from 0 to 100.
std::string grade(int score) {
    if (score < 0 || score > 100) return "invalid";
    if (score >= 90) return "A";
    else if (score >= 75) return "B";
    else if (score >= 60) return "C";
    else if (score >= 50) return "D";
    return "F";
}

bool passed(int score) {
    std::string g = grade(score);
    return g == "A" || g == "B" || g == "C" || g == "D";
}

int main() {
    std::vector<int> scores = {95, 82, 67, 50, 34, 105};
    for (int s : scores) {
        std::string status = passed(s) ? "passed" : "failed";
        std::cout << s << ": " << grade(s) << " (" << status << ")" << std::endl;
    }
    return 0;
}`,
      csharp: `using System;

class Program
{
    // Returns the letter grade for a score from 0 to 100.
    static string Grade(int score)
    {
        if (score < 0 || score > 100) return "invalid";
        if (score >= 90) return "A";
        else if (score >= 75) return "B";
        else if (score >= 60) return "C";
        else if (score >= 50) return "D";
        return "F";
    }

    static bool Passed(int score)
    {
        string g = Grade(score);
        return g == "A" || g == "B" || g == "C" || g == "D";
    }

    static void Main()
    {
        int[] scores = { 95, 82, 67, 50, 34, 105 };
        foreach (int s in scores)
        {
            string status = Passed(s) ? "passed" : "failed";
            Console.WriteLine($"{s}: {Grade(s)} ({status})");
        }
    }
}`,
    },
  },

  condition: {
    statement: {
      kk: "Үшбұрыштың үш қабырғасы берілген. Мұндай үшбұрыш бар ма, соны тексеріңіз (әр қабырға қалған екеуінің қосындысынан кіші болуы керек). Бар болса, түрін анықтаңыз: тең қабырғалы, тең бүйірлі немесе әртүрлі қабырғалы, және тікбұрышты ма.",
      ru: "Даны три стороны треугольника. Проверьте, существует ли он (каждая сторона меньше суммы двух других). Если да, определите вид: равносторонний, равнобедренный или разносторонний, и является ли он прямоугольным.",
      en: "Three side lengths are given. Check whether such a triangle exists (each side must be shorter than the sum of the other two). If it does, say whether it is equilateral, isosceles or scalene, and whether it is right-angled.",
    },
    explanation: {
      kk: "Алдымен үшбұрыш теңсіздігі тексеріледі: шарт орындалмаса, әрі қарай тексерудің мәні жоқ. Содан кейін тең қабырғалар саны бойынша түрі анықталады. Тікбұрышты екенін білу үшін қабырғалар сұрыпталып, Пифагор теоремасы a² + b² = c² тексеріледі.",
      ru: "Сначала проверяется неравенство треугольника: если оно не выполняется, дальше проверять нечего. Затем вид определяется по числу равных сторон. Для прямого угла стороны сортируются и проверяется теорема Пифагора a² + b² = c².",
      en: "The triangle inequality is checked first: if it fails there is nothing more to check. The kind is then decided by how many sides are equal. For a right angle the sides are sorted and Pythagoras' a² + b² = c² is tested.",
    },
    output: "3 3 3: equilateral\n5 5 8: isosceles\n3 4 5: scalene, right\n1 2 3: not a triangle\n7 8 9: scalene",
    code: {
      python: `def triangle_type(a: int, b: int, c: int) -> str:
    if a <= 0 or b <= 0 or c <= 0 or a + b <= c or a + c <= b or b + c <= a:
        return "not a triangle"
    if a == b == c:
        kind = "equilateral"
    elif a == b or b == c or a == c:
        kind = "isosceles"
    else:
        kind = "scalene"
    x, y, z = sorted([a, b, c])
    if x * x + y * y == z * z:
        kind += ", right"
    return kind


tests = [(3, 3, 3), (5, 5, 8), (3, 4, 5), (1, 2, 3), (7, 8, 9)]
for a, b, c in tests:
    print(f"{a} {b} {c}: {triangle_type(a, b, c)}")`,
      javascript: `function triangleType(a, b, c) {
  if (a <= 0 || b <= 0 || c <= 0 || a + b <= c || a + c <= b || b + c <= a) {
    return "not a triangle";
  }
  let kind;
  if (a === b && b === c) kind = "equilateral";
  else if (a === b || b === c || a === c) kind = "isosceles";
  else kind = "scalene";
  const [x, y, z] = [a, b, c].sort((p, q) => p - q);
  if (x * x + y * y === z * z) kind += ", right";
  return kind;
}

const tests = [[3, 3, 3], [5, 5, 8], [3, 4, 5], [1, 2, 3], [7, 8, 9]];
for (const [a, b, c] of tests) {
  console.log(\`\${a} \${b} \${c}: \${triangleType(a, b, c)}\`);
}`,
      java: `import java.util.Arrays;

public class Main {
    static String triangleType(int a, int b, int c) {
        if (a <= 0 || b <= 0 || c <= 0 || a + b <= c || a + c <= b || b + c <= a) {
            return "not a triangle";
        }
        String kind;
        if (a == b && b == c) kind = "equilateral";
        else if (a == b || b == c || a == c) kind = "isosceles";
        else kind = "scalene";
        int[] s = {a, b, c};
        Arrays.sort(s);
        if (s[0] * s[0] + s[1] * s[1] == s[2] * s[2]) kind += ", right";
        return kind;
    }

    public static void main(String[] args) {
        int[][] tests = {{3, 3, 3}, {5, 5, 8}, {3, 4, 5}, {1, 2, 3}, {7, 8, 9}};
        for (int[] t : tests) {
            System.out.println(t[0] + " " + t[1] + " " + t[2] + ": " + triangleType(t[0], t[1], t[2]));
        }
    }
}`,
      cpp: `#include <algorithm>
#include <array>
#include <iostream>
#include <string>
#include <vector>

std::string triangleType(int a, int b, int c) {
    if (a <= 0 || b <= 0 || c <= 0 || a + b <= c || a + c <= b || b + c <= a) {
        return "not a triangle";
    }
    std::string kind;
    if (a == b && b == c) kind = "equilateral";
    else if (a == b || b == c || a == c) kind = "isosceles";
    else kind = "scalene";
    std::array<int, 3> s = {a, b, c};
    std::sort(s.begin(), s.end());
    if (s[0] * s[0] + s[1] * s[1] == s[2] * s[2]) kind += ", right";
    return kind;
}

int main() {
    std::vector<std::array<int, 3>> tests = {{3, 3, 3}, {5, 5, 8}, {3, 4, 5}, {1, 2, 3}, {7, 8, 9}};
    for (const auto& t : tests) {
        std::cout << t[0] << " " << t[1] << " " << t[2] << ": " << triangleType(t[0], t[1], t[2]) << std::endl;
    }
    return 0;
}`,
      csharp: `using System;

class Program
{
    static string TriangleType(int a, int b, int c)
    {
        if (a <= 0 || b <= 0 || c <= 0 || a + b <= c || a + c <= b || b + c <= a)
            return "not a triangle";
        string kind;
        if (a == b && b == c) kind = "equilateral";
        else if (a == b || b == c || a == c) kind = "isosceles";
        else kind = "scalene";
        int[] s = { a, b, c };
        Array.Sort(s);
        if (s[0] * s[0] + s[1] * s[1] == s[2] * s[2]) kind += ", right";
        return kind;
    }

    static void Main()
    {
        int[][] tests = { new[] { 3, 3, 3 }, new[] { 5, 5, 8 }, new[] { 3, 4, 5 }, new[] { 1, 2, 3 }, new[] { 7, 8, 9 } };
        foreach (var t in tests)
            Console.WriteLine($"{t[0]} {t[1]} {t[2]}: {TriangleType(t[0], t[1], t[2])}");
    }
}`,
    },
  },

  loop: {
    statement: {
      kk: "1-ден n-ге дейінгі сандарды цикл арқылы қараңыз (n = 20): 3-ке бөлінетін сандарды шығарып, олардың санын және қосындысын табыңыз, сондай-ақ жұп және тақ сандар санын есептеңіз.",
      ru: "Переберите в цикле числа от 1 до n (n = 20): выведите числа, кратные 3, найдите их количество и сумму, а также посчитайте, сколько чётных и нечётных чисел.",
      en: "Loop over the numbers from 1 to n (n = 20): print the multiples of 3, find how many there are and their sum, and count the even and odd numbers.",
    },
    explanation: {
      kk: "Бір for циклі әр санды бір рет қарайды. i % 3 == 0 шарты 3-ке бөлінетінін, i % 2 == 0 жұп екенін тексереді. Санауыштар мен қосынды цикл алдында нөлмен басталып, цикл ішінде өседі. Нәтиже цикл біткен соң шығарылады.",
      ru: "Один цикл for просматривает каждое число один раз. Условие i % 3 == 0 проверяет кратность 3, i % 2 == 0 — чётность. Счётчики и сумма начинаются с нуля до цикла и растут внутри него. Итоги выводятся после цикла.",
      en: "One for loop visits each number once. i % 3 == 0 checks for a multiple of 3 and i % 2 == 0 for an even number. The counters and the sum start at zero before the loop and grow inside it; the totals are printed after it.",
    },
    output: "Multiples of 3 up to 20: 3 6 9 12 15 18\nCount: 6\nSum: 63\nEven numbers: 10, odd numbers: 10",
    code: {
      python: `n = 20
multiples = []
total = 0
even = 0
odd = 0

for i in range(1, n + 1):
    if i % 3 == 0:
        multiples.append(i)
        total += i
    if i % 2 == 0:
        even += 1
    else:
        odd += 1

print(f"Multiples of 3 up to {n}: " + " ".join(str(x) for x in multiples))
print(f"Count: {len(multiples)}")
print(f"Sum: {total}")
print(f"Even numbers: {even}, odd numbers: {odd}")`,
      javascript: `const n = 20;
const multiples = [];
let total = 0;
let even = 0;
let odd = 0;

for (let i = 1; i <= n; i++) {
  if (i % 3 === 0) {
    multiples.push(i);
    total += i;
  }
  if (i % 2 === 0) even++;
  else odd++;
}

console.log(\`Multiples of 3 up to \${n}: \${multiples.join(" ")}\`);
console.log(\`Count: \${multiples.length}\`);
console.log(\`Sum: \${total}\`);
console.log(\`Even numbers: \${even}, odd numbers: \${odd}\`);`,
      java: `import java.util.ArrayList;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        int n = 20;
        List<Integer> multiples = new ArrayList<>();
        int total = 0, even = 0, odd = 0;

        for (int i = 1; i <= n; i++) {
            if (i % 3 == 0) {
                multiples.add(i);
                total += i;
            }
            if (i % 2 == 0) even++;
            else odd++;
        }

        StringBuilder line = new StringBuilder();
        for (int x : multiples) line.append(line.length() > 0 ? " " : "").append(x);
        System.out.println("Multiples of 3 up to " + n + ": " + line);
        System.out.println("Count: " + multiples.size());
        System.out.println("Sum: " + total);
        System.out.println("Even numbers: " + even + ", odd numbers: " + odd);
    }
}`,
      cpp: `#include <iostream>
#include <vector>

int main() {
    int n = 20;
    std::vector<int> multiples;
    int total = 0, even = 0, odd = 0;

    for (int i = 1; i <= n; i++) {
        if (i % 3 == 0) {
            multiples.push_back(i);
            total += i;
        }
        if (i % 2 == 0) even++;
        else odd++;
    }

    std::cout << "Multiples of 3 up to " << n << ":";
    for (int x : multiples) std::cout << " " << x;
    std::cout << std::endl;
    std::cout << "Count: " << multiples.size() << std::endl;
    std::cout << "Sum: " << total << std::endl;
    std::cout << "Even numbers: " << even << ", odd numbers: " << odd << std::endl;
    return 0;
}`,
      csharp: `using System;
using System.Collections.Generic;

class Program
{
    static void Main()
    {
        int n = 20;
        var multiples = new List<int>();
        int total = 0, even = 0, odd = 0;

        for (int i = 1; i <= n; i++)
        {
            if (i % 3 == 0)
            {
                multiples.Add(i);
                total += i;
            }
            if (i % 2 == 0) even++;
            else odd++;
        }

        Console.WriteLine($"Multiples of 3 up to {n}: {string.Join(" ", multiples)}");
        Console.WriteLine($"Count: {multiples.Count}");
        Console.WriteLine($"Sum: {total}");
        Console.WriteLine($"Even numbers: {even}, odd numbers: {odd}");
    }
}`,
    },
  },

  list: {
    statement: {
      kk: "Сыныптың бағалар тізімі берілген: 78, 92, 65, 88, 71, 95, 59. Орташа бағаны (екі ондық таңбамен), ең жоғары және ең төмен бағаны табыңыз, орташадан жоғары бағаларды шығарыңыз және тізімді кему ретімен сұрыптаңыз.",
      ru: "Дан список оценок класса: 78, 92, 65, 88, 71, 95, 59. Найдите среднее (с двумя знаками), наибольшую и наименьшую оценку, выведите оценки выше среднего и отсортируйте список по убыванию.",
      en: "A class's scores are 78, 92, 65, 88, 71, 95, 59. Find the average (two decimals), the highest and lowest score, print the scores above average, and sort the list in descending order.",
    },
    explanation: {
      kk: "Орташа = қосынды / элементтер саны. Ең үлкен және ең кіші мән тізімнен бір өтуде табылады. Орташадан жоғары бағалар сүзу арқылы жаңа тізімге алынады. Сұрыптау түпнұсқаны бұзбау үшін көшірмеде жасалады.",
      ru: "Среднее = сумма / количество. Максимум и минимум находятся за один проход. Оценки выше среднего отбираются фильтром в новый список. Сортировка делается на копии, чтобы не менять исходный список.",
      en: "Average = sum / count. The highest and lowest come from one pass over the list. Scores above the average are filtered into a new list. Sorting works on a copy so the original list stays as it was.",
    },
    output: "Scores: 78 92 65 88 71 95 59\nAverage: 78.29\nHighest: 95, lowest: 59\nAbove average (3): 92 88 95\nSorted: 95 92 88 78 71 65 59",
    code: {
      python: `scores = [78, 92, 65, 88, 71, 95, 59]

average = sum(scores) / len(scores)
above = [s for s in scores if s > average]
ordered = sorted(scores, reverse=True)

print("Scores: " + " ".join(str(s) for s in scores))
print(f"Average: {average:.2f}")
print(f"Highest: {max(scores)}, lowest: {min(scores)}")
print(f"Above average ({len(above)}): " + " ".join(str(s) for s in above))
print("Sorted: " + " ".join(str(s) for s in ordered))`,
      javascript: `const scores = [78, 92, 65, 88, 71, 95, 59];

const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
const above = scores.filter((s) => s > average);
const ordered = [...scores].sort((a, b) => b - a);

console.log(\`Scores: \${scores.join(" ")}\`);
console.log(\`Average: \${average.toFixed(2)}\`);
console.log(\`Highest: \${Math.max(...scores)}, lowest: \${Math.min(...scores)}\`);
console.log(\`Above average (\${above.length}): \${above.join(" ")}\`);
console.log(\`Sorted: \${ordered.join(" ")}\`);`,
      java: `import java.util.*;
import java.util.stream.Collectors;

public class Main {
    static String join(List<Integer> list) {
        return list.stream().map(String::valueOf).collect(Collectors.joining(" "));
    }

    public static void main(String[] args) {
        List<Integer> scores = List.of(78, 92, 65, 88, 71, 95, 59);

        double average = scores.stream().mapToInt(Integer::intValue).average().orElse(0);
        List<Integer> above = scores.stream().filter(s -> s > average).collect(Collectors.toList());
        List<Integer> ordered = new ArrayList<>(scores);
        ordered.sort(Comparator.reverseOrder());

        System.out.println("Scores: " + join(scores));
        System.out.println("Average: " + String.format(Locale.US, "%.2f", average));
        System.out.println("Highest: " + Collections.max(scores) + ", lowest: " + Collections.min(scores));
        System.out.println("Above average (" + above.size() + "): " + join(above));
        System.out.println("Sorted: " + join(ordered));
    }
}`,
      cpp: `#include <algorithm>
#include <functional>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <string>
#include <vector>

std::string join(const std::vector<int>& list) {
    std::string out;
    for (size_t i = 0; i < list.size(); i++) out += (i ? " " : "") + std::to_string(list[i]);
    return out;
}

int main() {
    std::vector<int> scores = {78, 92, 65, 88, 71, 95, 59};

    double average = std::accumulate(scores.begin(), scores.end(), 0.0) / scores.size();
    std::vector<int> above;
    for (int s : scores) if (s > average) above.push_back(s);
    std::vector<int> ordered = scores;
    std::sort(ordered.begin(), ordered.end(), std::greater<int>());

    std::cout << "Scores: " << join(scores) << std::endl;
    std::cout << "Average: " << std::fixed << std::setprecision(2) << average << std::endl;
    std::cout << "Highest: " << *std::max_element(scores.begin(), scores.end())
              << ", lowest: " << *std::min_element(scores.begin(), scores.end()) << std::endl;
    std::cout << "Above average (" << above.size() << "): " << join(above) << std::endl;
    std::cout << "Sorted: " << join(ordered) << std::endl;
    return 0;
}`,
      csharp: `using System;
using System.Globalization;
using System.Linq;

class Program
{
    static void Main()
    {
        int[] scores = { 78, 92, 65, 88, 71, 95, 59 };

        double average = scores.Average();
        var above = scores.Where(s => s > average).ToList();
        var ordered = scores.OrderByDescending(s => s).ToList();

        Console.WriteLine($"Scores: {string.Join(" ", scores)}");
        Console.WriteLine($"Average: {average.ToString("F2", CultureInfo.InvariantCulture)}");
        Console.WriteLine($"Highest: {scores.Max()}, lowest: {scores.Min()}");
        Console.WriteLine($"Above average ({above.Count}): {string.Join(" ", above)}");
        Console.WriteLine($"Sorted: {string.Join(" ", ordered)}");
    }
}`,
    },
  },

  string: {
    statement: {
      kk: "Құпиясөздің беріктігін тексеретін бағдарлама жазыңыз. 5 шарт бар: ұзындығы кемінде 8, кіші әріп, бас әріп, цифр және арнайы таңба бар. 0–2 шарт орындалса «weak», 3–4 болса «medium», 5-еуі де орындалса «strong» деп шығарсын.",
      ru: "Напишите программу проверки надёжности пароля по 5 условиям: длина не меньше 8, есть строчная буква, заглавная буква, цифра и спецсимвол. 0–2 условия → «weak», 3–4 → «medium», все 5 → «strong».",
      en: "Write a password strength checker with 5 rules: at least 8 characters, a lowercase letter, an uppercase letter, a digit and a special character. 0–2 rules met → \"weak\", 3–4 → \"medium\", all 5 → \"strong\".",
    },
    explanation: {
      kk: "Жолдың әр таңбасы тексеріліп, оның қай түрге жататыны (кіші/бас әріп, цифр, арнайы таңба) белгіленеді. Орындалған шарттар саны бойынша if/elif арқылы баға қойылады. Тексеру бір функцияда жазылып, бірнеше құпиясөзге қолданылады.",
      ru: "Каждый символ строки проверяется: строчная/заглавная буква, цифра или спецсимвол. По числу выполненных условий if/elif выставляет оценку. Проверка вынесена в функцию и применяется к нескольким паролям.",
      en: "Each character of the string is checked: lowercase, uppercase, digit or special character. The number of rules met decides the rating through if/elif. The check lives in one function that is applied to several passwords.",
    },
    output: "abc: weak (1/5)\nqwerty123: medium (3/5)\nQwerty123: medium (4/5)\nQw3rty!2024: strong (5/5)",
    code: {
      python: `def strength(password: str) -> tuple[str, int]:
    rules = [
        len(password) >= 8,
        any(ch.islower() for ch in password),
        any(ch.isupper() for ch in password),
        any(ch.isdigit() for ch in password),
        any(not ch.isalnum() for ch in password),
    ]
    met = sum(rules)
    if met <= 2:
        rating = "weak"
    elif met <= 4:
        rating = "medium"
    else:
        rating = "strong"
    return rating, met


for pw in ["abc", "qwerty123", "Qwerty123", "Qw3rty!2024"]:
    rating, met = strength(pw)
    print(f"{pw}: {rating} ({met}/5)")`,
      javascript: `function strength(password) {
  const rules = [
    password.length >= 8,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ];
  const met = rules.filter(Boolean).length;
  let rating;
  if (met <= 2) rating = "weak";
  else if (met <= 4) rating = "medium";
  else rating = "strong";
  return { rating, met };
}

for (const pw of ["abc", "qwerty123", "Qwerty123", "Qw3rty!2024"]) {
  const { rating, met } = strength(pw);
  console.log(\`\${pw}: \${rating} (\${met}/5)\`);
}`,
      java: `public class Main {
    static int rulesMet(String password) {
        boolean lower = false, upper = false, digit = false, special = false;
        for (char ch : password.toCharArray()) {
            if (Character.isLowerCase(ch)) lower = true;
            else if (Character.isUpperCase(ch)) upper = true;
            else if (Character.isDigit(ch)) digit = true;
            else special = true;
        }
        int met = 0;
        if (password.length() >= 8) met++;
        if (lower) met++;
        if (upper) met++;
        if (digit) met++;
        if (special) met++;
        return met;
    }

    static String rating(int met) {
        if (met <= 2) return "weak";
        else if (met <= 4) return "medium";
        return "strong";
    }

    public static void main(String[] args) {
        String[] passwords = {"abc", "qwerty123", "Qwerty123", "Qw3rty!2024"};
        for (String pw : passwords) {
            int met = rulesMet(pw);
            System.out.println(pw + ": " + rating(met) + " (" + met + "/5)");
        }
    }
}`,
      cpp: `#include <cctype>
#include <iostream>
#include <string>
#include <vector>

int rulesMet(const std::string& password) {
    bool lower = false, upper = false, digit = false, special = false;
    for (unsigned char ch : password) {
        if (std::islower(ch)) lower = true;
        else if (std::isupper(ch)) upper = true;
        else if (std::isdigit(ch)) digit = true;
        else special = true;
    }
    return (password.size() >= 8) + lower + upper + digit + special;
}

std::string rating(int met) {
    if (met <= 2) return "weak";
    else if (met <= 4) return "medium";
    return "strong";
}

int main() {
    std::vector<std::string> passwords = {"abc", "qwerty123", "Qwerty123", "Qw3rty!2024"};
    for (const auto& pw : passwords) {
        int met = rulesMet(pw);
        std::cout << pw << ": " << rating(met) << " (" << met << "/5)" << std::endl;
    }
    return 0;
}`,
      csharp: `using System;
using System.Linq;

class Program
{
    static int RulesMet(string password)
    {
        int met = 0;
        if (password.Length >= 8) met++;
        if (password.Any(char.IsLower)) met++;
        if (password.Any(char.IsUpper)) met++;
        if (password.Any(char.IsDigit)) met++;
        if (password.Any(ch => !char.IsLetterOrDigit(ch))) met++;
        return met;
    }

    static string Rating(int met)
    {
        if (met <= 2) return "weak";
        else if (met <= 4) return "medium";
        return "strong";
    }

    static void Main()
    {
        string[] passwords = { "abc", "qwerty123", "Qwerty123", "Qw3rty!2024" };
        foreach (var pw in passwords)
        {
            int met = RulesMet(pw);
            Console.WriteLine($"{pw}: {Rating(met)} ({met}/5)");
        }
    }
}`,
    },
  },

  class: {
    statement: {
      kk: "BankAccount класын жазыңыз: иесінің аты мен балансы болсын. deposit(amount) теріс не нөл соманы қабылдамасын, withdraw(amount) баланстан көп ақша шешуге рұқсат бермесін. Бірнеше операциямен тексеріңіз.",
      ru: "Напишите класс BankAccount с именем владельца и балансом. deposit(amount) не принимает нулевую или отрицательную сумму, withdraw(amount) не даёт снять больше баланса. Проверьте на нескольких операциях.",
      en: "Write a BankAccount class with an owner and a balance. deposit(amount) rejects zero or negative amounts and withdraw(amount) refuses to take out more than the balance. Test it with several operations.",
    },
    explanation: {
      kk: "Класс деректерді (иесі, балансы) және оларды өзгертетін әдістерді бір жерге жинайды. Әр әдіс алдымен шартты тексереді де, тек дұрыс операцияда ғана балансты өзгертеді. Сәтті болғанын true/false арқылы қайтарады. Баланс сырттан тікелей өзгертілмейді (инкапсуляция).",
      ru: "Класс объединяет данные (владелец, баланс) и методы, которые их меняют. Каждый метод сначала проверяет условие и меняет баланс только при корректной операции, возвращая true/false. Баланс не меняется напрямую извне (инкапсуляция).",
      en: "The class keeps the data (owner, balance) together with the methods that change it. Each method checks its condition first and changes the balance only for a valid operation, returning true or false. The balance is not changed directly from outside (encapsulation).",
    },
    output: "Deposit 500: ok, balance 1500\nWithdraw 2000: refused, balance 1500\nWithdraw 300: ok, balance 1200\nDeposit -50: refused, balance 1200\nAigerim has 1200",
    code: {
      python: `class BankAccount:
    def __init__(self, owner: str, balance: int = 0):
        self.owner = owner
        self._balance = balance

    @property
    def balance(self) -> int:
        return self._balance

    def deposit(self, amount: int) -> bool:
        if amount <= 0:
            return False
        self._balance += amount
        return True

    def withdraw(self, amount: int) -> bool:
        if amount <= 0 or amount > self._balance:
            return False
        self._balance -= amount
        return True


account = BankAccount("Aigerim", 1000)
operations = [("Deposit", 500), ("Withdraw", 2000), ("Withdraw", 300), ("Deposit", -50)]
for name, amount in operations:
    done = account.deposit(amount) if name == "Deposit" else account.withdraw(amount)
    print(f"{name} {amount}: {'ok' if done else 'refused'}, balance {account.balance}")
print(f"{account.owner} has {account.balance}")`,
      javascript: `class BankAccount {
  #balance;

  constructor(owner, balance = 0) {
    this.owner = owner;
    this.#balance = balance;
  }

  get balance() {
    return this.#balance;
  }

  deposit(amount) {
    if (amount <= 0) return false;
    this.#balance += amount;
    return true;
  }

  withdraw(amount) {
    if (amount <= 0 || amount > this.#balance) return false;
    this.#balance -= amount;
    return true;
  }
}

const account = new BankAccount("Aigerim", 1000);
const operations = [["Deposit", 500], ["Withdraw", 2000], ["Withdraw", 300], ["Deposit", -50]];
for (const [name, amount] of operations) {
  const done = name === "Deposit" ? account.deposit(amount) : account.withdraw(amount);
  console.log(\`\${name} \${amount}: \${done ? "ok" : "refused"}, balance \${account.balance}\`);
}
console.log(\`\${account.owner} has \${account.balance}\`);`,
      java: `public class Main {
    public static void main(String[] args) {
        BankAccount account = new BankAccount("Aigerim", 1000);
        String[] names = {"Deposit", "Withdraw", "Withdraw", "Deposit"};
        int[] amounts = {500, 2000, 300, -50};
        for (int i = 0; i < names.length; i++) {
            boolean done = names[i].equals("Deposit") ? account.deposit(amounts[i]) : account.withdraw(amounts[i]);
            System.out.println(names[i] + " " + amounts[i] + ": " + (done ? "ok" : "refused") + ", balance " + account.getBalance());
        }
        System.out.println(account.getOwner() + " has " + account.getBalance());
    }
}

class BankAccount {
    private final String owner;
    private int balance;

    BankAccount(String owner, int balance) {
        this.owner = owner;
        this.balance = balance;
    }

    String getOwner() { return owner; }
    int getBalance() { return balance; }

    boolean deposit(int amount) {
        if (amount <= 0) return false;
        balance += amount;
        return true;
    }

    boolean withdraw(int amount) {
        if (amount <= 0 || amount > balance) return false;
        balance -= amount;
        return true;
    }
}`,
      cpp: `#include <iostream>
#include <string>
#include <utility>
#include <vector>

class BankAccount {
public:
    BankAccount(std::string owner, int balance) : owner_(std::move(owner)), balance_(balance) {}

    const std::string& owner() const { return owner_; }
    int balance() const { return balance_; }

    bool deposit(int amount) {
        if (amount <= 0) return false;
        balance_ += amount;
        return true;
    }

    bool withdraw(int amount) {
        if (amount <= 0 || amount > balance_) return false;
        balance_ -= amount;
        return true;
    }

private:
    std::string owner_;
    int balance_;
};

int main() {
    BankAccount account("Aigerim", 1000);
    std::vector<std::pair<std::string, int>> operations = {{"Deposit", 500}, {"Withdraw", 2000}, {"Withdraw", 300}, {"Deposit", -50}};
    for (const auto& [name, amount] : operations) {
        bool done = name == "Deposit" ? account.deposit(amount) : account.withdraw(amount);
        std::cout << name << " " << amount << ": " << (done ? "ok" : "refused") << ", balance " << account.balance() << std::endl;
    }
    std::cout << account.owner() << " has " << account.balance() << std::endl;
    return 0;
}`,
      csharp: `using System;

class BankAccount
{
    public string Owner { get; }
    public int Balance { get; private set; }

    public BankAccount(string owner, int balance)
    {
        Owner = owner;
        Balance = balance;
    }

    public bool Deposit(int amount)
    {
        if (amount <= 0) return false;
        Balance += amount;
        return true;
    }

    public bool Withdraw(int amount)
    {
        if (amount <= 0 || amount > Balance) return false;
        Balance -= amount;
        return true;
    }
}

class Program
{
    static void Main()
    {
        var account = new BankAccount("Aigerim", 1000);
        var operations = new (string Name, int Amount)[] { ("Deposit", 500), ("Withdraw", 2000), ("Withdraw", 300), ("Deposit", -50) };
        foreach (var (name, amount) in operations)
        {
            bool done = name == "Deposit" ? account.Deposit(amount) : account.Withdraw(amount);
            Console.WriteLine($"{name} {amount}: {(done ? "ok" : "refused")}, balance {account.Balance}");
        }
        Console.WriteLine($"{account.Owner} has {account.Balance}");
    }
}`,
    },
  },
};

const PROBLEM_LABEL: Record<Language, string> = { kk: "Есеп", ru: "Задача", en: "Problem" };

/** A practice problem with its complete solution, or null when the request is not for one. */
export function exerciseFor(prompt: string, language: CodeLanguage, lang: Language, topic = exerciseTopic(prompt)): CodeResult | null {
  if (!topic) return null;
  const ex = EXERCISES[topic];
  const comment = language === "python" ? "#" : "//";
  const header = wrap(`${PROBLEM_LABEL[lang]}: ${ex.statement[lang]}`, 90).map((line) => `${comment} ${line}`).join("\n");
  return {
    language,
    code: `${header}\n\n${ex.code[language]}`,
    explanation: `${PROBLEM_LABEL[lang]}: ${ex.statement[lang]}\n\n${ex.explanation[lang]}`,
    sampleInput: "-",
    sampleOutput: ex.output,
    provider: "offline",
  };
}

/** The topic named anywhere in the request, for a fallback when the AI's answer is unusable. */
export function anyTopic(prompt: string): Topic | null {
  for (const [topic, re] of TOPICS) if (re.test(prompt)) return topic;
  return null;
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}
