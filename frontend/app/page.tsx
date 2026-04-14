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
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [question, setQuestion] = useState("");
  const topK = 5;
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<AskResponse | null>(null);

  const curl = useMemo(() => {
    return `curl -X POST "${API_BASE}/ask" \\\n  -H "Content-Type: application/json" \\\n  -d '{"question":"${question.replaceAll('"', '\\"')}", "top_k": ${topK}}'`;
  }, [API_BASE, question]);

  async function onAsk() {
    if (!question.trim()) return;
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
    setUploadSuccess(false);
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
      setUploadSuccess(true);
      setUploadMsg(`${json.saved.join(", ")} — ${json.chunks} chunks indexed`);
    } catch (e: any) {
      setUploadMsg(e?.message || "Upload failed");
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Top Nav */}
      <nav className="bg-[#111111] px-8 py-4 flex items-center">
        <span className="text-white font-black text-xl tracking-widest uppercase">Safety Assistant</span>
        <div className="w-2 h-2 rounded-full bg-[#C8102E] mb-3 ml-1" />
      </nav>

      {/* Hero Banner */}
      <div className="relative bg-[#1a1a1a] overflow-hidden">
        {/* Red diagonal accent */}
        <div
          className="absolute right-0 top-0 h-full w-1/3"
          style={{
            background: "linear-gradient(135deg, transparent 30%, #C8102E 30%)",
            opacity: 0.15,
          }}
        />
        <div className="relative max-w-6xl mx-auto px-8 py-14">
          <div className="max-w-xl">
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight uppercase tracking-tight">
              Your Safety Docs,<br />
              <span className="text-[#C8102E]">Instantly Searchable.</span>
            </h1>
            <p className="mt-4 text-white/50 text-base max-w-md">
              Ask questions about your construction safety documents and get instant, cited answers.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">

        {/* Two-column: Upload + Ask */}
        <div className="grid md:grid-cols-5 gap-6">

          {/* Upload Card */}
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-[#C8102E] rounded-full" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Upload Documents</h2>
            </div>

            <p className="text-xs text-gray-500">
              Upload safety manuals, procedures, or site-specific PDFs to build your knowledge base.
            </p>

            <input
              id="pdf-upload"
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => { setFiles(e.target.files); setUploadMsg(null); setUploadSuccess(false); }}
            />

            <label
              htmlFor="pdf-upload"
              className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#C8102E] hover:bg-red-50/30 transition-colors"
            >
              <svg className="w-7 h-7 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
              </svg>
              <span className="text-xs text-gray-400">
                {files && files.length > 0
                  ? Array.from(files).map(f => f.name).join(", ")
                  : "Click to select PDFs"}
              </span>
            </label>

            <button
              onClick={onUpload}
              disabled={!files || files.length === 0}
              className="w-full py-2.5 rounded-xl bg-[#C8102E] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#a50d25] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Upload & Index
            </button>

            {uploadMsg && (
              <div className={`text-xs px-3 py-2 rounded-lg ${uploadSuccess ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {uploadSuccess ? "✓ " : "✗ "}{uploadMsg}
              </div>
            )}
          </div>

          {/* Ask Card */}
          <div className="md:col-span-3 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-[#C8102E] rounded-full" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Ask a Safety Question</h2>
            </div>

            <p className="text-xs text-gray-500">
              Ask about PPE requirements, procedures, hazard controls, or any safety topic covered in your documents.
            </p>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onAsk(); }}
              rows={5}
              placeholder="e.g. What PPE is required for grinding operations?"
              className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#C8102E]/30 focus:border-[#C8102E] resize-none transition"
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">⌘ + Enter to submit</span>
              <button
                onClick={onAsk}
                disabled={loading || !question.trim()}
                className="px-6 py-2.5 rounded-xl bg-[#C8102E] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#a50d25] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Searching...
                  </>
                ) : "Ask"}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {err && (
          <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">
            <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            {err}
          </div>
        )}

        {/* Answer Section */}
        {data && (
          <div className="grid md:grid-cols-3 gap-6">

            {/* Answer */}
            <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[#C8102E] rounded-full" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Answer</h2>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{data.answer}</p>
            </div>

            {/* Sources */}
            <div className="bg-[#111111] rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[#C8102E] rounded-full" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Sources</h2>
              </div>
              <ul className="space-y-2">
                {data.retrieved_sources.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-xs text-white/60">
                    <svg className="w-3.5 h-3.5 mt-0.5 text-[#C8102E] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-100 py-6 px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-gray-400">
          <span>© {new Date().getFullYear()} Safety Assistant.</span>
          <span>Answers are grounded in uploaded documents only.</span>
        </div>
      </footer>

    </div>
  );
}
