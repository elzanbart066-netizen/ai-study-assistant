import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { logger } from "./lib/logger.js";
import { seedDemo } from "../database/demo.js";

const config = loadConfig();
const { app, store, services } = await createApp(config);

if (config.dbDriver === "memory" && config.seedDemo) {
  await seedDemo(store, services.history);
}

const server = app.listen(config.port, () => {
  logger.info("server started", {
    module: "server",
    port: config.port,
    db: config.dbDriver,
    ai: config.aiEnabled ? config.anthropicModel : "off",
  });
});

const shutdown = () => {
  server.close(() => {
    store.close().finally(() => process.exit(0));
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
