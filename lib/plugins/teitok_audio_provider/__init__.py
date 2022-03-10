# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

"""
An implementation of the audio_provider plugin based on the Sox audio utility
with some custom modifications not found in default_audio_provider. The main
difference is in the way how partial content is specified in reqeusts.
The teitok_audio_provider uses URL args 'start', 'end' specified in SECONDS
(while default_audio_provider relies on HTTP headers and BYTES).

Please note that a special cache directory "audio_cache_path" must be specified
for KonText to create slices of base audio chunks. To prevent infinite growth
of the directory, automatic cache cleanup should be configured.

To your task scheduler configuration, add the following JSON snippet:

{
    "task": "audio_provider__audio_cache_cleanup",
    "schedule": "*/30 * * * *",
    "kwargs": {"ttl": 3600}
}

where
- "schedule" uses CRON format for repeating time specification
- "kwargs.ttl" specifies time to live (in seconds) for cached files

An alternative to that would be using a custom CRON script.

"""

from typing import Optional
import os
import settings
import logging
from plugin_types.audio_provider import AbstractAudioProvider
from plugins import inject
import time
import sox
try:
    import numpy as np
except ImportError:
    np = None


class TeitokAudioProvider(AbstractAudioProvider):

    def __init__(self, audio_cache_path: str):
        self._audio_cache_path = audio_cache_path
        if np is None:
            logging.getLogger(__name__).warning(
                'Numpy not installed - the get_waveform function will be disabled')

    @staticmethod
    def _create_audio_file_path(corpname: str, chunk: str) -> Optional[str]:
        rpath = os.path.realpath(os.path.join(
            settings.get('corpora', 'speech_files_path'), corpname, chunk
        ))
        # check correct base path for security measures
        basepath = os.path.realpath(settings.get('corpora', 'speech_files_path'))
        if os.path.isfile(rpath) and rpath.startswith(basepath):
            return rpath
        return None

    def _mk_subchunk_path(self, corpname, name, ext, start, end):
        corp_dir = os.path.join(self._audio_cache_path, corpname)
        if not os.path.isdir(corp_dir):
            os.mkdir(corp_dir)
        return os.path.join(corp_dir, f'{name}.trimmed.{start}-{end}{ext}')

    def _get_chunk_slice(self, corpname: str, chunk: str, start: float, end: Optional[float]) -> Optional[str]:
        orig_path = self._create_audio_file_path(corpname, chunk)
        if orig_path is None:
            return None
        if start or end:
            name, ext = os.path.splitext(os.path.basename(chunk))
            rpath = self._mk_subchunk_path(corpname, name, ext, start, end)
            if not os.path.isfile(rpath):
                tfm = sox.Transformer()
                tfm.trim(start, end)
                tfm.build(input_filepath=orig_path, output_filepath=rpath)
            return rpath
        else:
            return orig_path

    def get_audio(self, plugin_ctx, req):
        chunk = req.args.get('chunk', '')
        start = float(req.args.get('start', '0'))
        end = req.args.get('end', None)
        end = None if end is None else float(end)

        audio_path = self._get_chunk_slice(
            plugin_ctx.current_corpus.corpname, chunk, start, end)
        if audio_path is None:
            plugin_ctx.set_not_found()
            return {}, None

        with open(audio_path, 'rb') as f:
            file_size = os.path.getsize(audio_path)
            headers = {
                'Content-Type': 'audio/mpeg',
                'Content-Length': f'{file_size}',
                'Accept-Ranges': 'none',
            }
            if req.headers.get('RANGE', None):
                headers['Content-Range'] = f'bytes 0-{file_size - 1}/{file_size - 1}'
            return headers, f.read()

    def get_waveform(self, plugin_ctx, req):
        if np is None:
            return None
        chunk = req.args.get('chunk', '')
        start = float(req.args.get('start', '0'))
        end = req.args.get('end', None)
        end = None if end is None else float(end)

        audio_path = self._get_chunk_slice(
            plugin_ctx.current_corpus.corpname, chunk, start, end)
        if audio_path is None:
            plugin_ctx.set_not_found()
            return []
        tfm = sox.Transformer()
        snd_data = np.absolute(tfm.build_array(input_filepath=audio_path))
        max = np.amax(snd_data)
        snd_chunks = np.array_split(snd_data, 200)
        return [float(np.amax(snd) / max) for snd in snd_chunks]

    def export_tasks(self):
        """
        Export tasks for the worker
        """

        def _process_dir(path, ttl):
            num_del = 0
            freed = 0
            time_now = time.time()
            for item in os.listdir(path):
                full_path = os.path.join(path, item)
                if os.path.isfile(full_path):
                    if time_now - int(os.path.getmtime(full_path)) >= ttl:
                        sz = os.path.getsize(full_path)
                        os.unlink(full_path)
                        num_del += 1
                        freed += sz
                elif os.path.isdir(full_path):
                    nnum, nfreed = _process_dir(full_path, ttl)
                    num_del += nnum
                    freed += nfreed
            return num_del, freed

        def audio_cache_cleanup(ttl: int):
            num_del, bytes_freed = _process_dir(self._audio_cache_path, ttl)
            logging.getLogger(__name__).info(
                'Audio cache cleanup - deleted {0} file(s), freed {1:.1f}kB'.format(num_del, bytes_freed / 1024))

        return audio_cache_cleanup,


@inject()
def create_instance(settings):
    """
    """
    plg_conf = settings.get('plugins', 'audio_provider')
    return TeitokAudioProvider(
        audio_cache_path=plg_conf['audio_cache_path'])
