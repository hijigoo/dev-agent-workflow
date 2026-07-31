FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml README.md ./
COPY work_intake ./work_intake
RUN python -m pip install --no-cache-dir .

EXPOSE 8001
CMD ["uvicorn", "work_intake.main:app", "--host", "0.0.0.0", "--port", "8001"]

