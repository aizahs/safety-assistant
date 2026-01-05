"use client";

import { useMemo, useState } from "react";

type AskResponse = {
  answer: string;
  retrieved_sources: string[];
  top_matches: { score: number; text: string; meta: any }[];
};

export default function Home() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

  // ✅ move these INSIDE the component
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

        {/* Existing question/ask UI */}
        <section className="bg-white rounded-xl shadow p-4 md:p-6 space-y-4">
          {/* ... your existing question section unchanged ... */}
        </section>

        {/* ... err + data sections unchanged ... */}
      </div>
    </main>
  );
}
