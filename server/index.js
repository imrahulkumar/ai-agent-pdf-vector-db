import express from "express";
import cors from "cors";
import multer from "multer";
import { Queue } from 'bullmq';
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const COLLECTION_NAME = process.env.QDRANT_COLLECTION ?? "pdf-docs";

const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  checkCompatibility: false,
});
const embeddings = createEmbeddings();
const chatModel = createChatModel();

const queueName = 'file-upload-queue';
const queue = new Queue(queueName, {
  connection: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

const app = express();
const port = 3001;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/upload/pdf", upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }
  await queue.add(queueName, {
    filename: req.file.originalname,
    destination: req.file.destination,
    path: req.file.path,
  });
  return res.json({ message: "uploaded" });
});


app.get("/chat", async (req, res) => {
  const userQuery = String(req.query.message ?? "").trim();
  if (!userQuery) {
    return res.status(400).json({ message: "Query param 'message' is required." });
  }

  try {
    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
      client: qdrantClient,
      collectionName: COLLECTION_NAME,
    });
    const retriever = vectorStore.asRetriever({ k: 2 });
    const results = await retriever.invoke(userQuery);

    const SYSTEM_PROMPT = `
  You are a helpful AI Assistant who answers the user query based on the available context from PDF File.
  If the answer is not in the context, say you don't know.
  Context:
  ${JSON.stringify(results)}
  `;

    const chatResult = await chatModel.invoke([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userQuery },
    ]);

    return res.json({
      message: chatResult.content,
      docs: results,
    });
  } catch (err) {
    if (err?.status === 429) {
      console.warn("Chat rate limited:", err.message);
      return res.status(429).json({
        message: "The AI model's quota is exhausted. Try again later or switch CHAT_MODEL in server/.env.",
      });
    }
    console.error("Chat failed:", err);
    return res.status(500).json({ message: err.message ?? "Chat failed." });
  }
});

function createEmbeddings() {
  // Gemini via its OpenAI-compatible endpoint
  if (process.env.GEMINI_API_KEY) {
    return new OpenAIEmbeddings({
      model: process.env.EMBEDDING_MODEL ?? "gemini-embedding-001",
      apiKey: process.env.GEMINI_API_KEY,
      configuration: { baseURL: GEMINI_BASE_URL },
      encodingFormat: "float",
      batchSize: 100,
    });
  }
  throw new Error(
    "No embeddings API key found. Set GEMINI_API_KEY in server/.env"
  );
}

function createChatModel() {
  return new ChatOpenAI({
    model: process.env.CHAT_MODEL ?? "gemini-3.8-flash",
    apiKey: process.env.GEMINI_API_KEY,
    configuration: { baseURL: GEMINI_BASE_URL },
  });
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
