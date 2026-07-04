import os
import pickle
import numpy as np
from sentence_transformers import SentenceTransformer

try:
    import faiss  # type: ignore
    _FAISS_AVAILABLE = True
except Exception:
    faiss = None
    _FAISS_AVAILABLE = False


class JobVectorStore:
    """
    Uses FAISS if available; otherwise falls back to in-memory cosine search.
    """

    def __init__(self, model_name: str, index_path: str):
        self.model = SentenceTransformer(model_name)
        self.index_path = index_path
        self.meta: list[dict] = []
        self.index = None
        self.embs = None  # fallback embeddings

    def load_or_create(self):
        if _FAISS_AVAILABLE and os.path.exists(self.index_path):
            self.index = faiss.read_index(self.index_path)
            with open(self.index_path + ".meta", "rb") as f:
                self.meta = pickle.load(f)
        else:
            if _FAISS_AVAILABLE:
                dim = self.model.get_sentence_embedding_dimension()
                self.index = faiss.IndexFlatIP(dim)
            else:
                self.embs = np.empty((0, self.model.get_sentence_embedding_dimension()), dtype="float32")

    def add_jobs(self, jobs: list[dict]):
        texts = [f"{j['title']} {j['description']}" for j in jobs]
        embs = self.model.encode(texts, normalize_embeddings=True)
        # Store description and other useful fields in meta so we can use them for smart match
        metas = [
            {
                "job_id": j.get("_id") or j.get("id"),
                "title": j.get("title", ""),
                "description": j.get("description", ""),
                "company": j.get("company", ""),
                "location": j.get("location", ""),
                "salary": j.get("salary", ""),
                "url": j.get("url", "")
            }
            for j in jobs
        ]
        if _FAISS_AVAILABLE:
            self.index.add(np.array(embs, dtype="float32"))
        else:
            self.embs = np.vstack([self.embs, np.array(embs, dtype="float32")])
        self.meta.extend(metas)

    def save(self):
        os.makedirs(os.path.dirname(self.index_path) or ".", exist_ok=True)
        if _FAISS_AVAILABLE:
            faiss.write_index(self.index, self.index_path)
            with open(self.index_path + ".meta", "wb") as f:
                pickle.dump(self.meta, f)
        else:
            with open(self.index_path + ".pkl", "wb") as f:
                pickle.dump({"embs": self.embs, "meta": self.meta}, f)

    def search(self, query_text: str, k: int = 5):
        q = self.model.encode([query_text], normalize_embeddings=True).astype("float32")
        results = []
        if _FAISS_AVAILABLE:
            scores, ids = self.index.search(q, k)
            for score, idx in zip(scores[0], ids[0]):
                meta = self.meta[idx]
                results.append({**meta, "score": float(score)})
        else:
            if self.embs is None or len(self.meta) == 0:
                return []
            sims = (q @ self.embs.T)[0]
            top_idx = np.argsort(-sims)[:k]
            for idx in top_idx:
                results.append({**self.meta[idx], "score": float(sims[idx])})
        return results
