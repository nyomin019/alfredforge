"""AlfredForge — API routes."""
import time
import asyncio
from datetime import datetime, timezone
from typing import Optional
import psutil
import httpx
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from api.database import (
    DB_PATH,
    get_all_trades,
    get_trade_by_id,
    get_trade_stats,
    get_open_positions,
    get_monthly_pnl,
    get_strategy_pnl,
    get_cumulative_pnl,
    get_milestone,
)
from api.models import ConfigIn, TestConnectionIn
from core.config_manager import load_config, save_config, is_setup_complete
from core.openclaw_client import check_status

router = APIRouter()
_start_time = time.time()

# ── /api/status ──────────────────────────────────────────────────────────────

@router.get("/status")
async def status():
    oc = await check_status()
    cfg = load_config()
    return {
        "openclaw": oc,
        "broker_stocks": cfg.get("broker_stocks", "skip"),
        "broker_crypto": cfg.get("broker_crypto", "skip"),
        "setup_complete": bool(cfg.get("setup_complete", False)),
    }


# ── /api/portfolio ────────────────────────────────────────────────────────────

@router.get("/portfolio")
async def portfolio():
    stats = await get_trade_stats()
    cfg = load_config()
    return {
        **stats,
        "capital_total_aud": cfg.get("capital_total_aud", 2000.0),
        "allocation_options_pct": cfg.get("allocation_options_pct", 60),
        "allocation_crypto_pct": cfg.get("allocation_crypto_pct", 20),
        "allocation_cash_pct": cfg.get("allocation_cash_pct", 20),
    }


# ── /api/trades ───────────────────────────────────────────────────────────────

@router.get("/trades")
async def trades(
    source: Optional[str] = Query(None),
    ticker: Optional[str] = Query(None),
    outcome: Optional[str] = Query(None),
    limit: int = Query(200),
):
    return await get_all_trades(source=source, ticker=ticker, outcome=outcome, limit=limit)


@router.get("/trades/{trade_id}")
async def trade_by_id(trade_id: str):
    t = await get_trade_by_id(trade_id)
    if t is None:
        return JSONResponse(status_code=404, content={"error": "Not found"})
    return t


# ── /api/positions ────────────────────────────────────────────────────────────

@router.get("/positions")
async def positions():
    return await get_open_positions()


# ── /api/candles ──────────────────────────────────────────────────────────────

_TF_MAP = {
    "1m": ("1m", "7d"),
    "5m": ("5m", "60d"),
    "15m": ("15m", "60d"),
    "1h": ("60m", "60d"),
    "4h": ("1h", "60d"),
    "1d": ("1d", "2y"),
}


@router.get("/candles")
async def candles(
    symbol: str = Query("META"),
    timeframe: str = Query("1d"),
    limit: int = Query(100),
):
    try:
        import yfinance as yf
        import pandas as pd

        tf, period = _TF_MAP.get(timeframe, ("1d", "2y"))
        ticker_obj = yf.Ticker(symbol)
        hist = ticker_obj.history(period=period, interval=tf, auto_adjust=True)
        if hist.empty:
            return []
        hist = hist.tail(limit)
        result = []
        for ts, row in hist.iterrows():
            if hasattr(ts, "timestamp"):
                unix_ts = int(ts.timestamp())
            else:
                unix_ts = int(pd.Timestamp(ts).timestamp())
            result.append({
                "time": unix_ts,
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]) if not pd.isna(row["Volume"]) else 0,
            })
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ── /api/tokens ───────────────────────────────────────────────────────────────

