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

from typing import Optional, Tuple
import os
import settings
import re
import logging
from plugins.abstract.audio_provider import AbstractAudioProvider
from plugins import inject
try:
    import pydub
except ImportError:
    logging.getLogger(__name__).warning(
        'Module pydub not installed. KonText audio capabilities can be enhanced by installing it.')
    pydub = None


class SoxAudioProvider(AbstractAudioProvider):

    @staticmethod
    def _create_audio_file_path(corpname: str, chunk: str) -> Tuple[Optional[str], Optional[str]]:
        return '/var/lib/manatee/audio/zobc.wav', '/var/lib/manatee/audio'  # TODO remove

        rpath = os.path.realpath(os.path.join(
            settings.get('corpora', 'speech_files_path'), corpname, chunk
        ))
        # check correct base path for security measures
        basepath = os.path.realpath(settings.get('corpora', 'speech_files_path'))
        if os.path.isfile(rpath) and rpath.startswith(basepath):
            speechpath = os.path.realpath(os.path.join(basepath, corpname))
            return rpath, speechpath

        return None, None

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

    def get_audio(self, plugin_ctx, req):
        chunk = req.args.get('chunk', 'zobc.wav')  # TODO
        start = req.args.get('start', '')
        end = req.args.get('end', '')

        rpath, speechpath = self._create_audio_file_path(plugin_ctx.current_corpus.corpname, chunk)
        if rpath is None:
            plugin_ctx.set_not_found()
            return {}, None

        m = re.search(r'.*\.(.*)', chunk)
        if m.group(1):
            logging.error('TEST')
            length = float(end) - float(start)
            baserpath = os.path.realpath(os.path.join(speechpath, chunk))
            if not os.path.isfile(rpath):
                soxcmd = '/usr/bin/sox ' + baserpath + '  --type ' + \
                    m.group(1) + ' \'' + rpath + '\' trim ' + start + ' ' + str(length)
                os.system(soxcmd)

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
        if pydub is None:
            return None

        rpath = self._create_audio_file_path(
            plugin_ctx.current_corpus.corpname, req.args.get('chunk', ''))
        if rpath is None:
            plugin_ctx.set_not_found()
            return []

        play_from, play_to = self._parse_range(req)
        if not play_to:
            # TODO requires ffmpeg
            sound = pydub.AudioSegment.from_file(rpath)
        else:
            with open(rpath, 'rb') as f:
                if play_from > 0:
                    f.seek(play_from)

                # TODO reads only wav
                sound = pydub.AudioSegment(
                    data=f.read() if not play_to else f.read(play_to - play_from))

        def audio_slices(snd, num_slices):
            slice = int(len(snd) / num_slices)
            for i in range(0, (num_slices - 2) * slice, slice):
                yield snd[i:i + slice]
            yield snd[(num_slices - 2) * slice:]

        return [snd.max / sound.max for snd in audio_slices(sound, 200)]


@inject()
def create_instance(_):
    """
    """
    return SoxAudioProvider()
