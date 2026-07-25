"""ASGI entrypoint: `uvicorn sync_api.main:app`."""

from sync_api.app import create_app

app = create_app()
