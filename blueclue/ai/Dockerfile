FROM python:3.11-slim

LABEL maintainer="BlueClue Team"
LABEL description="BlueClue ML Inference Service (with LLM + RAG)"

# Prevent Python from writing .pyc and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies:
#   gcc/g++  — scipy / scikit-learn native wheels
#   libpq-dev curl — psycopg2 / healthchecks
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc g++ libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies (includes openai + sentence-transformers)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download MiniLM model at build time so the container starts faster.
# Falls back gracefully if the download fails (e.g., no internet during build).
RUN python -c "\
try:\
    from sentence_transformers import SentenceTransformer;\
    SentenceTransformer('all-MiniLM-L6-v2');\
    print('MiniLM model cached')\
except Exception as e:\
    print(f'MiniLM pre-download skipped: {e}')\
" || true

# Copy application code
COPY . .

# Expose the default port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Run with uvicorn in production mode
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000", "--workers", "2", "--log-level", "info"]
