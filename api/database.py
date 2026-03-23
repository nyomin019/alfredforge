"""AlfredForge — Database layer (aiosqlite)"""
import json
import asyncio
from pathlib import Path
from typing import Optional
import aiosqlite

DB_PATH = Path(__file__).parent.parent / "alfredforge.db"

PAPER_TRADES_PATH = Path.home() / ".openclaw/workspace-online/memory/options-research/paper-trades.json"
SIM_TRADES_PATH = Path.home() / ".openclaw/workspace-online/memory/options-research/paper-trades-sim.json"

CREATE_TRADES = """
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    date_entry TEXT,
    date_exit TEXT,
    strategy TEXT,
    ticker TEXT,
    status TEXT,
    outcome TEXT,
    s_entry REAL,
    s_exit REAL,
    iv_pct REAL,
    hv20_pct REAL,
    vix REAL,
    put_short REAL,
    put_long REAL,
    call_short REAL,
    call_long REAL,
    put_delta REAL,
    call_delta REAL,
    spread_width REAL,
    credit REAL,
    max_loss REAL,
    max_profit REAL,
    put_otm_pct REAL,
    call_otm_pct REAL,
    pnl REAL,
    reason_entry TEXT,
    reason_exit TEXT,
    data_source TEXT,
    expiration TEXT,
    dte INTEGER,
    source TEXT DEFAULT 'paper'
);
"""

CREATE_AGENT_LOG = """
CREATE TABLE IF NOT EXISTS agent_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT,
    agent TEXT,
    message TEXT,
    level TEXT DEFAULT 'info'
);
"""

CREATE_TOKEN_USAGE = """
CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT,
    model TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd REAL
);
"""

CREATE_CONFIG_STORE = """
CREATE TABLE IF NOT EXISTS config_store (
    key TEXT PRIMARY KEY,
    value TEXT
);
"""


async def init_db():
    async with aiosqlite.connect(str(DB_PATH)) as db:
        await db.execute(CREATE_TRADES)
        await db.execute(CREATE_AGENT_LOG)
        await db.execute(CREATE_TOKEN_USAGE)
        await db.execute(CREATE_CONFIG_STORE)
        await db.commit()


def _row_to_dict(cursor, row):
    return {col[0]: val for col, val in zip(cursor.description, row)}


def _trade_insert_params(t: dict, source: str) -> dict:
    return {
        "id": t.get("id", ""),
        "date_entry": t.get("date_entry"),
        "date_exit": t.get("date_exit"),
        "strategy": t.get("strategy"),
        "ticker": t.get("ticker"),
        "status": t.get("status"),
        "outcome": t.get("outcome"),
        "s_entry": t.get("S_entry"),
        "s_exit": t.get("S_exit"),
        "iv_pct": t.get("iv_pct"),
        "hv20_pct": t.get("hv20_pct"),
        "vix": t.get("vix"),
        "put_short": t.get("put_short"),
        "put_long": t.get("put_long"),
        "call_short": t.get("call_short"),
        "call_long": t.get("call_long"),
        "put_delta": t.get("put_delta"),
        "call_delta": t.get("call_delta"),
        "spread_width": t.get("spread_width"),
        "credit": t.get("credit"),
        "max_loss": t.get("max_loss"),
        "max_profit": t.get("max_profit"),
        "put_otm_pct": t.get("put_otm_pct"),
        "call_otm_pct": t.get("call_otm_pct"),
        "pnl": t.get("pnl"),
        "reason_entry": t.get("reason_entry"),
        "reason_exit": t.get("reason_exit"),
        "data_source": t.get("data_source"),
        "expiration": t.get("expiration"),
        "dte": t.get("dte"),
        "source": source,
    }


