/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

declare var AAI:any; // TODO (webpack)
import * as PluginInterfaces from '../../types/plugins';
/// <reference path="./aai.d.ts" />


class Plugin implements PluginInterfaces.Auth.IPlugin {

    isActive():boolean {
        return true;
    }

    getUserPaneView():React.ComponentClass {
        return null;
    }

    getProfileView():React.ComponentClass {
        return null; // TODO
    }

    getSignUpView():React.ComponentClass|null {
        return null;
    }
}

const create:PluginInterfaces.Auth.Factory = (pluginApi) => {
    const pluginConfig: any = pluginApi.getConf<any>('pluginData').auth;
    // pass our config to external aai.js
    if (window['aai'] === undefined)     {
        throw new Error('Failed to find LINDAT/CLARIN AAI object. ' +
            'See https://github.com/ufal/lindat-aai-discovery for more details!');
    }
    let opts: AAI.AaiOptions = {};

    opts.metadataFeed = pluginConfig.metadataFeed;
    // We need to double encode the window.location.href as it has url params
    // and we put it into url param (returnTo)
    opts.target = pluginConfig.login_url +
                    encodeURIComponent(encodeURIComponent(window.location.href));
    opts.serviceName = pluginConfig.service_name;
    opts.responseUrl = pluginConfig.response_url;
    opts.localauth =
        '<form method="post" action="' + pluginConfig.local_action + '"> ' +
        '<p>Sign in using your local account obtained from the administrator.</p>' +
        '<p style="margin: 5px; color: #888" >' +
        '<input type="text" name="username" style="font-size: 160%; width: 100%" id="login" /> ' +
        '<label for="login">Username</label>' +
        '</p>' +
        '<p style="margin: 5px; color: #888" >' +
        '<input type="password" name="password" style="font-size: 160%; width: 100%" id="pass" />' +
        '<label for="pass">Password</label>' +
        '</p>' +
        '<p  style="" >' +
        '<input type="submit" style="margin: 20px 2px" name="submit" value="Sign in" />' +
        '</p>' +
        '</form>';
    window['aai'].setup(opts);
    // ---
    return new Plugin();
}

export default create;
