import express from "express";
import cors from "cors";
import multer from "multer";
import { Queue } from 'bullmq';

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


app.get('/chat', async (req, res) => {
  const userQuery = req.query.message;

  const embeddings = createEmbeddings();

  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client: qdrantClient,
    collectionName: COLLECTION_NAME,
  });
  const ret = vectorStore.asRetriever({
    k: 2,
  });
  // You might want to use the retriever to get relevant documents for the user query
  const results = await ret.getRelevantDocuments(userQuery);


  const SYSTEM_PROMPT = `
  You are helpful AI Assistant who answers the user query based on the available context from PDF File.
  Context:
  ${JSON.stringify(results)}
  `;

  const chatResult = await client.chat.completions.create({
    model: 'gemini-1',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userQuery },
    ],
  });

  return res.json({
    message: chatResult.choices[0].message.content,
    docs: results,
  });
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



app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
