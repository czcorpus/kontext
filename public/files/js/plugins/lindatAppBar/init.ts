/*
 * Copyright (c) 2016 Department of Linguistics
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

import * as PluginInterfaces from '../../types/plugins/index.js';
import { init as localeInit } from './locale.js';
import { StatelessModel, IFullActionControl } from 'kombo';
import { Actions as GlobalActions } from '../../models/common/actions.js';

declare var require:any;
require('./style.css'); // webpack


class LindatAppBarModel extends StatelessModel<{}> {

    constructor(dispatcher:IFullActionControl) {
        super(dispatcher, {});

        this.addActionHandler<typeof GlobalActions.SwitchCorpus>(
            GlobalActions.SwitchCorpus.name,
            null,
            (state, action, dispatch) => {
                dispatch<typeof GlobalActions.SwitchCorpusReady>({
                    name: GlobalActions.SwitchCorpusReady.name,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: {}
                    }
                });
            }
        );
    }

    getRegistrationId():string {
        return 'lindat-app-bar-1';
    }
}


export class LindatAppBar implements PluginInterfaces.ApplicationBar.IPlugin {

    private readonly model:LindatAppBarModel;

    constructor(dispatcher:IFullActionControl) {
        this.model = new LindatAppBarModel(dispatcher);
    }

    isActive():boolean {
        return true;
    }

    unregister():void {}

    getRegistrationId():string {
        return this.model.getRegistrationId();
    }
}

const create:PluginInterfaces.ApplicationBar.Factory = (pluginApi, initToolbar) => {
    if (initToolbar) {
        localeInit();
    }
    return new LindatAppBar(pluginApi.dispatcher());
};

export default create;
