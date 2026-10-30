import type { CodeLanguage, CodeResult, Language } from "../../../src/models/index.js";

// Offline code helper: original, hand-written solutions for the most common
// study tasks. Used when no AI model is configured.

type Task =
  | "factorial"
  | "fibonacci"
  | "prime"
  | "sort"
  | "reverse"
  | "sum"
  | "hello"
  | "evenodd"
  | "maxmin"
  | "gcd"
  | "leapyear"
  | "table"
  | "digits"
  | "words"
  | "temperature"
  | "binsearch";

// Checked in order: more specific tasks come before the general ones they overlap with.
const KEYWORDS: Record<Task, RegExp> = {
  binsearch: /binary search|бинарн|двоичн|екілік іздеу|бинарлық іздеу/iu,
  digits: /sum of (the )?digits|digit sum|сумм[аы] цифр|цифрлар(ының)? қосынды/iu,
  factorial: /factorial|факториал/iu,
  fibonacci: /fibonacci|фибоначч/iu,
  prime: /prime|прост(ое|ые|ых|ым) числ|жай сан/iu,
  gcd: /\bgcd\b|\blcm\b|greatest common|least common|(?<!\p{L})(нод|нок)(?!\p{L})|наибольш(ий|его) общ|ортақ бөлгіш|ортақ еселік|ЕҮОБ|ЕКОЕ/iu,
  leapyear: /leap year|високосн|кібісе/iu,
  evenodd: /\beven\b|\bodd\b|чётн|четн|нечётн|нечетн|жұп|тақ сан/iu,
  maxmin: /\bmax(imum)?\b|\bmin(imum)?\b|largest|smallest|biggest|максимум|минимум|наибольш|наименьш|ең үлкен|ең кіші/iu,
  table: /multiplication table|таблиц[аы] умножени|көбейту кесте/iu,
  temperature: /celsius|fahrenheit|temperature|цельси|фаренгейт|температур/iu,
  words: /count (the )?words|word count|vowel|колич\S* слов|подсчит\S* слов|гласн|сөздер(ді|дің)? сан|дауысты/iu,
  sort: /sort|сортир|сұрыпта|реттеу/iu,
  reverse: /reverse|palindrom|перевер|обрат|палиндром|кері|төңкер/iu,
  sum: /\bsum\b|average|mean|сумм|средн|қосынды|орташа/iu,
  hello: /hello|привет|сәлем|first program|первая программ|алғашқы бағдарлама|greet/iu,
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
  hello: {
    python: `name = input()
print(f"Hello, {name}!")`,
    javascript: `const name = require("fs").readFileSync(0, "utf8").trim();
console.log(\`Hello, \${name}!\`);`,
    java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        String name = new Scanner(System.in).nextLine();
        System.out.println("Hello, " + name + "!");
    }
}`,
    cpp: `#include <iostream>
#include <string>

int main() {
    std::string name;
    std::getline(std::cin, name);
    std::cout << "Hello, " << name << "!" << std::endl;
}`,
    csharp: `using System;

class Program {
    static void Main() {
        string name = Console.ReadLine();
        Console.WriteLine($"Hello, {name}!");
    }
}`,
  },
  evenodd: {
    python: `n = int(input())
print("even" if n % 2 == 0 else "odd")`,
    javascript: `const n = Number(require("fs").readFileSync(0, "utf8").trim());
