# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Department of Linguistics
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

import logging
import os
import re
from typing import Optional

import aiofiles
import aiofiles.os

try:
    import sox
except ImportError:
    sox = None
try:
    import numpy as np
except ImportError:
    np = None

import settings
from plugin_types.audio_provider import AbstractAudioProvider
from plugins import inject


class DefaultAudioProvider(AbstractAudioProvider):

    def __init__(self):
        if sox is None:
            logging.getLogger(__name__).warning(
                'Sox not installed - the get_waveform function will be disabled')
        if np is None:
            logging.getLogger(__name__).warning(
                'Numpy not installed - the get_waveform function will be disabled')

    @staticmethod
    async def _create_audio_file_path(corpname: str, chunk: str) -> Optional[str]:
        rpath = os.path.realpath(os.path.join(
            settings.get('corpora', 'speech_files_path'), corpname, chunk
        ))
        # check correct base path for security measures
        basepath = os.path.realpath(settings.get('corpora', 'speech_files_path'))
        if await aiofiles.os.path.isfile(rpath) and rpath.startswith(basepath):
            return rpath

        return None

    @staticmethod
    def _parse_range(request):
        """
        Parse HTTP Range header value for obtaining
        partial chunk of data.
        """
        rng = request.headers.get('range')
        if not rng:
            return 0, None
        srch = re.match(r'^[bB]ytes=(\d+)-(\d*)$', rng)
        lft, rgt = 0, None
        if srch:
            lft = int(srch.group(1))
            if srch.group(2):
                rgt = int(srch.group(2))
        else:
            logging.getLogger(__name__).warning(f'Invalid value for HTTP header Range: {rng}')
        return lft, rgt

    async def get_audio(self, plugin_ctx, req):
        rpath = await self._create_audio_file_path(
            plugin_ctx.current_corpus.corpname, req.args.get('chunk', ''))
        if rpath is None:
            plugin_ctx.set_not_found()
            return {}, None
        file_size = await aiofiles.os.path.getsize(rpath)
        headers = {
            'Content-Type': 'audio/mpeg',
            'Content-Length': str(file_size),
            'Accept-Ranges': 'bytes'
        }
        async with aiofiles.open(rpath, 'rb') as f:
            play_from, play_to = self._parse_range(req)
            if play_from > 0:
                await f.seek(play_from)

            plugin_ctx.set_respose_status(206)
            if req.headers.get('range'):
                headers['Content-Range'] = f'bytes 0-{file_size-1}/{file_size}'
            return headers, await f.read() if not play_to else await f.read(play_to - play_from)

    async def get_waveform(self, plugin_ctx, req):
        if sox is None or np is None:
            return None
        rpath = await self._create_audio_file_path(
            plugin_ctx.current_corpus.corpname, req.args.get('chunk', ''))
        if rpath is None:
            plugin_ctx.set_not_found()
            return []

        tfm = sox.Transformer()
        play_from, play_to = self._parse_range(req)
        if play_to:
            # in case of variable this might not be very precise
            bitrate = sox.file_info.bitrate(rpath)
            tfm.trim(play_from / bitrate, play_to / bitrate)

        snd_data = np.absolute(tfm.build_array(input_filepath=rpath))
        max = np.amax(snd_data)
        snd_chunks = np.array_split(snd_data, 200)
        return [float(np.amax(snd) / max) for snd in snd_chunks]


@inject()
def create_instance(_):
    """
    """
    return DefaultAudioProvider()
