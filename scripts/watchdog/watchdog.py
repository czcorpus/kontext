#!/usr/bin/env python

# Copyright (c) 2014  Institute of the Czech National Corpus
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

"""
A simple script to test web-site availability. All the actions
are logged into a defined file and in case of an error, a warning
e-mail is sent.
Configuration is defined in a JSON file (see watchdog-sample.json).
"""
import urllib
import datetime
import time
import json
import sys
import os
import logging
from logging import handlers
import smtplib
from email.mime.text import MIMEText


def measure_req(url, orig_size, resp_size_threshold, resp_time_threshold):
    """
    Arguments:
    url -- page to be tested
    orig_size -- expected size of response's body
    resp_size_threshold -- how big change in size is tolerated (expressed as a fraction, i.e. 0.5 means 50% change in size)
    resp_time_threshold -- maximum response time in seconds considered as non-error

    Returns:
    a dictionary containing 'time', 'code' (http status), 'size' (response body), 'errors' (list of error messages)
    """
    start = datetime.datetime.now()
    nf = urllib.urlopen(url)
    page = nf.read()
    end = datetime.datetime.now()
    delta = end - start
    current_size = len(page)

    ans = {
        'time': delta.seconds * 1000 + delta.microseconds / 1000.0,
        'code': nf.getcode(),
        'size': current_size,
        'errors': []
    }

    size_diff = get_size_diff(expected=orig_size, current=current_size)
    if size_diff > resp_size_threshold:
        ans['errors'].append('Response body changed by %01.1f%% (threshold = %01.1f%%).' % (size_diff * 100,
                                                                                            resp_size_threshold * 100))
    if ans['time'] > resp_time_threshold * 1000:
        perc = ans['time'] / float(resp_time_threshold) * 100
        ans['errors'].append('Loading time limit exceeded by %01.1f%%.' % perc)
    if int(nf.getcode()) / 100 == 4:
        ans['errors'].append('HTTP status code %s' % nf.getcode())
    nf.close()
    return ans


def load_config(path):
    """
    Loads a JSON configuration from a defined path

    Arguments:
    path -- path to a JSON file containing configuration data

    Returns:
    imported JSON
    """
    return json.load(open(path))


def get_size_diff(expected, current):
    """
    Calculates absolute change in size (|new - orig| / orig)

    Arguments:
    expected -- expected size in bytes
    current -- actual size in bytes

    Returns:
    change in size as a fraction of expected size (see the formula above)
    """
    expected = float(expected)
    current = float(current)
    return abs(expected - current) / expected


def setup_logger(path, debug=False):
    """
    Sets-up Python logger with file rotation

    Arguments:
    path -- where the log files will be written
    debug -- debug mode on/off (bool)
    """
    logger = logging.getLogger('')
    hdlr = handlers.RotatingFileHandler(path, maxBytes=(1 << 23), backupCount=50)
    hdlr.setFormatter(logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s'))
    logger.addHandler(hdlr)
    logger.setLevel(logging.INFO if not debug else logging.DEBUG)


def send_email(failed_tests, server, sender, recipients):
    """
    Sends an error-reporting e-mail

    Arguments:
    failed_tests -- list of dicts containing results from measure_req()
    server -- address of SMTP server
    sender -- e-mail used as a sender
    recipients -- list/tuple of e-mails
    """
    text = "Web-watchdog script reports following failed tests:\n\n"
    i = 1
    for failed in failed_tests:
        text += "%d) %s:\n" % (i, failed['title'])
        for err in failed['errors']:
            text += '\t%s' % err
        i += 1
    text += '\n\nYour watchdog.py'
    s = smtplib.SMTP(server)

    for recipient in recipients:
        msg = MIMEText(text)
        msg['Subject'] = "Web watchdog error report from %s" % time.strftime('%Y-%m-%d %H:%M:%S')
        msg['From'] = sender
        msg['To'] = recipient
        try:
            s.sendmail(sender, [recipient], msg.as_string())
        except Exception as ex:
            log.error('Failed to send an e-email to <%s>, error: %r' % (recipient, ex))
    s.quit()


if __name__ == '__main__':
    num_repeat = 2
    log = logging.getLogger(os.path.basename(__file__))
    failed_tests = []

    if len(sys.argv) < 2:
        print('Config not specified, assuming ./watchdog.json')
        config_file = './watchdog.json'
    else:
        config_file = sys.argv[1]
    config = load_config(config_file)

    setup_logger(config['logPath'], config['debug'])

    for test in config['tests']:
        result = measure_req(url=test['url'],
                             orig_size=test['size'],
                             resp_size_threshold=config['pageSizeThreshold'],
                             resp_time_threshold=test['responseTimeLimit'])
        result['title'] = test['title']
        if len(result['errors']) > 0:
            log.error(json.dumps(result))
        else:
            log.info(json.dumps(result))

        if len(result['errors']) > 0:
            failed_tests.append(result)

    if len(failed_tests) > 0:
        send_email(failed_tests, config['smtpServer'], config['mailSender'], config['mailRecipients'])