/*
 * Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../types/compat.d.ts" />

import * as Kontext from '../types/kontext';
import { PluginApi } from './plugin';
import { PageModel } from './page';
import { ComponentTools } from './component';
import { L10n } from './l10n';
import { UserSettings } from './userSettings';
import { AppNavigation } from './navigation';
import { ActionDispatcher } from 'kombo';
import { Dict, List } from 'cnc-tskit';
import { IPluginApi } from '../types/plugins/common';


/**
 * KontextConf handles current page configuration as
 * received from server. It is also possible to modify
 * the configuration but this should be done only in
 * very special situations as models normally do not
 * reflect such a change (except for corpus switching
 * where all the models are dumped and instantiated
 * again).
 */
class KontextConf implements Kontext.IConfHandler {

    private readonly conf:Kontext.Conf;

    constructor(conf:Kontext.Conf) {
        this.conf = conf;
    }

    /**
     * Return page configuration item. If not found
     * 'undefined' is returned.
     *
     */
    getConf<T>(item:string):T {
        return this.conf[item];
    }

    /**
     * Return page configuration item hidden in
     * any key->object... depth in safe way
     * (i.e. no TypeError when accessing undefined
     * sub-object).
     */
    getNestedConf<T>(...keys:Array<string>):T {
        return keys.slice(0, keys.length - 1).reduce(
            (acc, k) => acc[k] !== undefined ? acc[k] : {},
            this.conf
        )[keys[keys.length - 1]];
    }

    /**
     * Set page configuration item. Setting an item
     * triggers a configuration change event.
     */
    setConf<T>(key:string, value:T):void {
        this.conf[key] = value;
    }
}

/**
 * KontextPage provides an environment for Kontext's loaded
 * page where all the logic and components reside.
 */
export class KontextPage extends PageModel {

    private readonly _pluginApi:PluginApi;

    private readonly componentTools:Kontext.ComponentHelpers;


    constructor(conf:Kontext.Conf) {
        const confHandler = new KontextConf(conf);
        const dispatcher = new ActionDispatcher();
        super(
            confHandler,
            dispatcher,
            new L10n(conf['uiLang'], conf['helpLinks'] || {}),
            new AppNavigation(confHandler, dispatcher),
            UserSettings.createInstance()
        );
        this._pluginApi = new PluginApi(this);
        this.componentTools = new ComponentTools(this);
    }

    pluginApi():IPluginApi {
        return this._pluginApi;
    }

    getComponentHelpers():Kontext.ComponentHelpers {
        return this.componentTools;
    }

}