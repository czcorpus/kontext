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

import { throwError } from 'rxjs';
import { Kontext } from '../../types/common';
import { PluginInterfaces, IPluginApi } from '../../types/plugins';
import { init as viewInit, Views as TreeCorparchViews } from './view';
import { StatelessModel, SEDispatcher } from 'kombo';
import { map } from 'rxjs/operators';
import { ActionName, Actions } from './actions';
import { List, HTTP } from 'cnc-tskit';
import { IUnregistrable } from '../../models/common/common';
import { Actions as GlobalActions, ActionName as GlobalActionName }
    from '../../models/common/actions';

declare var require:any;
require('./style.less'); // webpack


export interface Node {
    name: string;
    ident?: string;
    corplist?: Array<Node>
}

export interface TreeResponseData extends Kontext.AjaxResponse {
    corplist:Array<Node>;
}

export interface TreeWidgetModelState {
    active:boolean;
    corpusIdent:Kontext.FullCorpusIdent;
    data:Node;
    nodeActive:{[key:string]:boolean};
}

/**
 *
 */
export class TreeWidgetModel extends StatelessModel<TreeWidgetModelState>
    implements IUnregistrable {

    protected pluginApi:IPluginApi;

    private corpusClickHandler:PluginInterfaces.Corparch.CorplistItemClick;

    constructor(pluginApi:IPluginApi, corpusIdent:Kontext.FullCorpusIdent,
                corpusClickHandler:PluginInterfaces.Corparch.CorplistItemClick) {
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

        this.addActionHandler<Actions.SetNodeStatus>(
            ActionName.SetNodeStatus,
            (state, action) => {
                state.nodeActive[action.payload.nodeId] = !state.nodeActive[action.payload.nodeId];
            }
        );

        this.addActionHandler<Actions.Deactivate>(
            ActionName.Deactivate,
            (state, action) => {state.active = false;},
        );

        this.addActionHandler<Actions.GetData>(
            ActionName.GetData,
            (state, action) => {},
            (state, action, dispatch) => this.loadData(state, dispatch)
        );

        this.addActionHandler<Actions.GetDataDone>(
            ActionName.GetDataDone,
            (state, action) => {
                state.active = true;
                state.data = action.payload.node;
                state.nodeActive = action.payload.nodeActive;
            }
        );

        this.addActionHandler<Actions.LeafNodeClicked>(
            ActionName.LeafNodeClicked,
            (state, action) => {
                this.corpusClickHandler(
                    [action.payload.ident],
                    this.pluginApi.getCorpusIdent().usesubcorp
                );
            }
        );

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
    }

    private importTree(
        nodeActive:{[key:string]:boolean},
        rootNode:Node, nodeId:string='a'
    ):{node:Node, nodeActive:{[key:string]:boolean}} {

        const node = {
            name: rootNode.name,
            ident: rootNode.ident,
            corplist: []
        };
        if (rootNode.corplist) {
            node.ident = nodeId;
            node.corplist = List.map((node, i) =>
                this.importTree(
                    nodeActive,
                    node,
                    nodeId + '.' + String(i)
                ).node,
                rootNode.corplist
            );
        }
        nodeActive[node.ident] = false;
        return {node, nodeActive};
    }

    getRegistrationId():string {
        return 'tree-corparch-model';
    }

    dumpNode(rootNode:Node):void {
        if (rootNode.corplist) {
            rootNode.corplist.forEach((item) => this.dumpNode(item));
        }
    }

    loadData(state:TreeWidgetModelState, dispatch:SEDispatcher) {
        return this.pluginApi.ajax$<any>(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl('corpora/ajax_get_corptree_data'),
            {}

        ).pipe(
            map((data) => {
                if (data.containsErrors) {
                    throw throwError('Data contain error');

                } else {
                    return this.importTree({}, data);
                }
            })
        ).subscribe(
            next => dispatch<Actions.GetDataDone>({
                name: ActionName.GetDataDone,
                payload: next
            }),
            err => this.pluginApi.showMessage('error', err)
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
            pluginApi.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
            (corpora:Array<string>, subcorpId:string) => {
                window.location.href = pluginApi.createActionUrl(
                    'query', [['corpname', corpora]]);
                return null; // just to keep the type check cool
            }
        );
        this.viewsLib = viewInit(
            pluginApi.dispatcher(),
            pluginApi.getComponentHelpers(),
            this.treeModel
        );
    }

    getForm():React.SFC<{}> {
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
    createWidget(targetAction:string, options:Kontext.GeneralProps):React.ComponentClass {
        this.treeModel = new TreeWidgetModel(
            this.pluginApi,
            this.pluginApi.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
            options.itemClickAction
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