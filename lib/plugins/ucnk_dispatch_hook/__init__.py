# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

import time
from datetime import datetime
import logging
import smtplib
from email.mime.text import MIMEText

from controller.errors import ImmediateRedirectException
from plugins.abstract.dispatch_hook import AbstractDispatchHook
import plugins
from plugins import inject
try:
    from elasticsearch.client import Elasticsearch, SnapshotClient
except ImportError:
    from plugins.ucnk_dispatch_hook.dummy_es import Elasticsearch, SnapshotClient


class ESBackup(object):
    """
    A simple ElasticSearch client providing required snapshot-related
    operations.
    """

    def __init__(self, url, index_name, repo_name):
        self._url = url
        self._index_name = index_name
        self._repo_name = repo_name
        self._client = SnapshotClient(Elasticsearch(self._url))

    def create_snapshot(self, name):
        logging.getLogger(__name__).info('creating ES snapshot %s'.format(name))
        body = dict(indices=self._index_name)
        self._client.create(repository=self._repo_name, snapshot=name, body=body)

    def get_snapshot_info(self, name):
        """
        Get snapshot information. This should be called later
        the same day 'create_snapshot' was called.
        """
        return self._client.get(repository=self._repo_name, snapshot=name)


class UcnkDispatchHook(AbstractDispatchHook):
    """
    A super-simple dispatch hook used to write KonText
    logs to a Redis queue where they are fetched by
    [Klogproc](https://github.com/czcorpus/klogproc)
    utility.
    """

    def __init__(self, db, queue_key):
        self._db = db
        self._queue_key = queue_key

    def pre_dispatch(self, plugin_api, action_name, action_metadata, request):
        # Recent KonText versions avoid specifying corpus variant directly in URL but
        # we still have to handle external links
        if action_name in ('first_form', 'first', 'view'):
            corp = request.args.get('corpname')
            if corp.startswith('omezeni/'):
                logging.getLogger(__name__).warning(
                    'Handling legacy action URL for {0}'.format(action_name))
                raise ImmediateRedirectException(
                    plugin_api.updated_current_url(dict(corpname=corp[len('omezeni/'):])))

    def post_dispatch(self, plugin_api, methodname, action_metadata, log_data):
        self._db.list_append(self._queue_key, log_data)

    def export_tasks(self):
        """
        Export tasks for Celery worker(s). Please note that here
        we expect that these tasks are run at most once a day
        due to the algorithm defining how snapshot names are generated.
        """

        def snapshot_logs(url, index_name, repo_name):
            """
            Create snapshot of ES data

            arguments:

            url -- ES server url (e.g. http://localhost:9200)
            index_name -- name of the index we want to make snapshot for
                          (we do not create a snapshot of the whole ES server here)
            repo_name -- name of the snapshot repository (see README.md)
            """
            client = ESBackup(url=url, index_name=index_name, repo_name=repo_name)
            client.create_snapshot(
                name='snapshot_{0}'.format(time.strftime('%Y%m%d', datetime.now().timetuple())))

        def show_todays_snapshot(url, index_name, repo_name, mail_server, mail_sender, mail_recipients):
            """
            Send an information about todays snapshot by e-mail
            to a list of predefined recipients.

            arguments:

            url -- ES server url (e.g. http://localhost:9200)
            index_name -- name of the index we want to make snapshot for
                          (we do not create a snapshot of the whole ES server here)
            repo_name -- name of the snapshot repository (see README.md)
            mail_server -- a SMTP server address
            mail_sender -- a sender e-mail
            mail_recipients -- a list of recipients
            """
            client = ESBackup(url=url, index_name=index_name, repo_name=repo_name)
            info = client.get_snapshot_info(
                name='snapshot_{0}'.format(time.strftime('%Y%m%d', datetime.now().timetuple())))
            info = info.get('snapshots', [{}])[0]
            text = '\n'.join([
                'Sending latest ElasticSearch logs snapshot info:\n',
                '\tname: {0}'.format(info.get('snapshot', '-')),
                '\tstate: {0}'.format(info.get('state', '-')),
                '\tstart_time: {0}'.format(info.get('start_time', '-')),
                '\tend_time: {0}'.format(info.get('end_time', '-')),
                '\tfailures: {0}'.format(info['failures'] if len(
                    info.get('failures', [])) > 0 else '-'),
                '\nYour ucnk_dispatch_hook plug-in',
                '(KonText)'
            ])

            s = smtplib.SMTP(mail_server)
            for recipient in mail_recipients:
                msg = MIMEText(text, 'plain', 'utf-8')
                msg['Subject'] = 'ElasticSearch KonText logs data backup update'
                msg['From'] = mail_sender
                msg['To'] = recipient
                try:
                    s.sendmail(mail_sender, [recipient], msg.as_string())
                except Exception as ex:
                    logging.getLogger(__name__).error(
                        'Failed to send an e-email to <%s>, error: %r' % (recipient, ex))
            s.quit()

        return snapshot_logs, show_todays_snapshot


@inject(plugins.runtime.DB)
def create_instance(conf, db):
    plg_conf = conf.get('plugins', 'dispatch_hook')
    queue_key = plg_conf['ucnk:queue_key']
    return UcnkDispatchHook(db, queue_key)
