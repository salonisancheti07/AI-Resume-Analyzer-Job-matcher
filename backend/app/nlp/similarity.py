from sentence_transformers import SentenceTransformer, util

_model = SentenceTransformer("all-MiniLM-L6-v2")


def semantic_similarity(resume_text: str, job_text: str) -> float:
    emb_resume = _model.encode(
        resume_text, convert_to_tensor=True, normalize_embeddings=True
    )
    emb_job = _model.encode(
        job_text, convert_to_tensor=True, normalize_embeddings=True
    )
    return float(util.cos_sim(emb_resume, emb_job))
