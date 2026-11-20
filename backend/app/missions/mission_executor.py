import asyncio

from app.orchestration.graph import run_pipeline

_tasks: set = set()


def start(mission):
    t = asyncio.create_task(run_pipeline(mission))
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)
