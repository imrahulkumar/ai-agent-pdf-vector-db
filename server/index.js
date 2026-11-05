import express from "express";
import cors from "cors";
import multer from "multer";
import { Queue } from 'bullmq';

const queueName = 'file-upload-queue';
const queue = new Queue(queueName);

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
  await queue.add('file-ready',
    JSON.stringify({
      filePath: req.file.path,
      destination: req.file.destination,
      path: req.file.path
    })
  );
  return res.json({ message: "uploaded" });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