async def import_paper_trades():
    """Import trades from both JSON files into the DB (INSERT OR IGNORE)."""
    to_insert = []

    for path, source in [(PAPER_TRADES_PATH, "paper"), (SIM_TRADES_PATH, "simulation")]:
        if not path.exists():
            continue
        try:
            raw = json.loads(path.read_text())
        except Exception:
            continue
        for t in raw:
            if not t.get("id"):
                continue
            to_insert.append(_trade_insert_params(t, source))

    if not to_insert:
        return

    sql = """
    INSERT OR IGNORE INTO trades (
        id, date_entry, date_exit, strategy, ticker, status, outcome,
        s_entry, s_exit, iv_pct, hv20_pct, vix,
        put_short, put_long, call_short, call_long,
        put_delta, call_delta, spread_width, credit,
        max_loss, max_profit, put_otm_pct, call_otm_pct,
        pnl, reason_entry, reason_exit, data_source,
        expiration, dte, source
    ) VALUES (
        :id, :date_entry, :date_exit, :strategy, :ticker, :status, :outcome,
        :s_entry, :s_exit, :iv_pct, :hv20_pct, :vix,
        :put_short, :put_long, :call_short, :call_long,
        :put_delta, :call_delta, :spread_width, :credit,
        :max_loss, :max_profit, :put_otm_pct, :call_otm_pct,
        :pnl, :reason_entry, :reason_exit, :data_source,
        :expiration, :dte, :source
    )
    """
    async with aiosqlite.connect(str(DB_PATH)) as db:
        await db.executemany(sql, to_insert)
        await db.commit()


async def get_all_trades(source: Optional[str] = None, ticker: Optional[str] = None, outcome: Optional[str] = None, limit: int = 200):
    conditions = []
    params = []
    if source:
        conditions.append("source = ?")
        params.append(source)
    if ticker:
        conditions.append("ticker = ?")
        params.append(ticker)
    if outcome:
        conditions.append("outcome = ?")
        params.append(outcome)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limit)
    sql = f"SELECT * FROM trades {where} ORDER BY date_entry DESC LIMIT ?"
    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(sql, params) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def get_trade_by_id(trade_id: str):
    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM trades WHERE id = ?", (trade_id,)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None


async def get_trade_stats():
    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row

        async with db.execute("SELECT COUNT(*) as cnt FROM trades") as cur:
            total_trades = (await cur.fetchone())["cnt"]

        async with db.execute("SELECT COUNT(*) as cnt FROM trades WHERE outcome IN ('WIN','LOSS')") as cur:
            closed_trades = (await cur.fetchone())["cnt"]

        async with db.execute("SELECT COUNT(*) as cnt FROM trades WHERE outcome = 'WIN'") as cur:
            wins = (await cur.fetchone())["cnt"]

        async with db.execute("SELECT SUM(pnl) as s FROM trades WHERE outcome IN ('WIN','LOSS')") as cur:
            total_pnl = (await cur.fetchone())["s"] or 0.0

        async with db.execute("SELECT AVG(pnl) as a FROM trades WHERE outcome = 'WIN'") as cur:
            avg_win = (await cur.fetchone())["a"] or 0.0

        async with db.execute("SELECT AVG(pnl) as a FROM trades WHERE outcome = 'LOSS'") as cur:
            avg_loss = (await cur.fetchone())["a"] or 0.0

        async with db.execute("""
            SELECT source,
                COUNT(*) as total,
                SUM(CASE WHEN outcome='WIN' THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN outcome='LOSS' THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN pnl IS NOT NULL THEN pnl ELSE 0 END) as pnl
            FROM trades
            WHERE outcome IN ('WIN','LOSS')
            GROUP BY source
        """) as cur:
            by_source = {}
            async for row in cur:
                by_source[row["source"]] = {
                    "total": row["total"],
                    "wins": row["wins"],
                    "losses": row["losses"],
                    "pnl": row["pnl"],
                    "win_rate": (row["wins"] / row["total"] * 100) if row["total"] else 0,
                }

        win_rate = (wins / closed_trades * 100) if closed_trades else 0.0

        return {
            "total_trades": total_trades,
            "closed_trades": closed_trades,
            "win_rate": round(win_rate, 1),
            "total_pnl": round(total_pnl, 2),
            "avg_win": round(avg_win, 2),
            "avg_loss": round(avg_loss, 2),
            "by_source": by_source,
        }


