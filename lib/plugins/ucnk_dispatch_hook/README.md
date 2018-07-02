# ucnk_dispatch_hook

A custom implementation of `dispatch_hook` plug-in which passes KonText
application log data to a Redis queue (= list type) where it is read
by a special application [Klogproc](https://github.com/czcorpus/klogproc)
which was developed to read some of UCNK applications' log data from
different sources and store them to ElasticSearch for further analysis.

## Exposed HTTP methods

*none*

## Exported tasks (Celery Beat)

* a regular backup (snapshot) of ElasticSearch index

## Reusability

Although this plug-in is developed primarily for UCNK, it can be easily
used by anyone intending to store KonText applog to ElasticSearch.

## External dependencies

### Client-side

*none*

### Server-side

* [Python Elasticsearch Client](https://elasticsearch-py.readthedocs.io/en/master/)


### Basic installation

Create ElasticSearch index (if not already available):

```
PUT my_logs
```

Create ES mapping for a new record type `kontext`:

```
PUT _mapping/kontext

[contents of the es_mapping.json file]
```

### Handling data backup

The plug-in provides also a definition of background tasks
for creating ElasticSearch snapshots.

Create a directory for snapshots and set proper permissions:

```
mkdir /path/to/archive/kontext_logs_backup
chown elasticsearch.root /path/to/archive/kontext_logs_backup
```

Configure ElasticSearch snapshot storage:

```
PUT _snapshot/kontext_logs_backup
{
    "type": "fs",
    "settings": {
        "location": "/path/to/archive/kontext_logs_backup"
    }
}
```

Define a Celery Beat task to perform snapshotting:


```
'logs-es-snapshot': {
    'task': 'dispatch_hook.snapshot_logs',
    'schedule': crontab(minute='1', hour='0', day='Mon'),
    'kwargs': {
        'url': 'http://my_es_server',
        'index_name': 'my_logs',
        'repo_name': 'kontext_logs_backup'
    }
},
'logs-es-snapshot-info': {
    'task': 'dispatch_hook.show_last_snapshot',
    'schedule': crontab(minute='55', hour='2', day='Mon'),
    'kwargs': {
        'url': 'http://my_es_server',
        'index_name': 'my_logs',
        'repo_name': 'kontext_logs_backup',
        'mail_server': 'localhost',
        'mail_sender': 'kontext@localhost',
        'mail_recipients': ['recipient1@localhost', 'recipient2@localhost']
    }
}
```