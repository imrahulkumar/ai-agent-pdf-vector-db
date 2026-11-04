import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();
const port = 3001;

app.use(express.json());
app.use(cors());
const upload = multer({ dest: "uploads/" });


app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/upload/pdf", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }
  res.send(`File ${req.file.originalname} uploaded successfully.`);
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});