async def get_open_positions():
    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM trades WHERE status = 'OPEN' ORDER BY date_entry DESC") as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def get_monthly_pnl(source: Optional[str] = None):
    where = "WHERE outcome IN ('WIN','LOSS') AND date_exit IS NOT NULL"
    params = []
    if source:
        where += " AND source = ?"
        params.append(source)
    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            f"SELECT strftime('%Y-%m', date_exit) as month, SUM(pnl) as pnl FROM trades {where} GROUP BY month ORDER BY month ASC",
            params
        ) as cur:
            rows = await cur.fetchall()
            return [{"month": r["month"], "pnl": round(r["pnl"] or 0, 2)} for r in rows]


async def get_strategy_pnl():
    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT strategy, SUM(pnl) as pnl, COUNT(*) as trades,
                SUM(CASE WHEN outcome='WIN' THEN 1 ELSE 0 END) as wins
            FROM trades
            WHERE outcome IN ('WIN','LOSS')
            GROUP BY strategy
            ORDER BY pnl DESC
        """) as cur:
            rows = await cur.fetchall()
            return [
                {
                    "strategy": r["strategy"],
                    "pnl": round(r["pnl"] or 0, 2),
                    "trades": r["trades"],
                    "wins": r["wins"],
                }
                for r in rows
            ]


async def get_cumulative_pnl(source: Optional[str] = None):
    where = "WHERE outcome IN ('WIN','LOSS') AND date_exit IS NOT NULL"
    params = []
    if source:
        where += " AND source = ?"
        params.append(source)

    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            f"SELECT date_exit as date, SUM(pnl) as pnl FROM trades {where} GROUP BY date_exit ORDER BY date_exit ASC",
            params
        ) as cur:
            rows = await cur.fetchall()

    cumulative = 0.0
    result = []
    for row in rows:
        cumulative += row["pnl"] or 0
        result.append({"date": row["date"], "cumulative_pnl": round(cumulative, 2)})
    return result


async def get_milestone():
    """Paper trading milestone: progress toward 20 trades with >60% WR."""
    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row

        async with db.execute("""
            SELECT COUNT(*) as closed,
                SUM(CASE WHEN outcome='WIN' THEN 1 ELSE 0 END) as wins,
                SUM(pnl) as total_pnl,
                AVG(CASE WHEN outcome='WIN' THEN pnl END) as avg_win,
                MAX(pnl) as best_trade
            FROM trades
            WHERE source='paper' AND outcome IN ('WIN','LOSS')
        """) as cur:
            row = await cur.fetchone()
            closed = row["closed"] or 0
            wins = row["wins"] or 0
            total_pnl = row["total_pnl"] or 0.0
            avg_win = row["avg_win"] or 0.0
            best_trade = row["best_trade"] or 0.0

        async with db.execute("""
            SELECT COUNT(*) as cnt FROM trades
            WHERE source='paper' AND (status='SKIPPED' OR outcome='SKIP')
        """) as cur:
            skipped = (await cur.fetchone())["cnt"] or 0

        async with db.execute("""
            SELECT COUNT(*) as cnt FROM trades
            WHERE source='paper' AND status='OPEN'
        """) as cur:
            open_count = (await cur.fetchone())["cnt"] or 0

    goal = 20
    win_rate = (wins / closed * 100) if closed else 0.0
    pct = round(closed / goal * 100, 1)
    on_track = win_rate >= 60 or closed == 0

    return {
        "closed": closed,
        "wins": wins,
        "losses": closed - wins,
        "goal": goal,
        "win_rate": round(win_rate, 1),
        "total_pnl": round(total_pnl, 2),
        "avg_win": round(avg_win, 2),
        "best_trade": round(best_trade, 2),
        "skipped": skipped,
        "open": open_count,
        "pct_complete": pct,
        "on_track": on_track,
    }
