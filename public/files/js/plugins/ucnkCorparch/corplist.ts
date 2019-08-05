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

import * as Immutable from 'immutable';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {StatefulModel} from '../../models/base';
import * as corplistDefault from '../defaultCorparch/corplist';
import { Kontext } from '../../types/common';
import { IActionDispatcher, Action } from 'kombo';
import { Observable } from 'rxjs';
import { CorplistItem } from '../defaultCorparch/common';


export interface CorplistTableModelState extends corplistDefault.CorplistTableModelState {
    rows:Immutable.List<CorplistItem>;
}

/**
 * This model handles table dataset
 */
export class CorplistTableModel extends corplistDefault.CorplistTableModel {

    static LoadLimit:number = 5000;

    /**
     *
     */
    constructor(dispatcher:IActionDispatcher, pluginApi:IPluginApi, initialData:corplistDefault.CorplistServerData, preselectedKeywords:Array<string>) {
        super(dispatcher, pluginApi, initialData, preselectedKeywords);
    }
}

export class CorpusAccessRequestModel extends StatefulModel {

    private pluginApi:IPluginApi;

    static DispatchToken:string;

    constructor(dispatcher:IActionDispatcher, pluginApi:IPluginApi) {
        super(dispatcher);
        this.pluginApi = pluginApi;
    }

    onAction(action:Action):void {
        switch (action.name) {
            case 'CORPUS_ACCESS_REQ_SUBMITTED':
                this.askForAccess(action.payload['corpusId'], action.payload['corpusName'], action.payload['customMessage']).subscribe(
                    null,
                    (error) => {
                        this.pluginApi.showMessage('error', error);
                    },
                    () => {
                        this.pluginApi.showMessage('info',
                            this.pluginApi.translate('ucnkCorparch__your_message_sent'));
                            this.emitChange();
                    },
                );
            break;
        }
    }

    private askForAccess(corpusId:string, corpusName:string, customMessage:string):Observable<Kontext.AjaxResponse> {
        return this.pluginApi.ajax$<Kontext.AjaxResponse>(
            'POST',
            this.pluginApi.createActionUrl('user/ask_corpus_access'),
            {
                corpusId: corpusId,
                corpusName: corpusName,
                customMessage: customMessage
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

    constructor(pluginApi:IPluginApi, initialData:corplistDefault.CorplistServerData, viewsInit:((...args:any[])=>any)) {
        this.pluginApi = pluginApi;
        this.corpusAccessRequestModel = new CorpusAccessRequestModel(pluginApi.dispatcher(), pluginApi);
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