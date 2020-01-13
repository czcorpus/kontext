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

import * as Immutable from 'immutable';
import { IPluginApi } from '../types/plugins';
import { Kontext } from '../types/common';
import { PluginApi } from './plugin';
import { PageModel } from './page';
import { ComponentTools } from './component';
import { L10n } from './l10n';
import { UserSettings } from './userSettings';
import { AppNavigation } from './navigation';

declare var require:any; // webpack's require
require('styles/layout.less');
require('styles/widgets.less');

/**
 * KontextConf handles current page configuration as
 * received from server. It is also possible to modify
 * the configuration but this should be done only in
 * very special situations as many models may not reflect
 * the change. For such situations, it is recommended
 * for a model to register a custom handler via
 * addConfChangeHandler() and react accordingly.
 */
class KontextConf implements Kontext.IConfHandler {

    private readonly conf:Kontext.Conf;

    /**
     * Functions listening for change in app config (triggered by
     * setConf()).
     */
    confChangeHandlers:Immutable.Map<string, Immutable.List<(v:any)=>void>>;

    constructor(conf:Kontext.Conf) {
        this.conf = conf;
        this.confChangeHandlers = Immutable.Map<string, Immutable.List<(v:any)=>void>>();
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
        if (this.confChangeHandlers.has(key)) {
            this.confChangeHandlers.get(key).forEach(item => item(value));
        }
    }

    /**
     * Register a handler triggered when configuration is
     * changed via setConf(), replaceConcArg() functions.
     */
    addConfChangeHandler<T>(key:string, handler:(v:T)=>void):void {
        if (!this.confChangeHandlers.has(key)) {
            this.confChangeHandlers = this.confChangeHandlers.set(key, Immutable.List<(v:any)=>void>());
        }
        this.confChangeHandlers = this.confChangeHandlers.set(
            key,
            this.confChangeHandlers.get(key).push(handler)
        );
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
        super(
            confHandler,
            new L10n(conf['uiLang'], conf['helpLinks'] || {}),
            new AppNavigation(confHandler),
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