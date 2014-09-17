# Copyright (c) 2014 Institute of the Czech National Corpus
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; version 2
# dated June, 1991.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

"""
All the application_bar plug-in implementations should inherit from AbstractApplicationBar
"""


class AbstractApplicationBar(object):

    def get_fallback_content(self):
        """
        Returns an HTML content usable as a fallback replacement for the standard content
        """
        raise NotImplementedError()

    def get_contents(self, cookies, curr_lang, return_url, use_fallback=True, timeout=2):
        """
        Returns standard HTML content based on set language and user identification/settings stored in cookies.

        arguments:
        cookies -- a Cookie.BaseCookie compatible instance
        curr_lang -- current language (xx_YY format)
        return_url -- a URL user returns to in case she uses some of he appbar's links/services
        use_fallback -- if True then in case there is no response or an error from the server a fallback content
                        (as provided by get_fallback_content()) is used
        timeout -- how many seconds to wait for the response; default is 2 seconds
        """
        raise NotImplementedError()