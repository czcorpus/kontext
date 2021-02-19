workers = 2
bind = "0.0.0.0:8080"
timeout = 60
accesslog = None
errorlog = "/var/log/gunicorn/kontext/error.log"
proc_name = 'kontext'
pidfile = '/var/tmp/kontext.pid'