"use client";

import { useEffect, useRef, useState } from "react";

type SourceDoc = {
  pageContent: string;
  metadata?: {
    source?: string;
    loc?: { pageNumber?: number };
  };
};

type Message = {
  role: "user" | "assistant";
  text: string;
  docs?: SourceDoc[];
  error?: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type UploadStatus =
  | { state: "idle" }
  | { state: "uploading"; progress: number }
  | { state: "success"; message: string }
  | { state: "error"; message: string };

function uploadPdf(
  file: File,
  onProgress: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("pdf", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/upload/pdf`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let message = xhr.responseText;
      try {
        message = JSON.parse(xhr.responseText).message ?? message;
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(message);
      else reject(new Error(message || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () =>
      reject(new Error(`Could not reach the server at ${API_URL}`));
    xhr.send(formData);
  });
}

async function sendChat(
  message: string
): Promise<{ message: string; docs: SourceDoc[] }> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/chat?message=${encodeURIComponent(message)}`);
  } catch {
    throw new Error(`Could not reach the server at ${API_URL}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Chat failed (${res.status})`);
  return { message: String(data.message ?? ""), docs: data.docs ?? [] };
}

function sourceLabel(doc: SourceDoc) {
  const file = doc.metadata?.source?.split("/").pop() ?? "Unknown file";
  // Strip the "<timestamp>-<random>-" prefix multer adds to uploaded files
  const name = file.replace(/^\d+-\d+-/, "");
  const page = doc.metadata?.loc?.pageNumber;
  return page ? `${name} · p.${page}` : name;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>({ state: "idle" });
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSend = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setIsSending(true);
    try {
      const { message, docs } = await sendChat(text);
      setMessages((prev) => [...prev, { role: "assistant", text: message, docs }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: err instanceof Error ? err.message : "Something went wrong.",
          error: true,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const selectFile = (f: File | null) => {
    if (f && f.type !== "application/pdf") {
      setFile(null);
      setStatus({ state: "error", message: "Only PDF files are allowed." });
      return;
    }
    setFile(f);
    setStatus({ state: "idle" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectFile(e.target.files?.[0] ?? null);
    e.target.value = ""; // allow re-selecting the same file
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    selectFile(e.dataTransfer.files?.[0] ?? null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus({ state: "uploading", progress: 0 });
    try {
      const message = await uploadPdf(file, (progress) =>
        setStatus({ state: "uploading", progress })
      );
      setStatus({ state: "success", message });
      setUploaded((prev) => [file.name, ...prev]);
      setFile(null);
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Upload failed.",
      });
    }
  };

  const isUploading = status.state === "uploading";

  return (
    <div className="flex flex-1 h-[calc(100vh-4rem)] border-t border-zinc-200 dark:border-zinc-800">
      {/* Left: file upload */}
      <aside className="w-1/3 min-w-60 flex flex-col items-center justify-center gap-4 p-6">
        <h2 className="text-lg font-semibold">Upload PDF</h2>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-1 w-full max-w-xs h-40 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            dragging
              ? "border-purple-700 bg-purple-50 dark:bg-purple-950/30"
              : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <span className="text-sm text-zinc-500">
            Drag & drop or click to choose
          </span>
          <span className="text-xs text-zinc-400">PDF only</span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>

        {file && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate max-w-xs">
            Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}

        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || isUploading}
          className="w-full max-w-xs rounded-lg bg-purple-700 px-5 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "Uploading..." : "Upload"}
        </button>

        {status.state === "uploading" && (
          <div className="w-full max-w-xs">
            <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-purple-700 transition-all"
                style={{ width: `${status.progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500 text-right">
              {status.progress}%
            </p>
          </div>
        )}
        {status.state === "success" && (
          <p className="text-sm text-green-600 max-w-xs text-center">
            {status.message}
          </p>
        )}
        {status.state === "error" && (
          <p className="text-sm text-red-600 max-w-xs text-center">
            {status.message}
          </p>
        )}

        {uploaded.length > 0 && (
          <div className="w-full max-w-xs">
            <h3 className="text-xs font-semibold uppercase text-zinc-500 mb-1">
              Uploaded
            </h3>
            <ul className="space-y-1">
              {uploaded.map((name, i) => (
                <li
                  key={`${name}-${i}`}
                  className="text-sm truncate text-zinc-600 dark:text-zinc-400"
                >
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      {/* Vertical divider */}
      <div className="w-px bg-zinc-200 dark:bg-zinc-800" />

      {/* Right: chat */}
      <section className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-zinc-500 mt-10">
              Ask a question about your PDF
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-purple-700 text-white"
                      : m.error
                        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                        : "bg-zinc-100 dark:bg-zinc-800"
                  }`}
                >
                  {m.text}
                  {m.docs && m.docs.length > 0 && (
                    <details className="mt-2 whitespace-normal">
                      <summary className="cursor-pointer text-xs text-zinc-500">
                        Sources ({m.docs.length})
                      </summary>
                      <ul className="mt-1 space-y-2">
                        {m.docs.map((doc, j) => (
                          <li
                            key={j}
                            className="rounded border border-zinc-200 dark:border-zinc-700 p-2 text-xs"
                          >
                            <p className="font-medium text-zinc-600 dark:text-zinc-300">
                              {sourceLabel(doc)}
                            </p>
                            <p className="mt-1 text-zinc-500 line-clamp-3">
                              {doc.pageContent}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            ))
          )}
          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-lg px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-500 animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSend}
          className="flex gap-2 p-4 border-t border-zinc-200 dark:border-zinc-800"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2 text-sm outline-none focus:border-purple-700"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="rounded-lg bg-purple-700 px-5 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </form>
      </section>
    </div>
  );
}
