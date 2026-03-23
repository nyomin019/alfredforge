"""AlfredForge — Encrypted config manager using Fernet."""
import os
import json
import base64
import socket
from pathlib import Path
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

CONFIG_PATH = Path(__file__).parent.parent / "alfredforge.conf"
_SALT = b"alfredforge-v1-salt-2026"

_DEFAULT = {
    "openclaw_endpoint": "http://localhost:18789",
    "openclaw_token": "",
    "primary_model": "google/gemini-2.5-flash",
    "fallback_model": "minimax/MiniMax-M2.5",
    "broker_stocks": "skip",
    "broker_stocks_key": "",
    "broker_stocks_secret": "",
    "broker_crypto": "skip",
    "broker_crypto_key": "",
    "broker_crypto_secret": "",
    "capital_total_aud": 2000.0,
    "allocation_options_pct": 60,
    "allocation_crypto_pct": 20,
    "allocation_cash_pct": 20,
    "monthly_contribution": 0.0,
    "setup_complete": False,
}


def _get_fernet() -> Fernet:
    hostname = socket.gethostname().encode()
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_SALT + hostname,
        iterations=100_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(hostname))
    return Fernet(key)


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        return dict(_DEFAULT)
    try:
        f = _get_fernet()
        data = f.decrypt(CONFIG_PATH.read_bytes())
        loaded = json.loads(data)
        merged = dict(_DEFAULT)
        merged.update(loaded)
        return merged
    except Exception:
        return dict(_DEFAULT)


def save_config(data: dict):
    merged = load_config()
    merged.update(data)
    f = _get_fernet()
    encrypted = f.encrypt(json.dumps(merged).encode())
    CONFIG_PATH.write_bytes(encrypted)


def is_setup_complete() -> bool:
    cfg = load_config()
    return bool(cfg.get("setup_complete", False))
