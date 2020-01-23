# Installation instructions (v 0.15+)

## Contents

- [Installation instructions (v 0.15+)](#installation-instructions-v-015)
  - [Contents](#contents)
  - [Install KonText (Ubuntu)](#install-kontext-ubuntu)
  - [Deployment of new versions](#deployment-of-new-versions)
  - [Performance tuning](#performance-tuning)
    - [WSGI and Celery workers note](#wsgi-and-celery-workers-note)
    - [uWSGI server](#uwsgi-server)
  - [Celery Beat](#celery-beat)
    - [Systemd configuration](#systemd-configuration)
  - [Managing users](#managing-users)
    - [Ensuring access to corpora](#ensuring-access-to-corpora)
  - [Managing corpora](#managing-corpora)
    - [Install registry file](#install-registry-file)
    - [Install indexed data](#install-indexed-data)
    - [Update corplist.xml](#update-corplistxml)
    - [Update access rights](#update-access-rights)
    - [Apply changes](#apply-changes)

## Install KonText (Ubuntu)

The easiest way to install KonText is to create an **LXC/LXD container** with Ubuntu 18.04 LTS
OS, clone KonText repository and run [scripts/install/install.py](../scripts/install/install.py)
script that performs all the installation and configuration steps that are necessary to run KonText
as a standalone server application.

**[1]** Set up and start an LXC container:

```
sudo apt-get install lxc
sudo lxc-create -t download -n kontext-container -- -d ubuntu -r bionic -a amd64
sudo lxc-start -n kontext-container
```

**[2]** Note down the container's IP address:

```
sudo lxc-info -n kontext-container -iH
```

**[3]** Open the container's shell:

```
sudo lxc-attach -n kontext-container
```

(for more details about lxc containers, see <a href="https://linuxcontainers.org/lxc">https://linuxcontainers.org/lxc</a>)

**[4]** In the container, git-clone the KonText git repo to a directory of your
choice (e.g. */opt/kontext*), set the required permissions and run the install script.

```
sudo apt-get update
sudo apt-get install -y ca-certificates git
git clone https://github.com/czcorpus/kontext.git /opt/kontext/
python3 /opt/kontext/scripts/install/install.py
```

By default, the script installs Manatee from the `deb` packages provided by
the [NLP Center at the Faculty of Informatics, Masaryk University](https://nlp.fi.muni.cz/).
If you wish to build Manatee from sources and use the ucnk-specific manatee patch, you can
use the `install.py --patch /path/to/patch` option.

(for more details about Manatee installation, see
<a href="https://nlp.fi.muni.cz/trac/noske/wiki/Downloads">https://nlp.fi.muni.cz/trac/noske/wiki/Downloads</a>)

For production use, you should use `--gunicorn` option with the `install.py` script
which installs Gunicorn WSGI server.

**[5]** Once the installation is complete, start KonText by entering the following
command in the installation directory you specified above (*/opt/kontext*):

```
python3 public/app.py --address 127.0.0.1 --port 8080
```

Alternatively, in case you've used `--gunicorn` option, the installation script
automatically started all the necessary services for you and you don't need
the embedded WSGI server.

**[6] Open `[container_IP_address]`  in your browser on the host. You should see
KonText's home page and be able to enter a query to search in the sample Susanne corpus.


## Deployment of new versions

To install a newer version:

**[1]** fetch data from the `origin` repository and merge it:

```
git fetch origin
git merge origin/master
```

(replace `master` with a different branch if you use one)

**[2]** install possible new JS dependencies:

```
npm install
```

**[3]** build the project

```
make production
```

**[4]** optionally, if you want to deploy to a different directory without
any unnecessary files:

```
cp -r {conf,lib,locale,package.json,public,scripts,worker.py} destination_directory
```

You can also take a look at [helper script](https://github.com/czcorpus/kontext-ucnk-scripts/blob/master/deploy.py)
which allows you (once you write a simple JSON configuration file) to install newest version from GitHub while keeping
a backup copy of your previous installation(s).


## Performance tuning

The key factor in deciding on how to configure performance-related parameters
is how fast is your server able to handle a typical query on a typical
corpus and how many users will be querying the server.

In general the following parameters should be in harmony:

* HTTP proxy
  * read timeout (*proxy_read_timeout* in Nginx)
* Gunicorn/uWSGI
  * timeout (should be less or equal to proxy read timeout)
  * number of workers (`workers = 10` in `conf/gunicorn-conf.py`)
* Celery
  * timeout
    * hard timeout `CELERYD_OPTS="--time-limit=1800 --concurrency=64"`
    * soft timeout (`/kontext/calc_backend/task_time_limit` in `conf/config.xml`)
  * number of workers (again `CELERYD_OPTS=...`)

### WSGI and Celery workers note

For small installations with infrequent visits, 2-4 Gunicorn workers can be enough.
For thousands (to few tens of thousands) users a day, 16-24 Gunicorn workers should do the job.
If you expect to have usage peaks (e.g. workshops) it is better to add more
workers even if some of them may sleep most of the time.

In case of Celery, the best number to start with is the same number as
the number of Gunicorn workers and monitor how the application performs.
With large corpora, our recommendation would be to use about 1.5 to 2 times the
number of Gunicorn workers.


### uWSGI server

uWSGI server can be used instead of Gunicorn. For more information please see [uWSGI.md](uWSGI.md).

## Celery Beat

Celery Beat allows cron-like task management within Celery. It is used by
KonText especially to remove old cache files (concordance, frequency, collocations).

<a name="install_celery_beat_systemd_configuration"></a>
### Systemd configuration

File */etc/systemd/system/celerybeat.service*:

```
[Unit]
Description=Celery Beat Service
After=network.target celery.service

[Service]
Type=forking
User=celery
Group=www-data
PIDFile=/var/run/celerybeat/beat.pid
EnvironmentFile=/etc/conf.d/celerybeat
WorkingDirectory=/opt/kontext/production/scripts/celery
ExecStart=/bin/sh -c '${CELERY_BIN} --app=${CELERY_APP} beat ${CELERYBEAT_OPTS} --workdir=${CELERYBEAT_CHDIR} --detach --pidfile=${CELERYBEAT_PID_FILE} --logfile=${CELERYBEAT_LOGFILE} --loglevel=${CELERYBEAT_LOGLEVEL}'
ExecStop=/bin/kill -s TERM $MAINPID
PermissionsStartOnly=true
ExecStartPre=-/bin/mkdir /var/run/celerybeat
ExecStartPre=/bin/chown -R celery:root /var/run/celerybeat

[Install]
WantedBy=multi-user.target
```

Then define a KonText-specific configuration
*/opt/kontext-production/conf/beatconfig.py*:

```
from celery.schedules import crontab
from datetime import timedelta

BROKER_URL = 'redis://127.0.0.1:6379/2'
CELERY_TASK_SERIALIZER = 'json'
CELERY_ENABLE_UTC = True
CELERY_TIMEZONE = 'Europe/Prague'

CELERYBEAT_SCHEDULE = {
    'conc-cache-cleanup': {
        'task': 'conc_cache.conc_cache_cleanup',
        'schedule': crontab(hour='0,12', minute=1),
        'kwargs': dict(ttl=120, subdir=None, dry_run=False)
    }
}
```

## Managing users

The installation script has installed two users:

1) public user which is used for any unauthorized access to KonText (id = 0)
2) user *kontext* with a random password generated by the installation script (id = 1)

To add more users, another script packed with the *default_auth* plug-in can be used.

First, a JSON containing new users' credentials must be prepared. See `lib/plugins/default_auth/scripts/users.sample.json`
for the required format and data.

*Note 1*: Paswords in the file should be in plaintext. Please note that the file is needed just to install the users and from
then, it won't be needed by KonText. The installed users' password are stored in a secure form within the database.
The best way how to treat the user credentials file is to delete it or encrypt it and archive somewhere once you install
the users.

*Note 2*: the script we are going to use will rewrite any existing user if `id` collides. To prevent this,
start your new user IDs from 2 (to leave two initial users unchanged).

### Ensuring access to corpora

For each user, you should also set a list of corpora they will be able to access. It is possible to configure access to
corpora which are not installed yet (just make sure proper corpora identifiers/names are used - typically this
means names matching respective Manatee registry file names for your corpora).

Once the list of new users is ready, run:

```bash
python lib/plugins/default_auth/scripts/install.py /path/to/your/users.json
```

## Managing corpora

To install a new corpus, please follow the steps described below.

### Install registry file

Registry configures a corpus for the Manatee search engine (and also adds some configuration needed by KonText/NoSkE).
The file should be located in a directory defined in `conf/config.xml`, element `kontext/corpora/manatee_registry`.

### Install indexed data

Copy your indexed corpus to a directory specified in `conf/config.xml` (element `kontext/corpora/manatee_registry`).
The data must be located in the path specified within a respective registry file under the `PATH` key.

### Update corplist.xml

The `default_corparch` plug-in which is used by default as a module to list and search for corpora uses `conf/corplist.xml`
file to store all the configured corpora. The `susanne` corpus should be already there. To add a new corpus please
follow the same pattern as in case of `susanne`.

### Update access rights

To provide access to the new corpus for an existing user, you can use script `lib/plugins/default_auth/scripts/usercorp.py`.
E.g. to add a new corpus 'foo' to a user with ID = 3:

```bash
python lib/plugins/default_auth/scripts/usercorp.py 3 add foo

```

Note: The script also allows removing access rights.

### Apply changes

To force KonText to recognize your new corpus you can either send a `SIGUSR1`
signal to a respective master Gunicorn process: `sudo -u www-data kill -s SIGUSR1 [proc num]` or you can restart your KonText
application `systemctl restart gunicorn-kontext`.