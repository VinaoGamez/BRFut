"""Caminhos padrão do backend local BR Football."""
from __future__ import annotations

import os
from pathlib import Path

APP_DIR_NAME = 'BR Fut'


def default_data_root() -> Path:
    """Pasta de dados do usuário: Documentos/BR Fut (Windows/macOS/Linux)."""
    docs = os.environ.get('BRFUT_DATA_DIR')
    if docs:
        return Path(docs).expanduser().resolve()
    home = Path.home()
    documents = home / 'Documents'
    if documents.is_dir():
        return (documents / APP_DIR_NAME).resolve()
    return (home / APP_DIR_NAME).resolve()


def ensure_layout(root: Path | None = None) -> Path:
    root = root or default_data_root()
    (root / 'profiles').mkdir(parents=True, exist_ok=True)
    (root / 'saves').mkdir(parents=True, exist_ok=True)
    (root / 'sessions').mkdir(parents=True, exist_ok=True)
    return root
