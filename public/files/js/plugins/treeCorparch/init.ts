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

import * as Kontext from '../../types/kontext.js';
import * as PluginInterfaces from '../../types/plugins/index.js';
import { init as viewInit, Views as TreeCorparchViews } from './view.js';
import { StatelessModel, SEDispatcher } from 'kombo';
import { Actions, Corplist, itemIsCorplist } from './common.js';
import { List, HTTP, pipe, tuple, Dict } from 'cnc-tskit';
import { IUnregistrable } from '../../models/common/common.js';
import { Actions as GlobalActions } from '../../models/common/actions.js';
import { IPluginApi } from '../../types/plugins/common.js';
import { InitialWidgetData } from '../../types/plugins/corparch.js';


export interface TreeResponseData extends Kontext.AjaxResponse {
    corplist:Corplist;
}

export interface TreeWidgetModelState {
    active:boolean;
    corpusIdent:Kontext.FullCorpusIdent;
    data:Corplist;
    nodeActive:{[key:string]:boolean};
}

/**
 *
 */
export class TreeWidgetModel extends StatelessModel<TreeWidgetModelState>
    implements IUnregistrable {

    protected pluginApi:IPluginApi;

    private corpusClickHandler:PluginInterfaces.Corparch.CorpusSelectionHandler;

    constructor(
        pluginApi:IPluginApi,
        corpusIdent:Kontext.FullCorpusIdent,
        corpusClickHandler:PluginInterfaces.Corparch.CorpusSelectionHandler
    ) {
        super(
            pluginApi.dispatcher(),
            {
                active: false,
                corpusIdent,
                data: null,
                nodeActive: {}
            }
        );
        this.pluginApi = pluginApi;
        this.corpusClickHandler = corpusClickHandler;

        this.addActionHandler<typeof Actions.SetNodeStatus>(
            Actions.SetNodeStatus.name,
            (state, action) => {
                state.nodeActive[action.payload.nodeId] = !state.nodeActive[action.payload.nodeId];
            }
        );

        this.addActionHandler<typeof Actions.Deactivate>(
            Actions.Deactivate.name,
            (state, action) => {state.active = false;},
        );

        this.addActionHandler<typeof Actions.GetData>(
            Actions.GetData.name,
            (state, action) => {},
            (state, action, dispatch) => this.loadData(state, dispatch)
        );

        this.addActionHandler<typeof Actions.GetDataDone>(
            Actions.GetDataDone.name,
            (state, action) => {
                state.active = true;
                state.data = action.payload.corplist;
                state.nodeActive = pipe(
                    this.getAllNodes(state.data),
                    List.map(v => tuple(v.ident, false)),
                    Dict.fromEntries()
                );
            }
        );

        this.addActionHandler<typeof Actions.LeafNodeClicked>(
            Actions.LeafNodeClicked.name,
            (state, action) => {
                this.corpusClickHandler(
                    [action.payload.ident],
                    this.pluginApi.getCorpusIdent().usesubcorp
                );
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
        return 'tree-corparch-model';
    }

    loadData(state:TreeWidgetModelState, dispatch:SEDispatcher) {
        return this.pluginApi.ajax$<Corplist>(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl('corpora/ajax_get_corptree_data'),
            {}

        ).subscribe({
            next: corplist => dispatch<typeof Actions.GetDataDone>({
                name: Actions.GetDataDone.name,
                payload: {corplist}
            }),
            error: error => this.pluginApi.showMessage('error', error)
        });
    }

    private getAllNodes(node:Corplist):Array<Corplist> {
        return pipe(
            node.corplist,
            List.filter(itemIsCorplist),
            List.foldl(
                (acc, curr) => List.concat(this.getAllNodes(curr), List.push(curr, acc)),
                [node] as Array<Corplist>
            )
        );
    }
}


export class CorplistPage implements PluginInterfaces.Corparch.ICorplistPage {

    private pluginApi:IPluginApi;

    private treeModel:TreeWidgetModel;

    private viewsLib:TreeCorparchViews;

    constructor(pluginApi:IPluginApi) {
        this.pluginApi = pluginApi;
        this.treeModel = new TreeWidgetModel(
            pluginApi,
            pluginApi.getCorpusIdent(),
            (corpora:Array<string>, subcorpId:string) => {
                window.location.href = pluginApi.createActionUrl(
                    'query',
                    {
                        corpname: List.head(corpora),
                        align: List.tail(corpora)
                    }
                );
                return null; // just to keep the type check cool
            }
        );
        this.viewsLib = viewInit(
            pluginApi.dispatcher(),
            pluginApi.getComponentHelpers(),
            this.treeModel
        );
    }

    getForm():React.FC<{}> {
        return this.viewsLib.FilterPageComponent;
    }

    getList():React.ComponentClass {
        return this.viewsLib.CorptreePageComponent;
    }
}


class Plugin {

    private pluginApi:IPluginApi;

    private treeModel:TreeWidgetModel;

    constructor(pluginApi:IPluginApi) {
        this.pluginApi = pluginApi;
    }

    isActive():boolean {
        return true;
    }

    /**
     * Creates a corplist widget which is a box containing two tabs
     *  1) user's favorite items
     *  2) corpus search tool
     *
     * @param targetElm - an element the component will mount to
     * @param targetAction - ignored here
     * @param options A configuration of the widget
     */
    createWidget(
        widgetId:string,
        _:string,
        onCorpusSelection:PluginInterfaces.Corparch.CorpusSelectionHandler,
        initialData?:InitialWidgetData
    ):React.ComponentClass<{widgetId:string}> {
        this.treeModel = new TreeWidgetModel(
            this.pluginApi,
            this.pluginApi.getCorpusIdent(),
            onCorpusSelection
        );
        return viewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            this.treeModel
        ).CorptreeWidget;
    }

    unregister():void {
        this.treeModel.unregister();
    }

    getRegistrationId():string {
        return this.treeModel.getRegistrationId();
    }

    initCorplistPageComponents():CorplistPage {
        return new CorplistPage(this.pluginApi);
    }
}


const create:PluginInterfaces.Corparch.Factory = (pluginApi) => {
    return new Plugin(pluginApi);
}

export default create;