console.log(n % 2 === 0 ? "even" : "odd");`,
    java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        long n = new Scanner(System.in).nextLong();
        System.out.println(n % 2 == 0 ? "even" : "odd");
    }
}`,
    cpp: `#include <iostream>

int main() {
    long long n;
    std::cin >> n;
    std::cout << (n % 2 == 0 ? "even" : "odd") << std::endl;
}`,
    csharp: `using System;

class Program {
    static void Main() {
        long n = long.Parse(Console.ReadLine());
        Console.WriteLine(n % 2 == 0 ? "even" : "odd");
    }
}`,
  },
  maxmin: {
    python: `numbers = list(map(float, input().split()))
print(f"max = {max(numbers):g}")
print(f"min = {min(numbers):g}")`,
    javascript: `const numbers = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
console.log(\`max = \${Math.max(...numbers)}\`);
console.log(\`min = \${Math.min(...numbers)}\`);`,
    java: `import java.util.Arrays;
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        double[] numbers = Arrays.stream(new Scanner(System.in).nextLine().trim().split("\\\\s+"))
            .mapToDouble(Double::parseDouble).toArray();
        System.out.println("max = " + Arrays.stream(numbers).max().getAsDouble());
        System.out.println("min = " + Arrays.stream(numbers).min().getAsDouble());
    }
}`,
    cpp: `#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::vector<double> numbers;
    for (double x; std::cin >> x;) numbers.push_back(x);
    auto [lo, hi] = std::minmax_element(numbers.begin(), numbers.end());
    std::cout << "max = " << *hi << "\\nmin = " << *lo << std::endl;
}`,
    csharp: `using System;
using System.Linq;

class Program {
    static void Main() {
        double[] numbers = Console.ReadLine().Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(double.Parse).ToArray();
        Console.WriteLine($"max = {numbers.Max()}");
        Console.WriteLine($"min = {numbers.Min()}");
    }
}`,
  },
  gcd: {
    python: `def gcd(a: int, b: int) -> int:
    while b:
        a, b = b, a % b
    return abs(a)


a, b = map(int, input().split())
g = gcd(a, b)
print(f"gcd = {g}")
print(f"lcm = {abs(a * b) // g if g else 0}")`,
    javascript: `function gcd(a, b) {
  while (b !== 0) [a, b] = [b, a % b];
  return Math.abs(a);
}

const [a, b] = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
const g = gcd(a, b);
console.log(\`gcd = \${g}\`);
console.log(\`lcm = \${g ? Math.abs(a * b) / g : 0}\`);`,
    java: `import java.util.Scanner;

public class Main {
    static long gcd(long a, long b) {
        while (b != 0) {
            long t = a % b;
            a = b;
            b = t;
        }
        return Math.abs(a);
    }

    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        long a = in.nextLong(), b = in.nextLong();
        long g = gcd(a, b);
        System.out.println("gcd = " + g);
        System.out.println("lcm = " + (g == 0 ? 0 : Math.abs(a / g * b)));
    }
}`,
    cpp: `#include <cstdlib>
#include <iostream>

long long gcd(long long a, long long b) {
    while (b != 0) {
        long long t = a % b;
        a = b;
        b = t;
    }
    return std::llabs(a);
}

int main() {
    long long a, b;
    std::cin >> a >> b;
    long long g = gcd(a, b);
    std::cout << "gcd = " << g << "\\nlcm = " << (g == 0 ? 0 : std::llabs(a / g * b)) << std::endl;
}`,
    csharp: `using System;

class Program {
    static long Gcd(long a, long b) {
        while (b != 0) (a, b) = (b, a % b);
        return Math.Abs(a);
    }

    static void Main() {
        string[] parts = Console.ReadLine().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        long a = long.Parse(parts[0]), b = long.Parse(parts[1]);
        long g = Gcd(a, b);
        Console.WriteLine($"gcd = {g}");
        Console.WriteLine($"lcm = {(g == 0 ? 0 : Math.Abs(a / g * b))}");
    }
}`,
  },
  leapyear: {
    python: `year = int(input())
is_leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
print("leap year" if is_leap else "common year")`,
    javascript: `const year = Number(require("fs").readFileSync(0, "utf8").trim());
const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
console.log(isLeap ? "leap year" : "common year");`,
    java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        int year = new Scanner(System.in).nextInt();
        boolean isLeap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
        System.out.println(isLeap ? "leap year" : "common year");
    }
}`,
    cpp: `#include <iostream>

int main() {
    int year;
    std::cin >> year;
    bool isLeap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    std::cout << (isLeap ? "leap year" : "common year") << std::endl;
}`,
    csharp: `using System;

class Program {
    static void Main() {
        int year = int.Parse(Console.ReadLine());
        bool isLeap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
        Console.WriteLine(isLeap ? "leap year" : "common year");
    }
}`,
  },
  table: {
    python: `n = int(input())
for i in range(1, 11):
    print(f"{n} x {i} = {n * i}")`,
    javascript: `const n = Number(require("fs").readFileSync(0, "utf8").trim());
