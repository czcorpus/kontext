"""
Custom Cheetah filters for the Bonito 2 interface
"""
import locale
from Cheetah.Filters import Filter

class IntegerFormatter(Filter):
    """
    Formats integer numbers according to the locales currently set
    """
    def filter(self, val, **kw):
        if val:
            return locale.format('%d', val, True).decode('UTF-8')
        return str(val)


class FloatFormatter(Filter):
    """
    Formats float numbers according to the locales currently set
    """

    def filter(self, val, **kw):
        if val:
            return locale.format('%01.2f', val, True).decode('UTF-8')
        return str(val)