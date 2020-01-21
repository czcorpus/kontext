workers = 2
bind = "127.0.0.1:8080"
timeout = 60
accesslog = None
errorlog = "/var/log/gunicorn/kontext/error.log"
proc_name = 'kontext'
pidfile = '/var/tmp/kontext.pid'