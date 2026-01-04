import os
import json
import re
import hashlib
import math

import fitz  # PyMuPDF

DATA_DIR = "data"
OUT_FILE = "vector_index.json"
VEC_DIMS = 512


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


def tokenize(text):
    return re.findall(r"[a-zA-Z0-9']+", text.lower())


def embed_text(text, dims=VEC_DIMS):
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

    print("Embedding (pure python)...")
    embeddings = []
    for i, t in enumerate(texts, start=1):
        embeddings.append(embed_text(t))
        if i % 25 == 0 or i == len(texts):
            print(f"Embedded {i}/{len(texts)}")

    index = {
        "dim": VEC_DIMS,
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
