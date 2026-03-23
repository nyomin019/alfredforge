#!/usr/bin/env python3
"""AlfredForge — Professional Trading Dashboard"""
import sys
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from api.routes import router
from api.database import init_db, import_paper_trades

app = FastAPI(title="AlfredForge", version="1.0.0")
app.include_router(router, prefix="/api")
app.mount("/static", StaticFiles(directory=str(Path(__file__).parent / "static")), name="static")


@app.get("/")
async def root():
    return FileResponse(str(Path(__file__).parent / "static" / "index.html"))


@app.on_event("startup")
async def startup():
    await init_db()
    await import_paper_trades()


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8080, reload=False)
