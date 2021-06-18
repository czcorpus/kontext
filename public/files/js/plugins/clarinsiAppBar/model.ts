/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import { tuple } from 'cnc-tskit';
import { StatelessModel, IFullActionControl, Action } from 'kombo';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../../models/common/actions';
import { IPluginApi } from '../../types/plugins';

export enum ActionName {
    SetLanguage = 'CLARINSI_APPBAR_SET_LANGUAGE',
    ToggleMenu = 'CLARINSI_APPBAR_TOGGLE_MENU',
}

export namespace Actions {

    export interface SetLanguage extends Action<{
        value:string;
    }> {
        name: ActionName.SetLanguage;
    }

    export interface ToggleMenu extends Action<{

    }> {
        name: ActionName.ToggleMenu;
    }
}


export class ClarinSiAppBarModel extends StatelessModel<{menuVisible:boolean}> {

    private readonly pluginCtx:IPluginApi;


    constructor(dispatcher:IFullActionControl, pluginApi:IPluginApi) {
        super(dispatcher, {menuVisible: false});
        this.pluginCtx = pluginApi;

        this.addActionHandler<GlobalActions.SwitchCorpus>(
            GlobalActionName.SwitchCorpus,
            null,
            (state, action, dispatch) => {
                dispatch<GlobalActions.SwitchCorpusReady<{}>>({
                    name: GlobalActionName.SwitchCorpusReady,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: {}
                    }
                });
            }
        );

        this.addActionHandler<Actions.ToggleMenu>(
            ActionName.ToggleMenu,
            (state, action) => {
                state.menuVisible = !state.menuVisible;
            }
        );

        this.addActionHandler<Actions.SetLanguage>(
            ActionName.SetLanguage,
            null,
            (state, action, dispatch) => {
                this.pluginCtx.setLocationPost(
                    this.pluginCtx.createActionUrl('user/switch_language'),
                    [tuple('language', action.payload.value)]
                );
            }
        );
    }

    getRegistrationId():string {
        return 'clarinsi-app-bar-1';
    }
}