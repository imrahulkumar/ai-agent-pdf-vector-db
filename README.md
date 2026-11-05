# 📄 Chat with your PDF (AI Agent + Vector Database)

Upload a PDF, then ask questions about it in plain English. The app finds the parts of your PDF that matter and uses AI to answer **based only on what's in the file**. It also shows you which pages the answer came from.

<img width="1434" height="815" alt="Chat with PDF screenshot" src="https://github.com/user-attachments/assets/c9378424-b759-4083-8d28-d319f73f5492" />
<img width="1367" height="713" alt="Upload screenshot" src="https://github.com/user-attachments/assets/692d0030-99a5-4f9b-900c-e426d64c1f9d" />
<img width="1430" height="740" alt="Sources screenshot" src="https://github.com/user-attachments/assets/fe29378d-1a2f-4b38-8343-c59e02f17b9f" />

---

## 📚 Table of Contents

1. [What does this app do?](#-what-does-this-app-do)
2. [Key words explained (for beginners)](#-key-words-explained-for-beginners)
3. [How it works (the big picture)](#-how-it-works-the-big-picture)
4. [Project folder structure](#-project-folder-structure)
5. [What you need before starting](#-what-you-need-before-starting)
6. [Step-by-step setup](#-step-by-step-setup)
7. [Using the app](#-using-the-app)
8. [Common problems and fixes](#-common-problems-and-fixes)
9. [Tech stack](#-tech-stack)

---

## 🤔 What does this app do?

Think of it like this: you hand a long book to a very fast assistant. When you ask a question, the assistant:

1. Flips to the 2 most relevant passages in the book.
2. Reads only those passages.
3. Answers your question using them, and says "I don't know" if the answer isn't there.

This approach is called **RAG** (Retrieval-Augmented Generation). It's one of the most common ways to build AI apps that work with your own documents.

---

## 🧠 Key words explained (for beginners)

| Word | What it means in simple terms |
| --- | --- |
| **PDF chunk** | A PDF is too big to give to the AI all at once, so we cut it into small pieces of about 1000 characters each. Each piece is a "chunk". |
| **Embedding** | A list of numbers that describes the *meaning* of some text. Texts with similar meaning get similar numbers. For example, "car" and "vehicle" end up close together. |
| **Vector database** | A database that stores embeddings and can quickly find the ones that are *most similar* to a question. We use **Qdrant**. |
| **Queue** | A to-do list for the computer. When you upload a PDF, we add a "process this PDF" task to the list instead of making you wait. We use **BullMQ**. |
| **Valkey / Redis** | A super-fast in-memory database. Here it only stores the queue's to-do list. (Valkey is a free, open-source version of Redis.) |
| **Worker** | A separate background program that keeps checking the queue and does the slow work: reading the PDF, cutting it up, and saving it to Qdrant. |
| **LLM** | "Large Language Model", the AI that writes the answer. We use Google **Gemini**. |
| **Docker** | A tool that runs ready-made software (like Qdrant and Valkey) in isolated boxes called *containers*, so you don't have to install them yourself. |
| **Clerk** | A service that handles sign-up and log-in for the website. |

---

## 🗺️ How it works (the big picture)

There are **two flows**: uploading a PDF, and asking a question.

### 1️⃣ Uploading a PDF

```
  You (browser)                Server (port 3001)             Valkey (queue)             Worker                    Qdrant (vector DB)
  ─────────────                ──────────────────             ──────────────             ──────                    ──────────────────
  Pick a PDF  ───upload───►  Saves file to /uploads
                             Adds a job to the queue ───►  "Process file X" ───►  Picks up the job
                             Replies "uploaded" ✅                                  1. Reads the PDF
                                                                                    2. Splits it into chunks
                                                                                    3. Turns each chunk into an
                                                                                       embedding (via Gemini)
                                                                                    4. Saves them ──────────────►  Stored ✅
```

### 2️⃣ Asking a question

```
  You (browser)                       Server (port 3001)                                   Qdrant / Gemini
  ─────────────                       ──────────────────                                   ───────────────
  "What is chapter 2 about?" ───►  1. Turns your question into an embedding ──────────►  Gemini
                                   2. Asks Qdrant for the 2 most similar chunks ──────►  Qdrant
                                   3. Sends question + those chunks to the AI ────────►  Gemini
  Answer + sources  ◄───────────── 4. Returns the AI's answer and the chunks used
```

---

## 📁 Project folder structure

```
ai-agent-pdf-vectorDB/
├── docker-compose.yml          ← Starts Qdrant (vector DB) and Valkey (queue) with one command
│
├── server/                     ← The backend (Node.js + Express)
│   ├── index.js                ← The API server: handles uploads (/upload/pdf) and questions (/chat)
│   ├── worker.js               ← Background worker: reads PDFs and saves them to Qdrant
│   ├── .env.example            ← Template for your secret settings (copy it to .env)
│   ├── uploads/                ← Uploaded PDFs are saved here (you create this folder)
│   └── package.json
│
└── client/ai-agent-pdf-vector-db/   ← The frontend website (Next.js + React)
    ├── app/page.tsx            ← The main page: upload box on the left, chat on the right
    ├── app/layout.tsx          ← Page layout + sign-in / sign-up buttons (Clerk)
    ├── proxy.ts                ← Clerk login middleware
    └── package.json
```

---

## ✅ What you need before starting

Install these on your computer first:

| Tool | Why you need it | How to check it's installed |
| --- | --- | --- |
| [**Node.js**](https://nodejs.org/) v20.19 or newer (LTS recommended) | Runs the server, the worker, and the website | `node -v` |
| [**Docker Desktop**](https://www.docker.com/products/docker-desktop/) | Runs Qdrant and Valkey for you | `docker -v` |
| [**Git**](https://git-scm.com/downloads) | Downloads this project | `git --version` |

You also need **two free accounts** to get API keys:

| Account | What to get | Where |
| --- | --- | --- |
| **Google AI Studio** | A **Gemini API key** (used for embeddings *and* for writing answers) | https://aistudio.google.com/apikey |
| **Clerk** | A **Publishable key** and a **Secret key** (used for log-in) | https://dashboard.clerk.com → create an application → **API Keys** |

> 🔐 **Keep your keys secret.** Never share them or commit them to GitHub. The `.env` files that hold them are already listed in `.gitignore`.

---

## 🚀 Step-by-step setup

You'll open **4 terminal windows** in total. Don't worry, each step says which one to use.

### Step 1: Download the project

```bash
git clone https://github.com/imrahulkumar/ai-agent-pdf-vector-db.git
cd ai-agent-pdf-vector-db
```

### Step 2: Start the databases (Qdrant + Valkey)

Make sure **Docker Desktop is open and running**, then in the project folder run:

```bash
docker compose up -d
```

- `up` starts the containers, and `-d` runs them in the background.
- To check that Qdrant is running, open http://localhost:6333/dashboard in your browser. You should see the Qdrant dashboard.

### Step 3: Set up the server

```bash
cd server
npm install
mkdir uploads
cp .env.example .env
```

- `npm install` downloads the libraries the server needs.
- `mkdir uploads` creates the folder where uploaded PDFs are saved. **The server won't create it for you, so uploads fail without it.**
- `cp .env.example .env` makes your own settings file. (On Windows Command Prompt, use `copy .env.example .env`.)

Now open `server/.env` in any text editor and paste your Gemini key:

```env
GEMINI_API_KEY=paste-your-gemini-key-here
```

You can leave everything else as it is. The defaults already point to the Docker containers from Step 2.

> ℹ️ The `OPENAI_API_KEY` line in the file isn't used right now. The app only uses Gemini.

### Step 4: Start the API server (Terminal 1)

Still inside the `server` folder:

```bash
npm start
```

✅ You should see: `Server is running on http://localhost:3001`

### Step 5: Start the worker (Terminal 2)

Open a **new** terminal window, go to the `server` folder, and run:

```bash
cd server
npm run worker
```

✅ You should see: `Worker listening on queue "file-upload-queue"`

> ⚠️ Run `npm start` and `npm run worker` in **two separate terminals**. Don't use `npm run dev`, because it starts only the server and never reaches the worker.

### Step 6: Set up the website (Terminal 3)

Open a **new** terminal, then:

```bash
cd client/ai-agent-pdf-vector-db
npm install
```

Create a file named `.env.local` inside `client/ai-agent-pdf-vector-db/` and add your Clerk keys:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx

# Optional: only needed if your server is NOT at http://localhost:3001
# NEXT_PUBLIC_API_URL=http://localhost:3001
```

Then start the website:

```bash
npm run dev
```

✅ You should see a line containing `http://localhost:3000`

### Step 7: Open the app 🎉

Go to **http://localhost:3000** in your browser.

**Quick checklist.** Everything below should be running:

| What | Where | Started with |
| --- | --- | --- |
| Qdrant + Valkey | Docker | `docker compose up -d` |
| API server | Terminal 1 (`server/`) | `npm start` |
| Worker | Terminal 2 (`server/`) | `npm run worker` |
| Website | Terminal 3 (`client/ai-agent-pdf-vector-db/`) | `npm run dev` |

---

## 💬 Using the app

1. **Sign up / Sign in** with the buttons at the top right. The app only appears after you log in.
2. **Upload a PDF** on the left side: drag and drop it, or click to choose a file, then press **Upload**.
3. **Wait a few seconds.** Look at the **worker terminal** (Terminal 2). When it prints `Job ... done: N chunks`, your PDF is ready.
4. **Ask a question** in the chat box on the right, for example *"Summarize this document"*.
5. Click **Sources** under any answer to see exactly which parts of the PDF (and which page) the answer came from.

### Stopping everything

- In each terminal, press `Ctrl + C`.
- Stop the databases with:
  ```bash
  docker compose down
  ```
  > Note: This setup doesn't save Qdrant data to your disk, so `docker compose down` **deletes your stored PDFs' data**. You'll need to upload them again next time.

---

## 🛠️ Common problems and fixes

| Problem | Likely cause | Fix |
| --- | --- | --- |
| Server crashes with `No embeddings API key found` | `GEMINI_API_KEY` is missing | Add it to `server/.env`, then restart `npm start` and `npm run worker`. |
| Upload fails with `ENOENT ... uploads/` | The `uploads` folder doesn't exist | Run `mkdir uploads` inside the `server` folder. |
| `connect ECONNREFUSED 127.0.0.1:6379` | Valkey (queue) isn't running | Open Docker Desktop and run `docker compose up -d`. |
| `connect ECONNREFUSED ... 6333` or "collection not found" | Qdrant isn't running, or you haven't uploaded any PDF yet | Start Docker, upload a PDF, and wait for the worker to say `done`. |
| You upload a PDF but the answer is "I don't know" | The worker isn't running, or hasn't finished yet | Check Terminal 2. It must be running and must say `Job ... done`. |
| "Could not reach the server at http://localhost:3001" | The API server isn't running | Start it with `npm start` in the `server` folder. |
| "The AI model's quota is exhausted" (error 429) | Your free Gemini limit was reached | Wait a while, or set a different `CHAT_MODEL` in `server/.env`. |
| The website shows a Clerk error / blank page | Clerk keys are missing or wrong | Check `client/ai-agent-pdf-vector-db/.env.local`, then restart `npm run dev`. |
| `docker: command not found` or "Cannot connect to the Docker daemon" | Docker isn't installed or not open | Install and open Docker Desktop. |

**Changed a `.env` file?** Always restart the program that uses it, because settings are only read at startup.

---

## 🧰 Tech stack

| Part | Technology |
| --- | --- |
| Website (frontend) | [Next.js](https://nextjs.org/), [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/) |
| Login | [Clerk](https://clerk.com/) |
| API server (backend) | [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [Multer](https://github.com/expressjs/multer) (file uploads) |
| Background jobs | [BullMQ](https://docs.bullmq.io/) + [Valkey](https://valkey.io/) |
| AI toolkit | [LangChain.js](https://js.langchain.com/) (PDF loading, text splitting, retrieval) |
| Vector database | [Qdrant](https://qdrant.tech/) |
| AI model | [Google Gemini](https://ai.google.dev/) (embeddings + chat) |

### Optional settings (`server/.env`)

| Setting | Default | What it does |
| --- | --- | --- |
| `GEMINI_API_KEY` | none (**required**) | Your Google Gemini key |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Model that turns text into embeddings |
| `CHAT_MODEL` | `gemini-3.8-flash` | Model that writes the answers |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | Where Valkey is running |
| `QDRANT_URL` | `http://localhost:6333` | Where Qdrant is running |
| `QDRANT_COLLECTION` | `pdf-docs` | Name of the "table" in Qdrant where chunks are stored |
| `QDRANT_API_KEY` | none | Only needed for a hosted / cloud Qdrant |

> 💡 If you change `EMBEDDING_MODEL` after uploading PDFs, upload them again (or use a new `QDRANT_COLLECTION` name). Embeddings from different models can't be compared with each other.
