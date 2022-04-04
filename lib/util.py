from functools import partial, wraps
from typing import AsyncIterator, Tuple, TypeVar
import asyncio

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
    """
    @wraps(func)
    def run(*args, **kwargs):
        return asyncio.run(func(*args, **kwargs))
    return run


async def anext(ait: AsyncIterator):
    return await ait.__anext__()


async def aenumerate(asequence: AsyncIterator[T], start=0) -> Tuple[int, T]:
    n = start
    async for elem in asequence:
        yield n, elem
        n += 1
