"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  text: string;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const handleSend = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
  };

  return (
    <div className="flex flex-1 h-[calc(100vh-4rem)] border-t border-zinc-200 dark:border-zinc-800">
      {/* Left: file upload */}
      <aside className="w-1/3 min-w-60 flex flex-col items-center justify-center gap-4 p-6">
        <h2 className="text-lg font-semibold">Upload PDF</h2>
        <label className="flex flex-col items-center justify-center w-full max-w-xs h-40 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
          <span className="text-sm text-zinc-500">Click to choose a file</span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate max-w-xs">
            Selected: {file.name}
          </p>
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
                  className={`max-w-[70%] rounded-lg px-4 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-purple-700 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))
          )}
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
            className="rounded-lg bg-purple-700 px-5 py-2 text-sm font-medium text-white hover:bg-purple-800"
          >
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
