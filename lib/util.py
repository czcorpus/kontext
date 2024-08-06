import asyncio
from contextlib import AbstractAsyncContextManager
from functools import partial, wraps
from typing import AsyncIterator, TypeVar

import aiofiles

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


_KEY_ALPHABET = (
    [chr(x) for x in range(ord('a'), ord('z') + 1)] +
    [chr(x) for x in range(ord('A'), ord('Z') + 1)] +
    ['%d' % i for i in range(10)])


def int2chash(hex_num: int, length: int) -> str:
    """
    Generates a slightly compressed alphanum hash (using all the alphabet) out
    of provided integer.
    """
    ans = []
    while hex_num > 0 and len(ans) < length:
        p = hex_num % len(_KEY_ALPHABET)
        ans.append(_KEY_ALPHABET[p])
        hex_num = int(hex_num / len(_KEY_ALPHABET))
    return ''.join([str(x) for x in ans])