for (let i = 1; i <= 10; i++) console.log(\`\${n} x \${i} = \${n * i}\`);`,
    java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        int n = new Scanner(System.in).nextInt();
        for (int i = 1; i <= 10; i++) System.out.println(n + " x " + i + " = " + n * i);
    }
}`,
    cpp: `#include <iostream>

int main() {
    int n;
    std::cin >> n;
    for (int i = 1; i <= 10; ++i) std::cout << n << " x " << i << " = " << n * i << "\\n";
}`,
    csharp: `using System;

class Program {
    static void Main() {
        int n = int.Parse(Console.ReadLine());
        for (int i = 1; i <= 10; i++) Console.WriteLine($"{n} x {i} = {n * i}");
    }
}`,
  },
  digits: {
    python: `n = abs(int(input()))
total = 0
while n > 0:
    total += n % 10
    n //= 10
print(total)`,
    javascript: `let n = Math.abs(Number(require("fs").readFileSync(0, "utf8").trim()));
let total = 0;
while (n > 0) {
  total += n % 10;
  n = Math.floor(n / 10);
}
console.log(total);`,
    java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        long n = Math.abs(new Scanner(System.in).nextLong());
        long total = 0;
        while (n > 0) {
            total += n % 10;
            n /= 10;
        }
        System.out.println(total);
    }
}`,
    cpp: `#include <cstdlib>
#include <iostream>

int main() {
    long long n;
    std::cin >> n;
    n = std::llabs(n);
    long long total = 0;
    while (n > 0) {
        total += n % 10;
        n /= 10;
    }
    std::cout << total << std::endl;
}`,
    csharp: `using System;

class Program {
    static void Main() {
        long n = Math.Abs(long.Parse(Console.ReadLine()));
        long total = 0;
        while (n > 0) {
            total += n % 10;
            n /= 10;
        }
        Console.WriteLine(total);
    }
}`,
  },
  words: {
    python: `text = input()
words = text.split()
vowels = sum(1 for ch in text.lower() if ch in "aeiouаәеёиоөуұүыіэюя")
print(f"words = {len(words)}")
print(f"vowels = {vowels}")`,
    javascript: `const text = require("fs").readFileSync(0, "utf8").trim();
const words = text.split(/\\s+/).filter(Boolean);
const vowels = [...text.toLowerCase()].filter((ch) => "aeiouаәеёиоөуұүыіэюя".includes(ch)).length;
console.log(\`words = \${words.length}\`);
console.log(\`vowels = \${vowels}\`);`,
    java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        String text = new Scanner(System.in).nextLine().trim();
        int words = text.isEmpty() ? 0 : text.split("\\\\s+").length;
        int vowels = 0;
        for (char ch : text.toLowerCase().toCharArray()) {
            if ("aeiouаәеёиоөуұүыіэюя".indexOf(ch) >= 0) vowels++;
        }
        System.out.println("words = " + words);
        System.out.println("vowels = " + vowels);
    }
}`,
    cpp: `#include <iostream>
#include <sstream>
#include <string>

// Counts Latin vowels; std::string works with bytes, so Cyrillic needs wide strings.
int main() {
    std::string text;
    std::getline(std::cin, text);
    std::istringstream stream(text);
    int words = 0;
    for (std::string w; stream >> w;) ++words;
    int vowels = 0;
    for (char ch : text) {
        if (std::string("aeiouAEIOU").find(ch) != std::string::npos) ++vowels;
    }
    std::cout << "words = " << words << "\\nvowels = " << vowels << std::endl;
}`,
    csharp: `using System;
using System.Linq;

class Program {
    static void Main() {
        string text = Console.ReadLine().Trim();
        int words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        int vowels = text.ToLower().Count(ch => "aeiouаәеёиоөуұүыіэюя".Contains(ch));
        Console.WriteLine($"words = {words}");
        Console.WriteLine($"vowels = {vowels}");
    }
}`,
  },
  temperature: {
    python: `celsius = float(input())
fahrenheit = celsius * 9 / 5 + 32
print(f"{celsius:g} °C = {fahrenheit:g} °F")`,
    javascript: `const celsius = Number(require("fs").readFileSync(0, "utf8").trim());
