import path from "node:path";
import { Worker } from "bullmq";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";

const QUEUE_NAME = "file-upload-queue";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const COLLECTION_NAME = process.env.QDRANT_COLLECTION ?? "pdf-docs";

const embeddings = createEmbeddings();

// Skip the strict client/server version check (client 1.18 vs server 1.20 is fine)
const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  checkCompatibility: false,
});

function createEmbeddings() {
  // Gemini via its OpenAI-compatible endpoint
  if (process.env.GEMINI_API_KEY) {
    return new OpenAIEmbeddings({
      model: process.env.EMBEDDING_MODEL ?? "gemini-embedding-001",
      apiKey: process.env.GEMINI_API_KEY,
      configuration: {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      },
      encodingFormat: "float",
      batchSize: 100,
    });
  }
  throw new Error(
    "No embeddings API key found. Set GEMINI_API_KEY or OPENAI_API_KEY in server/.env"
  );
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    console.log("Processing job:", job.id, job.data);

    // read the pdf from path and chunk it
    const docs = await loadAndSplitChunks({
      path: path.resolve(job.data.path),
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // embed every chunk and store it in Qdrant
    await addDocumentsToVectorStore(docs);

    return { chunks: docs.length };
  },
  {
    concurrency: 5,
    connection: {
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
  }
);

async function loadAndSplitChunks({ path, chunkSize, chunkOverlap }) {
  const loader = new PDFLoader(path);
  const rawDocuments = await loader.load();
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });
  return splitter.splitDocuments(rawDocuments);
}

async function addDocumentsToVectorStore(docs) {
  // Creates the collection on first insert if it doesn't exist yet
  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrantClient,
    collectionName: COLLECTION_NAME,
  });
  await vectorStore.addDocuments(docs);
  console.log(`Added ${docs.length} chunks to "${COLLECTION_NAME}"`);
}

worker.on("completed", (job, result) =>
  console.log(`Job ${job.id} done: ${result.chunks} chunks`)
);
worker.on("failed", (job, err) =>
  console.error(`Job ${job?.id} failed:`, err.message)
);

console.log(`Worker listening on queue "${QUEUE_NAME}"`);
