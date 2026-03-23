"""AlfredForge — OpenClaw gateway client."""
import time
import httpx
from core.config_manager import load_config


async def check_status() -> dict:
    cfg = load_config()
    endpoint = cfg.get("openclaw_endpoint", "http://localhost:18789")
    token = cfg.get("openclaw_token", "")

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"{endpoint.rstrip('/')}/status"
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers=headers)
            latency_ms = int((time.monotonic() - start) * 1000)
            if resp.status_code < 500:
                return {"online": True, "latency_ms": latency_ms}
            return {"online": False, "latency_ms": latency_ms}
    except Exception:
        return {"online": False, "latency_ms": None}