const fahrenheit = Math.round(((celsius * 9) / 5 + 32) * 100) / 100;
console.log(\`\${celsius} °C = \${fahrenheit} °F\`);`,
    java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        double celsius = new Scanner(System.in).nextDouble();
        double fahrenheit = celsius * 9 / 5 + 32;
        System.out.printf("%.2f °C = %.2f °F%n", celsius, fahrenheit);
    }
}`,
    cpp: `#include <iostream>

int main() {
    double celsius;
    std::cin >> celsius;
    double fahrenheit = celsius * 9 / 5 + 32;
    std::cout << celsius << " °C = " << fahrenheit << " °F" << std::endl;
}`,
    csharp: `using System;

class Program {
    static void Main() {
        double celsius = double.Parse(Console.ReadLine());
        double fahrenheit = Math.Round(celsius * 9 / 5 + 32, 2);
        Console.WriteLine($"{celsius} °C = {fahrenheit} °F");
    }
}`,
  },
  binsearch: {
    python: `def binary_search(items: list[int], target: int) -> int:
    lo, hi = 0, len(items) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if items[mid] == target:
            return mid
        if items[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1


items = sorted(map(int, input().split()))
target = int(input())
print(binary_search(items, target))`,
    javascript: `function binarySearch(items, target) {
  let lo = 0, hi = items.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid] === target) return mid;
    if (items[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

const [line, targetLine] = require("fs").readFileSync(0, "utf8").trim().split("\\n");
const items = line.trim().split(/\\s+/).map(Number).sort((a, b) => a - b);
console.log(binarySearch(items, Number(targetLine)));`,
    java: `import java.util.Arrays;
import java.util.Scanner;

public class Main {
    static int binarySearch(int[] items, int target) {
        int lo = 0, hi = items.length - 1;
        while (lo <= hi) {
            int mid = (lo + hi) >>> 1;
            if (items[mid] == target) return mid;
            if (items[mid] < target) lo = mid + 1;
            else hi = mid - 1;
        }
        return -1;
    }

    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int[] items = Arrays.stream(in.nextLine().trim().split("\\\\s+")).mapToInt(Integer::parseInt).sorted().toArray();
        int target = in.nextInt();
        System.out.println(binarySearch(items, target));
    }
}`,
    cpp: `#include <algorithm>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

int binarySearch(const std::vector<int>& items, int target) {
    int lo = 0, hi = static_cast<int>(items.size()) - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (items[mid] == target) return mid;
        if (items[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}

int main() {
    std::string line;
    std::getline(std::cin, line);
    std::istringstream stream(line);
    std::vector<int> items;
    for (int x; stream >> x;) items.push_back(x);
    std::sort(items.begin(), items.end());
    int target;
    std::cin >> target;
    std::cout << binarySearch(items, target) << std::endl;
}`,
    csharp: `using System;
using System.Linq;

class Program {
    static int BinarySearch(int[] items, int target) {
        int lo = 0, hi = items.Length - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (items[mid] == target) return mid;
            if (items[mid] < target) lo = mid + 1;
            else hi = mid - 1;
        }
        return -1;
    }

    static void Main() {
        int[] items = Console.ReadLine().Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).OrderBy(x => x).ToArray();
        int target = int.Parse(Console.ReadLine());
        Console.WriteLine(BinarySearch(items, target));
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
  hello: ["Aruzhan", "Hello, Aruzhan!"],
  evenodd: ["7", "odd"],
  maxmin: ["4 -2 9 3", "max = 9\nmin = -2"],
  gcd: ["12 18", "gcd = 6\nlcm = 36"],
  leapyear: ["2024", "leap year"],
  table: ["7", "7 x 1 = 7\n7 x 2 = 14\n…\n7 x 10 = 70"],
  digits: ["4096", "19"],
  words: ["Hello world from Almaty", "words = 4\nvowels = 6"],
  temperature: ["36.6", "36.6 °C = 97.88 °F"],
  binsearch: ["3 9 1 7 5\n7", "3"],
};

const BASE_EXPLAIN = {
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
} satisfies Record<string, Record<Language, string>>;

const EXTRA_EXPLAIN: Record<Exclude<Task, keyof typeof BASE_EXPLAIN>, Record<Language, string>> = {
  hello: {
    kk: "Бағдарлама атыңызды оқып, сәлемдеседі. Енгізу (input) мен шығарудың (print) ең қарапайым мысалы.",
    ru: "Программа читает имя и здоровается. Простейший пример ввода (input) и вывода (print).",
    en: "The program reads a name and greets it: the simplest example of input and output.",
  },
  evenodd: {
    kk: "Сан 2-ге қалдықсыз бөлінсе (n % 2 == 0) жұп, әйтпесе тақ.",
    ru: "Если число делится на 2 без остатка (n % 2 == 0), оно чётное, иначе нечётное.",
    en: "If the number divides by 2 with no remainder (n % 2 == 0) it is even, otherwise odd.",
  },
  maxmin: {
    kk: "Сандар бір жолдан оқылып, ең үлкені мен ең кішісі шығарылады. Тізім бір рет қаралады.",
    ru: "Числа читаются из одной строки; выводятся наибольшее и наименьшее. Список просматривается один раз.",
    en: "Numbers are read from one line; the largest and smallest are printed in one pass.",
  },
  gcd: {
    kk: "ЕҮОБ Евклид алгоритмімен табылады: (a, b) → (b, a mod b), b = 0 болғанша. ЕКОЕ = |a·b| / ЕҮОБ.",
    ru: "НОД находится алгоритмом Евклида: (a, b) → (b, a mod b), пока b ≠ 0. НОК = |a·b| / НОД.",
    en: "The GCD uses Euclid's algorithm: (a, b) → (b, a mod b) until b = 0. LCM = |a·b| / GCD.",
  },
  leapyear: {
    kk: "Жыл 4-ке бөлінсе кібісе, бірақ 100-ге бөлінетін жылдар 400-ге де бөлінсе ғана кібісе болады.",
    ru: "Год високосный, если делится на 4, но годы, кратные 100, високосные только если делятся и на 400.",
    en: "A year is a leap year if it divides by 4, except years divisible by 100 unless they also divide by 400.",
  },
  table: {
    kk: "Цикл 1-ден 10-ға дейін жүріп, n санын әр санға көбейтеді.",
    ru: "Цикл от 1 до 10 умножает n на каждое число.",
    en: "A loop from 1 to 10 multiplies n by each number.",
  },
  digits: {
    kk: "Соңғы цифр n % 10 арқылы алынып қосылады, содан кейін n 10-ға бүтін бөлінеді. n = 0 болғанша қайталанады.",
    ru: "Последняя цифра берётся как n % 10 и прибавляется, затем n делится нацело на 10, пока n > 0.",
    en: "The last digit (n % 10) is added, then n is divided by 10, until n reaches 0.",
  },
  words: {
    kk: "Сөздер бос орын бойынша бөлініп саналады; дауысты әріптер тізіммен салыстырылады (қазақ, орыс, латын).",
    ru: "Слова считаются по пробелам; гласные сравниваются со списком (казахские, русские, латинские).",
    en: "Words are counted by splitting on spaces; vowels are matched against a list (Kazakh, Russian, Latin).",
  },
  temperature: {
    kk: "Фаренгейт = Цельсий × 9/5 + 32. Мысалы, 100 °C = 212 °F.",
    ru: "Фаренгейт = Цельсий × 9/5 + 32. Например, 100 °C = 212 °F.",
    en: "Fahrenheit = Celsius × 9/5 + 32. For example, 100 °C = 212 °F.",
  },
  binsearch: {
    kk: "Сұрыпталған тізімнің ортасы тексеріледі де, іздеу аралығы әр қадамда екі есе қысқарады: O(log n). Табылмаса −1 шығады.",
    ru: "Проверяется середина отсортированного списка, и диапазон поиска каждый раз сокращается вдвое: O(log n). Если не найдено, выводится −1.",
    en: "The middle of the sorted list is checked and the range halves each step: O(log n). Prints −1 if not found.",
  },
};

const EXPLAIN: Record<Task, Record<Language, string>> = { ...BASE_EXPLAIN, ...EXTRA_EXPLAIN };

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
