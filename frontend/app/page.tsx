"use client";

import { useMemo, useState } from "react";

type AskResponse = {
  answer: string;
  retrieved_sources: string[];
  top_matches: { score: number; text: string; meta: any }[];
};

export default function Home() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

  const [files, setFiles] = useState<FileList | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const [question, setQuestion] = useState(
    "What PPE is required for grinding operations?"
  );
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<AskResponse | null>(null);

  const curl = useMemo(() => {
    return `curl -X POST "${API_BASE}/ask" \\
  -H "Content-Type: application/json" \\
  -d '{"question":"${question.replaceAll('"', '\\"')}", "top_k": ${topK}}'`;
  }, [API_BASE, question, topK]);

  async function onAsk() {
    setLoading(true);
    setErr(null);
    setData(null);

    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, top_k: topK }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Backend error (${res.status}): ${txt}`);
      }

      const json = (await res.json()) as AskResponse;
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function onUpload() {
    setUploadMsg(null);
    setErr(null);

    if (!files || files.length === 0) {
      setUploadMsg("Please choose at least one PDF.");
      return;
    }

    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));

      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Upload failed (${res.status}): ${txt}`);
      }

      const json = await res.json();
      setUploadMsg(
        `✅ Uploaded: ${json.saved.join(", ")} | chunks: ${json.chunks}`
      );
    } catch (e: any) {
      setUploadMsg(`❌ ${e?.message || "Upload failed"}`);
    }
  }

  return (
    <main className="min-h-screen p-6 md:p-10 bg-gray-50">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Safety Assistant</h1>
          <p className="text-gray-600">
            Ask questions and get answers grounded in your ingested safety docs.
          </p>
        </header>

        {/* New upload section */}
        <section className="bg-white rounded-xl shadow p-4 md:p-6 space-y-3">
          <div className="text-sm font-semibold text-gray-700">Upload PDFs</div>

          <input
            id="pdf-upload"
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => setFiles(e.target.files)}
          />

          <div className="flex items-center gap-3">
            <label
              htmlFor="pdf-upload"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 active:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            >
              Select PDFs
            </label>

            {files && files.length > 0 && (
              <ul className="mt-2 text-sm text-gray-700 list-disc ml-5">
                {Array.from(files).map((f) => (
                  <li key={f.name}>{f.name}</li>
                ))}
              </ul>
            )}

            <button
              onClick={onUpload}
              disabled={!files || files.length === 0}
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            >
              Upload & Index
            </button>
          </div>

          {uploadMsg && (
            <pre className="text-sm whitespace-pre-wrap bg-gray-500 p-3 rounded-lg">
              {uploadMsg}
            </pre>
          )}
        </section>

        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            Ask a question
          </label>

          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            placeholder="e.g. What PPE is required for grinding operations?"
          />

          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">
              Top K:
              <input
                type="number"
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="ml-2 w-16 rounded border border-gray-300 p-1 text-sm"
              />
            </label>

            <button
              onClick={onAsk}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {loading ? "Asking..." : "Ask"}
            </button>
          </div>
        </div>

        {err && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {data && (
          <div className="rounded-lg bg-gray-50 p-4 space-y-3 text-sm">
            <div>
              <div className="font-semibold">Answer</div>
              <pre className="whitespace-pre-wrap">{data.answer}</pre>
            </div>

            <div>
              <div className="font-semibold">Sources</div>
              <ul className="list-disc ml-5">
                {data.retrieved_sources.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