@router.get("/tokens")
async def tokens():
    from api.database import DB_PATH
    import aiosqlite
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    try:
        async with aiosqlite.connect(str(DB_PATH)) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT SUM(input_tokens+output_tokens) as t, SUM(cost_usd) as c FROM token_usage WHERE ts LIKE ?",
                (today + "%",)
            ) as cur:
                row = await cur.fetchone()
                today_tokens = row["t"] or 0
                cost_today = row["c"] or 0.0

            async with db.execute(
                "SELECT SUM(input_tokens+output_tokens) as t, SUM(cost_usd) as c FROM token_usage WHERE ts LIKE ?",
                (month + "%",)
            ) as cur:
                row = await cur.fetchone()
                month_tokens = row["t"] or 0
                cost_month = row["c"] or 0.0
    except Exception:
        today_tokens = month_tokens = 0
        cost_today = cost_month = 0.0

    return {
        "today": today_tokens,
        "month": month_tokens,
        "cost_today_usd": round(cost_today, 4),
        "cost_month_usd": round(cost_month, 4),
    }


# ── /api/agent/log ────────────────────────────────────────────────────────────

@router.get("/agent/log")
async def agent_log():
    import aiosqlite
    try:
        async with aiosqlite.connect(str(DB_PATH)) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM agent_log ORDER BY id DESC LIMIT 50"
            ) as cur:
                rows = await cur.fetchall()
                return [dict(r) for r in rows]
    except Exception:
        return []


# ── /api/metrics ──────────────────────────────────────────────────────────────

@router.get("/metrics")
async def metrics():
    cpu = psutil.cpu_percent(interval=0.2)
    mem = psutil.virtual_memory()
    uptime_s = int(time.time() - _start_time)
    db_size_kb = 0
    if DB_PATH.exists():
        db_size_kb = round(DB_PATH.stat().st_size / 1024, 1)
    return {
        "cpu_pct": cpu,
        "mem_pct": round(mem.percent, 1),
        "mem_used_gb": round(mem.used / (1024**3), 2),
        "mem_total_gb": round(mem.total / (1024**3), 2),
        "db_size_kb": db_size_kb,
        "uptime_s": uptime_s,
    }


# ── /api/config ───────────────────────────────────────────────────────────────

@router.get("/config")
async def get_config():
    cfg = load_config()
    masked = dict(cfg)
    for field in ("openclaw_token", "broker_stocks_key", "broker_stocks_secret",
                  "broker_crypto_key", "broker_crypto_secret"):
        if masked.get(field):
            masked[field] = "****"
    return masked


@router.post("/config")
async def post_config(body: ConfigIn):
    data = body.model_dump(exclude_none=True)
    save_config(data)
    return {"ok": True}


@router.post("/config/test")
async def test_config(body: TestConnectionIn):
    cfg = load_config()
    endpoint = body.endpoint or cfg.get("openclaw_endpoint", "http://localhost:18789")
    token = body.token or cfg.get("openclaw_token", "")
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    url = f"{endpoint.rstrip('/')}/status"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code < 500:
                return {"ok": True, "message": f"Connected ({resp.status_code})"}
            return {"ok": False, "message": f"Server error {resp.status_code}"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


# ── /api/monthly-pnl ─────────────────────────────────────────────────────────

@router.get("/monthly-pnl")
async def monthly_pnl(source: Optional[str] = Query(None)):
    return await get_monthly_pnl(source=source)


# ── /api/strategy-pnl ────────────────────────────────────────────────────────

@router.get("/strategy-pnl")
async def strategy_pnl():
    return await get_strategy_pnl()


# ── /api/cumulative-pnl ──────────────────────────────────────────────────────

@router.get("/cumulative-pnl")
async def cumulative_pnl(source: Optional[str] = Query(None)):
    return await get_cumulative_pnl(source=source)


# ── /api/milestone ────────────────────────────────────────────────────────────

@router.get("/milestone")
async def milestone():
    return await get_milestone()


# ── /api/vix ──────────────────────────────────────────────────────────────────

@router.get("/vix")
async def vix():
    import json
    from pathlib import Path
    vix_path = Path.home() / ".openclaw/scripts/vix-state.json"
    try:
        data = json.loads(vix_path.read_text())
        return {"vix": data.get("vix", 0), "in_range": data.get("in_range", False)}
    except Exception:
        return {"vix": None, "in_range": None}
