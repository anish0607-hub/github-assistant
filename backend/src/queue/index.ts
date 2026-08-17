import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config";
import { indexRepository } from "../services/indexer";

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const indexQueue = new Queue("repo-index", { connection });

export async function enqueueIndexJob(repositoryId: string): Promise<void> {
  await indexQueue.add(
    "index",
    { repositoryId },
    { removeOnComplete: 100, removeOnFail: 100, attempts: 1 }
  );
}

/** Starts the in-process worker that performs repository indexing. */
export function startIndexWorker(): Worker {
  const worker = new Worker(
    "repo-index",
    async (job) => {
      const { repositoryId } = job.data as { repositoryId: string };
      console.log(`[indexer] indexing repository ${repositoryId}`);
      await indexRepository(repositoryId);
      console.log(`[indexer] done ${repositoryId}`);
    },
    { connection, concurrency: 2 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[indexer] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
