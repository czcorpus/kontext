/*
 * Copyright (c) 2014 Institute of Formal and Applied Linguistics
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

/// <reference path="./aai.d.ts" />

/// <amd-dependency path="aai" />


export function init():void {
    if (!(window.hasOwnProperty('aai'))) {
        throw 'Failed to find LINDAT/CLARIN AAI object. See https://redmine.ms.mff.cuni.cz/projects/lindat-aai for more details!';
    }
    let opts:AAI.AaiOptions = {};

    //if ever port is needed (eg. testing other tomcat) it should be in responseUrl and target
    opts.port = Number(window.location.port === '' ? '' : ':' + window.location.port);
    opts.host = window.location.protocol + '//' +
        window.location.hostname;
    opts.repoPath = '/repository/xmlui';
    if (opts.repoPath.charAt(opts.repoPath.length - 1) !== '/') {
        opts.repoPath = opts.repoPath + '/';
    }
    opts.target = opts.host + opts.port + '/services/kontext-dev/run.cgi/loginx?redirectTo=' + encodeURIComponent(window.location.href);
    //In order to use the discojuice store (improve score of used IDPs)
    //Works only with "verified" SPs - ie. ufal-point, displays error on ufal-point-dev
    opts.responseUrl =
        (window.location.hostname.search('ufal-point-dev') >= 0) ?
                '' :
                opts.host + opts.port + opts.repoPath +
                    'themes/UFAL/lib/html/disco-juice.html?';
    opts.metadataFeed = opts.host + opts.port + opts.repoPath + 'discojuice/feeds';
    opts.serviceName = 'LINDAT/CLARIN KonText Login';
    opts.localauth =
            '<form method="post" action="' + opts.target + '"> ' +
            '<p>Sign in using your local account obtained from the LINDAT/CLARIN administrator.</p>' +
            '<p style="margin: 5px; color: #888" ><input type="text" name="username" style="font-size: 160%; width: 100%" id="login" /> <label for="login">Username</label></p>' +
            '<p style="margin: 5px; color: #888" ><input type="password" name="password" style="font-size: 160%; width: 100%" id="pass" /> <label for="pass">Password</label></p>' +
            '<p  style="" ><input type="submit" style="margin: 20px 2px" name="submit" value="Sign in" /></p>' +
            '</form>';
    window['aai'].setup(opts);
}
