import type { CodeLanguage, CodeResult, Language } from "../../../src/models/index.js";

// Offline code helper: original, hand-written solutions for the most common
// study tasks. Used when no AI model is configured.

type Task = "factorial" | "fibonacci" | "prime" | "sort" | "reverse" | "sum";

const KEYWORDS: Record<Task, RegExp> = {
  factorial: /factorial|факториал/iu,
  fibonacci: /fibonacci|фибоначч/iu,
  prime: /prime|прост(ое|ые|ых) числ|жай сан/iu,
  sort: /sort|сортир|сұрыпта|реттеу/iu,
  reverse: /reverse|palindrom|перевер|обрат|палиндром|кері|төңкер/iu,
  sum: /\bsum\b|average|mean|сумм|средн|қосынды|орташа/iu,
};

const CODE: Record<Task, Record<CodeLanguage, string>> = {
  factorial: {
    python: `def factorial(n: int) -> int:
    if n < 0:
        raise ValueError("n must be non-negative")
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result


n = int(input())
print(factorial(n))`,
    javascript: `function factorial(n) {
  if (n < 0) throw new Error("n must be non-negative");
  let result = 1n;
  for (let i = 2n; i <= BigInt(n); i++) result *= i;
  return result;
}

const n = Number(require("fs").readFileSync(0, "utf8").trim());
console.log(factorial(n).toString());`,
    java: `import java.math.BigInteger;
import java.util.Scanner;

public class Main {
    static BigInteger factorial(int n) {
        BigInteger result = BigInteger.ONE;
        for (int i = 2; i <= n; i++) result = result.multiply(BigInteger.valueOf(i));
        return result;
    }

    public static void main(String[] args) {
        int n = new Scanner(System.in).nextInt();
        System.out.println(factorial(n));
    }
}`,
    cpp: `#include <iostream>

unsigned long long factorial(int n) {
    unsigned long long result = 1;
    for (int i = 2; i <= n; ++i) result *= i;  // fits up to n = 20
    return result;
}

int main() {
    int n;
    std::cin >> n;
    std::cout << factorial(n) << std::endl;
}`,
    csharp: `using System;
using System.Numerics;

class Program {
    static BigInteger Factorial(int n) {
        BigInteger result = 1;
        for (int i = 2; i <= n; i++) result *= i;
        return result;
    }

    static void Main() {
        int n = int.Parse(Console.ReadLine());
        Console.WriteLine(Factorial(n));
    }
}`,
  },
  fibonacci: {
    python: `def fibonacci(count: int) -> list[int]:
    numbers = []
    a, b = 0, 1
    for _ in range(count):
        numbers.append(a)
        a, b = b, a + b
    return numbers


n = int(input())
print(*fibonacci(n))`,
    javascript: `function fibonacci(count) {
  const numbers = [];
  let a = 0, b = 1;
  for (let i = 0; i < count; i++) {
    numbers.push(a);
    [a, b] = [b, a + b];
  }
  return numbers;
}

const n = Number(require("fs").readFileSync(0, "utf8").trim());
console.log(fibonacci(n).join(" "));`,
    java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        int n = new Scanner(System.in).nextInt();
        long a = 0, b = 1;
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < n; i++) {
            out.append(a).append(i + 1 < n ? " " : "");
            long next = a + b;
            a = b;
            b = next;
        }
        System.out.println(out);
    }
}`,
    cpp: `#include <iostream>

int main() {
    int n;
    std::cin >> n;
    long long a = 0, b = 1;
    for (int i = 0; i < n; ++i) {
        std::cout << a << (i + 1 < n ? " " : "\\n");
        long long next = a + b;
        a = b;
        b = next;
    }
}`,
    csharp: `using System;
using System.Collections.Generic;

class Program {
    static void Main() {
        int n = int.Parse(Console.ReadLine());
        var numbers = new List<long>();
        long a = 0, b = 1;
        for (int i = 0; i < n; i++) {
            numbers.Add(a);
            (a, b) = (b, a + b);
        }
        Console.WriteLine(string.Join(" ", numbers));
    }
}`,
  },
  prime: {
    python: `def is_prime(n: int) -> bool:
    if n < 2:
        return False
    i = 2
    while i * i <= n:
        if n % i == 0:
            return False
        i += 1
    return True


n = int(input())
print("prime" if is_prime(n) else "not prime")`,
    javascript: `function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false;
  }
  return true;
}

const n = Number(require("fs").readFileSync(0, "utf8").trim());
console.log(isPrime(n) ? "prime" : "not prime");`,
    java: `import java.util.Scanner;

public class Main {
    static boolean isPrime(long n) {
        if (n < 2) return false;
        for (long i = 2; i * i <= n; i++) {
            if (n % i == 0) return false;
        }
        return true;
    }

    public static void main(String[] args) {
        long n = new Scanner(System.in).nextLong();
        System.out.println(isPrime(n) ? "prime" : "not prime");
    }
}`,
    cpp: `#include <iostream>

bool isPrime(long long n) {
    if (n < 2) return false;
    for (long long i = 2; i * i <= n; ++i) {
        if (n % i == 0) return false;
    }
    return true;
}

