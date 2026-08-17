import express from "express";
import cors from "cors";
import { config } from "./config";
import { repositoriesRouter } from "./routes/repositories";
import { chatRouter } from "./routes/chat";
import { searchRouter } from "./routes/search";
import { analysisRouter } from "./routes/analysis";
import { startIndexWorker } from "./queue";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/repositories", repositoriesRouter);
app.use("/api/chat", chatRouter);
app.use("/api/search", searchRouter);
app.use("/api/analysis", analysisRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, () => {
  console.log(`GitHub Knowledge Assistant API listening on :${config.port}`);
});

startIndexWorker();
