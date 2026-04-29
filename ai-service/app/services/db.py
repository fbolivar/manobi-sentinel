"""Pool de conexiones a PostgreSQL compartido por los routers del ai-service."""
import os
import logging
from typing import Optional
from psycopg_pool import ConnectionPool

log = logging.getLogger('manobi-ai.db')

_pool: Optional[ConnectionPool] = None


def _dsn() -> str:
    url = os.getenv('DATABASE_URL')
    if url:
        return url.replace('postgres://', 'postgresql://', 1)
    return (
        f"postgresql://{os.getenv('POSTGRES_USER','manobi')}:"
        f"{os.getenv('POSTGRES_PASSWORD','')}@"
        f"{os.getenv('POSTGRES_HOST','postgres')}:"
        f"{os.getenv('POSTGRES_PORT','5432')}/"
        f"{os.getenv('POSTGRES_DB','manobi')}"
    )


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(conninfo=_dsn(), min_size=1, max_size=4, open=True, timeout=5)
        log.info('Pool PostgreSQL inicializado')
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
