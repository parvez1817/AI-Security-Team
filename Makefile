backend:
	cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000
frontend:
	cd frontend && npm install && npm run dev
