// Seeds a MySQL database with test data: 4 students × 30 history records
// (users, settings, conversations, messages, saved items: 250+ rows in total).
import { loadConfig } from "../server/config.js";
import { FileStorage } from "../server/lib/storage.js";
import { MySqlStore } from "../server/repositories/mysqlStore.js";
import { HistoryService } from "../server/services/historyService.js";
import { seedDemo } from "./demo.js";

const config = loadConfig();
const store = await MySqlStore.connect(config.mysqlUrl, config.rootDir);
const history = new HistoryService(store, new FileStorage(config.storageDir));
const students = [
  ["demo@study.kz", "Демо Студент"],
  ["aruzhan@study.kz", "Аружан Серікқызы"],
  ["timur@study.kz", "Тимур Ахметов"],
  ["anna@study.kz", "Anna Petrova"],
];
for (const [email, name] of students) {
  await seedDemo(store, history, email, name);
}
console.log(`Seeded ${students.length} students (password: demo12345)`);
await store.close();
