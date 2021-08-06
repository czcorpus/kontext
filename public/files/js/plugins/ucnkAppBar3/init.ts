/*
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

/// <reference path="./external.d.ts" />

import { IFullActionControl, StatelessModel } from 'kombo';

import { PluginInterfaces } from '../../types/plugins';
import * as toolbar from 'plugins/applicationBar/toolbar';
import { PageModel } from '../../app/page';
import { Actions } from './actions';
import { IUnregistrable } from '../../models/common/common';
import { Actions as GlobalActions } from '../../models/common/actions';


export class AppBarModel extends StatelessModel<{}> implements IUnregistrable {

    private readonly layoutModel:PageModel;

    constructor(dispatcher:IFullActionControl) {
        super(dispatcher, {});

        this.addActionHandler<typeof Actions.ShowLoginDialog>(
            Actions.ShowLoginDialog.name,
            null,
            (state, action, dispatch) => {
                try {
                    toolbar.openLoginDialog();

                } catch (e) {
                    console.error(e);
                    this.layoutModel.showMessage(
                        'error',
                        this.layoutModel.translate('ucnkAppBar3__failed_to_initialize_toolbar')
                    );
                }
            }
        );

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
        return 'ucnk-app-bar-model-3';
    }
}

export class AppBarPlugin implements PluginInterfaces.ApplicationBar.IPlugin {

    private model:AppBarModel;

    constructor(model:AppBarModel) {
        this.model = model;
    }

    isActive():boolean {
        return true;
    }

    unregister():void {
        this.model.unregister();
    }

    getRegistrationId():string {
        return this.model.getRegistrationId();
    }
}

const create:PluginInterfaces.ApplicationBar.Factory = (pluginApi, initToolbar) => {
    if (initToolbar) {
        toolbar.init();
    }
    return new AppBarPlugin(new AppBarModel(pluginApi.dispatcher()));
};

export default create;
