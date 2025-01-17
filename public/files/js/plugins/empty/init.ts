/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

import { IUnregistrable } from '../../models/common/common.js';
import { IFullActionControl } from 'kombo';
import { Actions as GlobalActions } from '../../models/common/actions.js';
import { Observable } from 'rxjs';
import { BasePlugin, IPluginApi } from '../../types/plugins/common.js';


/**
 * This type is used by KonText build scripts whenever
 * an optional plugin is set to none (i.e. a tag without children
 * is used in config.xml for the plug-in).
 *
 * TODO: This is generally better than returning null/undefined but
 * without a common interface for all the plug-ins, we're in
 * similar situation as in case of 'null' (we must test the plug-in
 * instance first and then call a method of choice).
 *
 * See also PageModel.isNotEmptyPlugin()
 */
export class EmptyPlugin implements IUnregistrable, BasePlugin {

    private readonly noChanges:Observable<{}>;

    constructor(dispatcher:IFullActionControl) {
        dispatcher.registerActionListener((action, dispatch) => {
            if (action.name === GlobalActions.SwitchCorpus.name) {
                dispatch<typeof GlobalActions.SwitchCorpusReady>({
                    name: GlobalActions.SwitchCorpusReady.name,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: {}
                    }
                });
            }
        });

        this.noChanges = new Observable<{}>();
    }

    isActive():boolean {
        return true;
    }

    getWidgetView(...args:any):React.FC|React.ComponentClass|null {
        return null;
    }

    create() {
        return null;
    }

    unregister():void {}

    getRegistrationId():string {
        return 'empty-plugin';
    }
}


export default function create(pluginApi:IPluginApi, ...args:Array<any>) {
    return new EmptyPlugin(pluginApi.dispatcher());
}