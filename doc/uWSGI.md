# Notes on using KonText with uWSGI on Ubuntu

Please note that *uWSGI* provides quite an amount of features, plug-ins and 
deployment options. For a complete overview please refer to 
[uWSGI homepage](https://uwsgi-docs.readthedocs.io/en/latest/).

If you have a choice what WSGI server to install we recommend using 
[Gunicorn](http://gunicorn.org/) (see [./INSTALL.md](INSTALL.md) for more
info).

## Install uWSGI and Python support

```
sudo apt install uwsgi uwsgi-plugin-python 
```

## Configure KonText as a service

Here we assume that *KonText* is already installed in */opt/kontext*.

Create an app configuration file `/etc/uwsgi/apps-available/kontext.ini`:

```ini
[uwsgi]
http-socket = 127.0.0.1:8080
workers = 4
plugins = python
chdir = /opt/kontext/public/
module = app:application
master = True
logto = /var/log/uwsgi-kontext/error.log
```


Create a symlink to enable the configuration within uwsgi:

```bash
ln -s  /etc/uwsgi/apps-available/kontext.ini /etc/uwsgi/apps-enabled/kontext.ini
```

Now change directory to `/etc/systemd/system`.


Create a socket configuration file `uwsgi-kontext.socket`:


```ini
[Unit]
Description=Socket for uWSGI KonText

[Socket]
ListenStream=/var/run/uwsgi/kontext.socket
SocketUser=www-data
SocketGroup=www-data
SocketMode=0660

[Install]
WantedBy=sockets.target 
```

Create a service file `uwsgi-kontext.service`:

```ini
[Unit]
Description=uWSGI KonText server
After=syslog.target

[Service]
ExecStart=/usr/bin/uwsgi \
        --ini /etc/uwsgi/apps-available/kontext.ini \
        --socket /var/run/uwsgi/kontext.socket
User=www-data
Group=www-data
Restart=on-failure
KillSignal=SIGQUIT
Type=notify
StandardError=syslog
NotifyAccess=all

[Install]
WantedBy=multi-user.target
```

Before enabling and starting the service, don't forget to check
whether all the configured files/dirs exist and have proper permissions
(in your example - /var/log/uwsgi-kontext/error.log, /var/run/uwsgi,...).

```
systemctl enable uwsgi-kontext.socket
systemctl enable uwsgi-kontext.service
systemctl start uwsgi-kontext
```