# Loader image: applies the schema and loads the workbook into Postgres.
# Build context is the project root:  docker build -f docker/loader.Dockerfile .
FROM python:3.12-alpine

WORKDIR /app

COPY scripts/requirements.txt ./scripts/requirements.txt
RUN pip install --no-cache-dir -r scripts/requirements.txt

ENV PYTHONUNBUFFERED=1

CMD ["python", "scripts/init_db.py"]
