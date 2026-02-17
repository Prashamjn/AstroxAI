import json
import math
import os
import sqlite3
import sys
from dataclasses import dataclass
from typing import Dict, List, Tuple


FEATURES = [
    "ucb_agent",
    "factual_agent",
    "coherence_agent",
    "chunk_relevance",
    "novelty_score",
    "agent_usage_frequency",
]


def sigmoid(x: float) -> float:
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


@dataclass
class TrainConfig:
    lr: float = 0.05
    l2: float = 1e-4
    epochs: int = 50


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chunk_training_examples (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          response_id TEXT,
          query TEXT,
          chunk_text TEXT,
          agent_name TEXT,
          features_json TEXT NOT NULL,
          user_feedback INTEGER,
          final_quality_score REAL,
          final_chunk_selected INTEGER
        );
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chunk_train_time ON chunk_training_examples(timestamp);"
    )
    conn.commit()


def load_examples(conn: sqlite3.Connection, limit: int = 5000) -> Tuple[List[List[float]], List[int]]:
    cur = conn.execute(
        """
        SELECT features_json, final_chunk_selected
        FROM chunk_training_examples
        ORDER BY id DESC
        LIMIT ?;
        """,
        (int(limit),),
    )
    X: List[List[float]] = []
    y: List[int] = []
    for features_json, selected in cur.fetchall():
        try:
            feats = json.loads(features_json)
        except Exception:
            continue
        row = [float(feats.get(k, 0.0)) for k in FEATURES]
        X.append(row)
        y.append(int(selected) if selected is not None else 0)
    X.reverse()
    y.reverse()
    return X, y


def train_logreg(X: List[List[float]], y: List[int], cfg: TrainConfig) -> Dict[str, float]:
    if not X:
        return {"bias": 0.0, "weights": {k: 0.0 for k in FEATURES}}

    # Initialize
    w = [0.0 for _ in FEATURES]
    b = 0.0

    n = len(X)

    for _ in range(int(cfg.epochs)):
        # batch gradient descent
        grad_w = [0.0 for _ in FEATURES]
        grad_b = 0.0

        for i in range(n):
            xi = X[i]
            yi = float(y[i])
            z = b
            for j in range(len(FEATURES)):
                z += w[j] * xi[j]
            p = sigmoid(z)
            err = p - yi
            grad_b += err
            for j in range(len(FEATURES)):
                grad_w[j] += err * xi[j]

        # L2
        for j in range(len(FEATURES)):
            grad_w[j] += cfg.l2 * w[j]

        # step
        b -= cfg.lr * (grad_b / n)
        for j in range(len(FEATURES)):
            w[j] -= cfg.lr * (grad_w[j] / n)

    return {
        "bias": float(b),
        "weights": {FEATURES[i]: float(w[i]) for i in range(len(FEATURES))},
    }


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: python chunk_scorer.py <chunk_training.sqlite> <out_weights.json>")
        return 2

    db_path = sys.argv[1]
    out_path = sys.argv[2]

    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    conn = sqlite3.connect(db_path)
    ensure_schema(conn)

    X, y = load_examples(conn)
    cfg = TrainConfig(
        lr=float(os.environ.get("CHUNK_SCORER_LR", "0.05")),
        l2=float(os.environ.get("CHUNK_SCORER_L2", "0.0001")),
        epochs=int(os.environ.get("CHUNK_SCORER_EPOCHS", "50")),
    )

    model = train_logreg(X, y, cfg)
    model["features"] = FEATURES
    model["train_examples"] = len(X)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(model, f)

    print(f"Wrote weights to {out_path} (n={len(X)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
