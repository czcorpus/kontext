from celery.schedules import crontab

BROKER_URL = 'redis://localhost:6379/2'
CELERY_TASK_SERIALIZER = 'json'

CELERYBEAT_SCHEDULE = {
    'sync-user-database': {
        'task': 'sync_user_db',
        'schedule': crontab(minute='*/5'),
        'kwargs': dict(interval=5, dry_run=False)
    },
    'archive-old-concordances': {
        'task': 'archive_concordance',
        'schedule': crontab(hour='*/1', minute=0),
        'kwargs': dict(cron_interval=20, key_prefix=None, dry_run=False)
    },
    'conc-cache-cleanup': {
        'task': 'conc_cache_cleanup',
        'schedule': crontab(hour='*/12', minute=10),
        'kwargs': dict(ttl=120, subdir='student', dry_run=False)
    },
    'freqs-cache-cleanup': {
        'task': 'clean_freqs_cache',
        'schedule': crontab(hour='*/1', minute=20)
    },
    'colls-cache-cleanup': {
        'task': 'clean_colls_cache',
        'schedule': crontab(hour='*/1', minute=30)
    },
    'clean-tckc-cache': {
        'task': 'token_connect.clean_cache',
        'schedule': crontab(day_of_week=0, hour=3, minute=30),
        'kwargs': dict(cache_size=10000000)
    }
}
