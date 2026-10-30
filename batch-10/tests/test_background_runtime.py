"""Graceful shutdown only waits for the current application's event loop."""
import asyncio
from services.agent.background_runtime import track_background_task, wait_for_background_tasks, _background_tasks


def test_shutdown_waits_for_current_loop_without_touching_foreign_tasks():
    foreign_loop = asyncio.new_event_loop()
    foreign = track_background_task(foreign_loop.create_task(asyncio.sleep(1)))
    completed = []

    async def check():
        async def work():
            await asyncio.sleep(0)
            completed.append(True)
        current = track_background_task(asyncio.create_task(work()))
        await wait_for_background_tasks()
        assert current.done()
        assert completed == [True]
        assert foreign in _background_tasks
        assert not foreign.cancelled()

    try:
        asyncio.run(check())
    finally:
        foreign.cancel()
        foreign_loop.run_until_complete(asyncio.gather(foreign, return_exceptions=True))
        foreign_loop.close()
        _background_tasks.discard(foreign)


def test_shutdown_timeout_cancels_current_loop_tasks():
    async def check():
        task = track_background_task(asyncio.create_task(asyncio.sleep(60)))
        await wait_for_background_tasks(timeout=0.01)
        assert task.cancelled()
        await asyncio.sleep(0)
        assert task not in _background_tasks
    asyncio.run(check())
