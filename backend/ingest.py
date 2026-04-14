import os
import json
from dotenv import load_dotenv
load_dotenv()

import fitz  # PyMuPDF
from google import genai
from google.genai import types

DATA_DIR = "data"
OUT_FILE = "vector_index.json"
EMBED_MODEL = "models/gemini-embedding-001"

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("Missing GEMINI_API_KEY. Run: export GEMINI_API_KEY='...'")
client = genai.Client(api_key=api_key)


def read_pdf(path: str) -> str:
    doc = fitz.open(path)
    parts = []
    for page in doc:
        parts.append(page.get_text("text"))
    doc.close()
    return "\n".join(parts)


def load_documents(data_dir):
    """
    Loads .txt and .pdf files from data_dir.
    Returns list of tuples: (filename, text)
    """
    docs = []
    for fn in os.listdir(data_dir):
        path = os.path.join(data_dir, fn)

        if fn.lower().endswith(".txt"):
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                docs.append((fn, f.read()))

        elif fn.lower().endswith(".pdf"):
            try:
                docs.append((fn, read_pdf(path)))
            except Exception as e:
                print(f"⚠️ Failed to read PDF {fn}: {e}")

    return docs


def chunk_text(text, chunk_size=900, overlap=150):
    chunks = []
    n = len(text)
    start = 0

    while start < n:
        end = min(n, start + chunk_size)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= n:
            break

        start = max(0, end - overlap)

    return chunks


def embed_text(text: str) -> list[float]:
    result = client.models.embed_content(
        model=EMBED_MODEL,
        contents=text,
        config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
    )
    return result.embeddings[0].values


def build_index(data_dir=DATA_DIR):
    docs = load_documents(data_dir)
    print(f"Loaded docs: {len(docs)} -> {[d[0] for d in docs]}")

    print("Chunking...")
    texts, metas = [], []
    for fn, content in docs:
        chunks = chunk_text(content)
        for i, chunk in enumerate(chunks):
            texts.append(chunk)
            metas.append({"source": fn, "chunk": i})

    print(f"Total chunks: {len(texts)}")
    if not texts:
        raise RuntimeError("No text found. Add .txt/.pdf files to data/ and retry.")

    print("Embedding with Gemini text-embedding-004...")
    embeddings = []
    for i, t in enumerate(texts, start=1):
        embeddings.append(embed_text(t))
        if i % 25 == 0 or i == len(texts):
            print(f"Embedded {i}/{len(texts)}")

    dim = len(embeddings[0]) if embeddings else 768
    index = {
        "dim": dim,
        "texts": texts,
        "embeddings": embeddings,
        "metadata": metas,
    }

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f)

    print(f"✅ Vector index written to {OUT_FILE}")
    return index


def main():
    build_index(DATA_DIR)


if __name__ == "__main__":
    main()
