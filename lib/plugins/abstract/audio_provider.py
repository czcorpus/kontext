# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import abc
from typing import Tuple, Callable, Dict, Optional, List
from action.plg import PluginCtx
from werkzeug import Request


class AbstractAudioProvider(abc.ABC):

    @abc.abstractmethod
    def get_audio(self, plugin_ctx: PluginCtx, req: Request) -> Tuple[Dict[str, str], bytes]:
        """
        returns:
        a 2-tuple (
            1) dict of custom HTTP headers,
            2) raw audio data
        )
        """
        pass

    @abc.abstractmethod
    def get_waveform(self, plugin_ctx: PluginCtx, req: Request) -> Optional[List[float]]:
        """
        returns:
        either waveform data (JSON-encoded) or None; if None then the waveform function
        will be disabled on the client-side (i.e. it is not considered as
        an error)
        """
        pass
