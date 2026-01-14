import os
import json
import re
import hashlib
import math
from typing import List, Dict, Any, Optional

from pydantic import BaseModel
from google import genai 
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import shutil

from fastapi.middleware.cors import CORSMiddleware



from ingest import build_index


INDEX_FILE = "vector_index.json"
GEMINI_MODEL = "models/gemini-flash-latest"  
VEC_DIMS = 512
DATA_DIR = "data"



def tokenize(text: str) -> List[str]:
    return re.findall(r"[a-zA-Z0-9']+", text.lower())

def embed_text(text: str, dims: int = VEC_DIMS) -> List[float]:
    vec = [0.0] * dims
    tokens = tokenize(text)
    if not tokens:
        return vec

    for tok in tokens:
        h = hashlib.md5(tok.encode("utf-8")).hexdigest()
        idx = int(h, 16) % dims
        vec[idx] += 1.0

    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec

def dot(a: List[float], b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))

def load_index() -> Dict[str, Any]:
    if not os.path.exists(INDEX_FILE):
        raise RuntimeError(f"Missing {INDEX_FILE}. Run: python ingest.py")
    with open(INDEX_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

try:
    index = load_index()
except Exception:
    index = None



api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("Missing GEMINI_API_KEY. Run: export GEMINI_API_KEY='...'")

client = genai.Client(api_key=api_key)

def call_gemini(prompt: str) -> str:
    resp = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt
    )
    return resp.text or ""



app = FastAPI(title="Safety Copilot (Pure Python RAG + Gemini)")

@app.post("/upload")
async def upload(files: list[UploadFile] = File(...)):
    os.makedirs(DATA_DIR, exist_ok=True)

    saved = []
    for f in files:
        name = f.filename or "uploaded.pdf"
        if not name.lower().endswith(".pdf"):
            return JSONResponse(
                status_code=400,
                content={"error": f"Only PDF files allowed. Got: {name}"},
            )

        dest = os.path.join(DATA_DIR, name)
        with open(dest, "wb") as out:
            shutil.copyfileobj(f.file, out)

        saved.append(name)

   
    global index
    index = build_index(DATA_DIR)

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f)

    return {"ok": True, "saved": saved, "chunks": len(index["texts"])}

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://safety-assistant-kz15.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




class AskReq(BaseModel):
    question: str
    top_k: Optional[int] = 5

class JHAReq(BaseModel):
    task: str
    top_k: Optional[int] = 6

def retrieve(query: str, k: int) -> List[Dict[str, Any]]:
    qvec = embed_text(query, dims=index["dim"])
    texts = index["texts"]
    embeds = index["embeddings"]
    metas = index["metadata"]

    scored = []
    for t, e, m in zip(texts, embeds, metas):
        scored.append((dot(qvec, e), t, m))

    scored.sort(key=lambda x: x[0], reverse=True)

    out = []
    for score, text, meta in scored[:k]:
        out.append({"score": float(score), "text": text, "meta": meta})
    return out

def build_context(chunks: List[Dict[str, Any]]) -> str:
    parts = []
    for c in chunks:
        src = c["meta"].get("source", "unknown")
        ck = c["meta"].get("chunk", "?")
        parts.append(f"[Source: {src} | chunk: {ck}]\n{c['text']}")
    return "\n\n".join(parts)

@app.get("/health")
def health():
    return {"ok": True, "chunks": 0 if not index else len(index["texts"]), "model": GEMINI_MODEL}

@app.post("/ask")
def ask(req: AskReq):
    global index
    if index is None:
        index = load_index()
    chunks = retrieve(req.question, req.top_k or 5)
    context = build_context(chunks)
    sources = sorted({c["meta"].get("source", "unknown") for c in chunks})

    prompt = f"""
You are Safety Co-Pilot for a construction/infrastructure company.
Answer using ONLY the information in the Sources below.
If the sources are insufficient, say what's missing and what document would be needed.

Question:
{req.question}

Sources:
{context}

Return:
1) Answer (bullets)
2) Citations (list source files used)
"""

    answer = call_gemini(prompt)
    return {"answer": answer, "retrieved_sources": sources, "top_matches": chunks}

@app.post("/task-to-jha")
def task_to_jha(req: JHAReq):
    global index
    if index is None:
        index = load_index()
    chunks = retrieve(req.task, req.top_k or 6)
    context = build_context(chunks)
    sources = sorted({c["meta"].get("source", "unknown") for c in chunks})

    prompt = f"""
Create a Job Hazard Analysis (JHA) for the task below.
Use ONLY the Sources. If you must assume something, label it clearly as an assumption.

Task:
{req.task}

Sources:
{context}

Output in a table-like format:
Step | Hazards | Controls | PPE

Then:
Citations: list the source files used
"""

    jha = call_gemini(prompt)
    return {"jha": jha, "retrieved_sources": sources, "top_matches": chunks}
