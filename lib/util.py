import asyncio
from functools import partial, wraps
from typing import AsyncIterator, Tuple, TypeVar

T = TypeVar('T')


def as_async(func):
    @wraps(func)
    async def run(*args, **kwargs):
        loop = asyncio.get_event_loop()
        fn = partial(func, *args, **kwargs)
        return await loop.run_in_executor(None, fn)
    return run


def as_sync(func):
    """
    Runs the wrapped asynchronous function as a blocking one via asyncio.run().
    This can be run only when there is no loop running.
    """
    @wraps(func)
    def run(*args, **kwargs):
        return asyncio.run(func(*args, **kwargs))
    return run


async def anext(ait: AsyncIterator):
    return await ait.__anext__()

