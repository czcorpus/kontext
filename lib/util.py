from functools import partial, wraps
import asyncio


def as_async(func):
    @wraps(func)
    async def run(*args, **kwargs):
        loop = asyncio.get_event_loop()
        fn = partial(func, *args, **kwargs)
        return await loop.run_in_executor(None, fn)
    return run
