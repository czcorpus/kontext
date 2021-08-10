/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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

import * as PluginInterfaces from '../../types/plugins';
import * as corplistDefault from '../defaultCorparch/corplist';
import * as Kontext from '../../types/kontext';
import { IFullActionControl, StatelessModel } from 'kombo';
import { Observable } from 'rxjs';
import { CorplistItem } from '../defaultCorparch/common';
import { Actions} from './actions';
import { HTTP } from 'cnc-tskit';
import { IPluginApi } from '../../types/plugins/common';


export interface CorplistTableModelState extends corplistDefault.CorplistTableModelState {
    rows:Array<CorplistItem>;
}

/**
 * This model handles table dataset
 */
export class CorplistTableModel extends corplistDefault.CorplistTableModel {

    static LoadLimit:number = 5000;

    /**
     *
     */
    constructor(
        dispatcher:IFullActionControl,
        pluginApi:IPluginApi,
        initialData:corplistDefault.CorplistServerData,
        preselectedKeywords:Array<string>
    ) {
        super(dispatcher, pluginApi, initialData, preselectedKeywords);
    }
}

export class CorpusAccessRequestModel extends StatelessModel<{isBusy:boolean;}> {

    private pluginApi:IPluginApi;

    constructor(dispatcher:IFullActionControl, pluginApi:IPluginApi) {
        super(dispatcher, {isBusy: false});
        this.pluginApi = pluginApi;

        this.addActionHandler<typeof Actions.CorpusAccessReqSubmitted>(
            Actions.CorpusAccessReqSubmitted.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.askForAccess(
                    action.payload.corpusId,
                    action.payload.corpusName,
                    action.payload.customMessage

                ).subscribe(
                    null,
                    (error) => {
                        this.pluginApi.showMessage('error', error);
                        dispatch<typeof Actions.CorpusAccessReqSubmittedDone>({
                            name: Actions.CorpusAccessReqSubmittedDone.name
                        });
                    },
                    () => {
                        this.pluginApi.showMessage('info',
                            this.pluginApi.translate('ucnkCorparch__your_message_sent')
                        );
                        dispatch<typeof Actions.CorpusAccessReqSubmittedDone>({
                            name: Actions.CorpusAccessReqSubmittedDone.name
                        });
                    },
                );
            }
        );

        this.addActionHandler<typeof Actions.CorpusAccessReqSubmittedDone>(
            Actions.CorpusAccessReqSubmittedDone.name,
            (state, action) => {
                state.isBusy = false;
            }
        );
    }

    private askForAccess(
        corpusId:string,
        corpusName:string,
        customMessage:string
    ):Observable<Kontext.AjaxResponse> {
        return this.pluginApi.ajax$<Kontext.AjaxResponse>(
            HTTP.Method.POST,
            this.pluginApi.createActionUrl('user/ask_corpus_access'),
            {
                corpusId,
                corpusName,
                customMessage
            }
        );
    }
}

/**
 * Corplist page 'model'.
 */
export class CorplistPage implements PluginInterfaces.Corparch.ICorplistPage {

    components:any;

    pluginApi:IPluginApi;

    protected corpusAccessRequestModel:CorpusAccessRequestModel;

    protected corplistTableModel:CorplistTableModel;

    constructor(
        pluginApi:IPluginApi,
        initialData:corplistDefault.CorplistServerData,
        viewsInit:((...args:any[])=>any)
    ) {
        this.pluginApi = pluginApi;
        this.corpusAccessRequestModel = new CorpusAccessRequestModel(
            pluginApi.dispatcher(),
            pluginApi
        );
        this.corplistTableModel = new CorplistTableModel(
            pluginApi.dispatcher(),
            pluginApi,
            initialData,
            pluginApi.getConf('pluginData')['corparch']['initial_keywords'] || []
        );
        this.components = viewsInit(this.corplistTableModel);
    }

    getForm():React.ComponentClass {
        return this.components.FilterForm;
    }

    getList():React.ComponentClass {
        return this.components.CorplistTable;
    }

}