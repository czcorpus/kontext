# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

from typing import Optional, Tuple
import os
import settings
import subprocess
import re
import logging
from plugins.abstract.audio_provider import AbstractAudioProvider
from plugins import inject


class SoxAudioProvider(AbstractAudioProvider):

    @staticmethod
    def _create_audio_file_paths(corpname: str, chunk: str) -> Tuple[Optional[str], Optional[str]]:
        rpath = os.path.realpath(os.path.join(
            settings.get('corpora', 'speech_files_path'), corpname, chunk
        ))
        # check correct base path for security measures
        basepath = os.path.realpath(settings.get('corpora', 'speech_files_path'))
        if os.path.isfile(rpath) and rpath.startswith(basepath):
            speechpath = os.path.realpath(os.path.join(basepath, corpname))
            return rpath, speechpath

        return None, None

    def get_audio(self, plugin_ctx, req):
        chunk = req.args.get('chunk', '')
        start = req.args.get('start', '0')
        end = req.args.get('end', '')

        orig_rpath, speechpath = self._create_audio_file_paths(
            plugin_ctx.current_corpus.corpname, chunk)
        if orig_rpath is None:
            plugin_ctx.set_not_found()
            return {}, None

        m = re.search(r'(.*)\.(.*)', chunk)
        name = m.group(1)
        ext = m.group(2)
        if ext and start and end:
            length = float(end) - float(start)
            rpath = os.path.join(speechpath, f'{name}?start={start}&end={end}.{ext}')
            if not os.path.isfile(rpath):
                process = subprocess.Popen([
                    '/usr/bin/sox',
                    orig_rpath,
                    rpath,
                    'trim',
                    start,
                    str(length),
                ])
                process.communicate()
        else:
            rpath = orig_rpath

        with open(rpath, 'rb') as f:
            file_size = os.path.getsize(rpath)
            headers = {
                'Content-Type': 'audio/mpeg',
                'Content-Length': f'{file_size}',
                'Accept-Ranges': 'none',
            }
            if req.environ.get('HTTP_RANGE', None):
                headers['Content-Range'] = f'bytes 0-{file_size - 1}/{file_size - 1}'
            return headers, f.read()

    def get_waveform(self, plugin_ctx, req):
        logging.warning('get_waveform not implemented')
        return [0 for _ in range(200)]  # TODO


@inject()
def create_instance(_):
    """
    """
    return SoxAudioProvider()