int main() {
    long long n;
    std::cin >> n;
    std::cout << (isPrime(n) ? "prime" : "not prime") << std::endl;
}`,
    csharp: `using System;

class Program {
    static bool IsPrime(long n) {
        if (n < 2) return false;
        for (long i = 2; i * i <= n; i++) {
            if (n % i == 0) return false;
        }
        return true;
    }

    static void Main() {
        long n = long.Parse(Console.ReadLine());
        Console.WriteLine(IsPrime(n) ? "prime" : "not prime");
    }
}`,
  },
  sort: {
    python: `def bubble_sort(items: list[int]) -> list[int]:
    data = items[:]
    for end in range(len(data) - 1, 0, -1):
        swapped = False
        for i in range(end):
            if data[i] > data[i + 1]:
                data[i], data[i + 1] = data[i + 1], data[i]
                swapped = True
        if not swapped:
            break
    return data


numbers = list(map(int, input().split()))
print(*bubble_sort(numbers))`,
    javascript: `function bubbleSort(items) {
  const data = [...items];
  for (let end = data.length - 1; end > 0; end--) {
    let swapped = false;
    for (let i = 0; i < end; i++) {
      if (data[i] > data[i + 1]) {
        [data[i], data[i + 1]] = [data[i + 1], data[i]];
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return data;
}

const numbers = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
console.log(bubbleSort(numbers).join(" "));`,
    java: `import java.util.Arrays;
import java.util.Scanner;

public class Main {
    static void bubbleSort(int[] data) {
        for (int end = data.length - 1; end > 0; end--) {
            boolean swapped = false;
            for (int i = 0; i < end; i++) {
                if (data[i] > data[i + 1]) {
                    int t = data[i]; data[i] = data[i + 1]; data[i + 1] = t;
                    swapped = true;
                }
            }
            if (!swapped) break;
        }
    }

    public static void main(String[] args) {
        String[] parts = new Scanner(System.in).nextLine().trim().split("\\\\s+");
        int[] data = Arrays.stream(parts).mapToInt(Integer::parseInt).toArray();
        bubbleSort(data);
        System.out.println(String.join(" ", Arrays.stream(data).mapToObj(String::valueOf).toArray(String[]::new)));
    }
}`,
    cpp: `#include <iostream>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

void bubbleSort(std::vector<int>& data) {
    for (size_t end = data.size(); end > 1; --end) {
        bool swapped = false;
        for (size_t i = 0; i + 1 < end; ++i) {
            if (data[i] > data[i + 1]) {
                std::swap(data[i], data[i + 1]);
                swapped = true;
            }
        }
        if (!swapped) break;
    }
}

int main() {
    std::string line;
    std::getline(std::cin, line);
    std::istringstream in(line);
    std::vector<int> data;
    for (int x; in >> x;) data.push_back(x);
    bubbleSort(data);
    for (size_t i = 0; i < data.size(); ++i) std::cout << data[i] << (i + 1 < data.size() ? " " : "\\n");
}`,
    csharp: `using System;
using System.Linq;

class Program {
    static void BubbleSort(int[] data) {
        for (int end = data.Length - 1; end > 0; end--) {
            bool swapped = false;
            for (int i = 0; i < end; i++) {
                if (data[i] > data[i + 1]) {
                    (data[i], data[i + 1]) = (data[i + 1], data[i]);
                    swapped = true;
                }
            }
            if (!swapped) break;
        }
    }

    static void Main() {
        int[] data = Console.ReadLine().Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToArray();
        BubbleSort(data);
        Console.WriteLine(string.Join(" ", data));
    }
}`,
  },
  reverse: {
    python: `text = input()
reversed_text = text[::-1]
print(reversed_text)
print("palindrome" if text == reversed_text else "not palindrome")`,
    javascript: `const text = require("fs").readFileSync(0, "utf8").replace(/\\r?\\n$/, "");
const reversed = [...text].reverse().join("");
console.log(reversed);
console.log(text === reversed ? "palindrome" : "not palindrome");`,
    java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        String text = new Scanner(System.in).nextLine();
        String reversed = new StringBuilder(text).reverse().toString();
        System.out.println(reversed);
        System.out.println(text.equals(reversed) ? "palindrome" : "not palindrome");
    }
}`,
    cpp: `#include <algorithm>
#include <iostream>
#include <string>

int main() {
    std::string text;
    std::getline(std::cin, text);
    std::string reversed(text.rbegin(), text.rend());
    std::cout << reversed << "\\n";
    std::cout << (text == reversed ? "palindrome" : "not palindrome") << std::endl;
}`,
    csharp: `using System;

class Program {
    static void Main() {
        string text = Console.ReadLine();
        char[] chars = text.ToCharArray();
        Array.Reverse(chars);
        string reversed = new string(chars);
        Console.WriteLine(reversed);
        Console.WriteLine(text == reversed ? "palindrome" : "not palindrome");
    }
}`,
  },
  sum: {
    python: `numbers = list(map(float, input().split()))
total = sum(numbers)
average = total / len(numbers) if numbers else 0
print(f"sum = {total:g}")
print(f"average = {average:g}")`,
    javascript: `const numbers = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
const total = numbers.reduce((acc, x) => acc + x, 0);
const average = numbers.length ? total / numbers.length : 0;
console.log(\`sum = \${total}\`);
console.log(\`average = \${average}\`);`,
    java: `import java.util.Arrays;
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        double[] numbers = Arrays.stream(new Scanner(System.in).nextLine().trim().split("\\\\s+"))
            .mapToDouble(Double::parseDouble).toArray();
        double total = Arrays.stream(numbers).sum();
        double average = numbers.length > 0 ? total / numbers.length : 0;
        System.out.println("sum = " + total);
        System.out.println("average = " + average);
    }
}`,
    cpp: `#include <iostream>
#include <vector>

int main() {
    std::vector<double> numbers;
    for (double x; std::cin >> x;) numbers.push_back(x);
    double total = 0;
    for (double x : numbers) total += x;
    double average = numbers.empty() ? 0 : total / numbers.size();
    std::cout << "sum = " << total << "\\naverage = " << average << std::endl;
}`,
    csharp: `using System;
using System.Linq;

class Program {
    static void Main() {
        double[] numbers = Console.ReadLine().Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(double.Parse).ToArray();
        double total = numbers.Sum();
        double average = numbers.Length > 0 ? total / numbers.Length : 0;
        Console.WriteLine($"sum = {total}");
        Console.WriteLine($"average = {average}");
    }
}`,
  },
};

const SAMPLES: Record<Task, [string, string]> = {
  factorial: ["5", "120"],
  fibonacci: ["8", "0 1 1 2 3 5 8 13"],
  prime: ["29", "prime"],
  sort: ["5 2 9 1 7", "1 2 5 7 9"],
  reverse: ["level", "level\npalindrome"],
  sum: ["4 8 15 16", "sum = 43\naverage = 10.75"],
};

const EXPLAIN: Record<Task, Record<Language, string>> = {
  factorial: {
    kk: "n! = 1·2·…·n. Цикл 2-ден n-ге дейін көбейтеді; теріс сан қабылданбайды. Үлкен n үшін ұзын бүтін сандар (BigInteger) қолданылады.",
    ru: "n! = 1·2·…·n. Цикл перемножает числа от 2 до n; отрицательные n не допускаются. Для больших n используются длинные целые.",
    en: "n! = 1·2·…·n. The loop multiplies 2..n; negative n is rejected. Big integers are used where the language supports them.",
  },
  fibonacci: {
    kk: "Әр келесі сан алдыңғы екеуінің қосындысы. Екі айнымалы (a, b) арқылы O(n) уақытта есептеледі.",
    ru: "Каждое следующее число — сумма двух предыдущих. Две переменные (a, b) дают решение за O(n).",
    en: "Each number is the sum of the previous two. Two variables (a, b) give an O(n) solution.",
  },
  prime: {
    kk: "Сан 2-ден √n-ге дейінгі бөлгіштерге тексеріледі: одан үлкен бөлгіш болса, кішісі де табылар еді.",
    ru: "Делители проверяются от 2 до √n: если бы был больший делитель, нашёлся бы и меньший.",
    en: "Divisors are tested from 2 to √n: any larger divisor would have a matching smaller one.",
  },
  sort: {
    kk: "Көпіршікпен сұрыптау: көрші элементтер салыстырылып, үлкені оңға ауысады. Ауыстыру болмаса, цикл ерте тоқтайды.",
    ru: "Сортировка пузырьком: соседние элементы сравниваются, больший сдвигается вправо. Если обменов нет — цикл останавливается.",
    en: "Bubble sort: neighbours are compared and the larger moves right. If a pass makes no swaps, the loop stops early.",
  },
  reverse: {
    kk: "Жол соңынан басына қарай оқылады. Кері жол бастапқымен тең болса, ол палиндром.",
    ru: "Строка читается с конца. Если перевёрнутая строка совпадает с исходной, это палиндром.",
    en: "The string is read from the end. If the reversed string equals the original, it is a palindrome.",
  },
  sum: {
    kk: "Сандар бір жолдан оқылып, қосындысы мен орташа мәні (қосынды / саны) шығарылады.",
    ru: "Числа читаются из одной строки, выводятся сумма и среднее (сумма / количество).",
    en: "Numbers are read from one line; the program prints their sum and average (sum / count).",
  },
};

export function detectTask(prompt: string): Task | null {
  for (const [task, re] of Object.entries(KEYWORDS) as [Task, RegExp][]) {
    if (re.test(prompt)) return task;
  }
  return null;
}

export function codeFromTemplate(prompt: string, language: CodeLanguage, lang: Language): CodeResult | null {
  const task = detectTask(prompt);
  if (!task) return null;
  const [sampleInput, sampleOutput] = SAMPLES[task];
  return {
    language,
    code: CODE[task][language],
    explanation: EXPLAIN[task][lang],
    sampleInput,
    sampleOutput,
    provider: "offline",
  };
}
