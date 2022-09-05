#!/bin/bash

export GLOBAL_CONF_PATH='/var/opt/install/kontext_configs/private/kontext-deploy.json'

/usr/local/bin/kontext-update "$@"
ret=$?
if [ $ret -eq 0 ]; then
    echo "new version installed, now going to restart the services..."
    sudo bash -c 'systemctl restart sanic-kontext && systemctl restart rq-all.target && systemctl restart rqscheduler && systemctl restart nginx'
    echo "...done"
elif [ $ret -eq 2 ]; then
    printf "\nfailed to install latest KonText - the services won't be restarted\n\n"
fi