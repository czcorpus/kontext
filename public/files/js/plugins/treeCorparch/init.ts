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


/// <reference path="../../types/common.d.ts" />
/// <reference path="../../types/plugins.d.ts" />
/// <reference path="./view.d.ts" />
/// <reference path="../../vendor.d.ts/immutable.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />
/// <reference path="../../vendor.d.ts/react.d.ts" />

import {SimplePageStore} from '../../stores/base';
import * as Immutable from 'vendor/immutable';
import {init as viewInit, TreeCorparchViews} from './view';
import {QueryStore} from '../../stores/query/main';

declare var require:any;
require('./style.less'); // webpack


export interface Node {
    active: boolean;
    name: string;
    ident?: string;
    corplist?: Immutable.List<Node>
}

/**
 *
 */
export class TreeWidgetStore extends SimplePageStore {

    static DispatchToken:string;

    protected pluginApi:Kontext.PluginApi;

    private data:Node;

    private idMap:Immutable.Map<string, Node>;

    private widgetId:number;

    private corpusClickHandler:Kontext.CorplistItemClick;

    private corpusIdent:Kontext.FullCorpusIdent;

    private querySetupHandler:Kontext.QuerySetupHandler

    constructor(pluginApi:Kontext.PluginApi, corpusIdent:Kontext.FullCorpusIdent,
                querySetupHandler:Kontext.QuerySetupHandler,
                corpusClickHandler:Kontext.CorplistItemClick) { // TODO type !!!!
        super(pluginApi.dispatcher());
        this.pluginApi = pluginApi;
        this.corpusIdent = corpusIdent;
        this.querySetupHandler = querySetupHandler;
        this.corpusClickHandler = corpusClickHandler;
        this.idMap = Immutable.Map<string, Node>();
        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
                switch (payload.actionType) {
                    case 'TREE_CORPARCH_SET_NODE_STATUS':
                        let item = this.idMap.get(payload.props['nodeId']);
                        item.active = !item.active;
                        this.notifyChangeListeners();
                    break;
                    case 'TREE_CORPARCH_GET_DATA':
                        this.loadData().then(
                            (d) => this.notifyChangeListeners(),
                            (err) => {
                                this.pluginApi.showMessage('error', err);
                            }
                        );
                    break;
                    case 'TREE_CORPARCH_LEAF_NODE_CLICKED':
                        this.corpusClickHandler(
                            [payload.props['ident']],
                            this.querySetupHandler.getCurrentSubcorpus()
                        );
                    break;
                }
            }
        );
    }

    private importTree(rootNode:any, nodeId:string='a') {
        rootNode['active'] = false;
        if (rootNode['corplist']) {
            rootNode['ident'] = nodeId;
            this.idMap = this.idMap.set(nodeId, rootNode);
            rootNode['corplist'] = Immutable.List(
                rootNode['corplist'].map((node, i) => this.importTree(node, nodeId + '.' + String(i)))
            );

        } else {
            rootNode['corplist'] = Immutable.List([]);
        }
        return rootNode;
    }

    dumpNode(rootNode:Node):void {
        if (rootNode['corplist']) {
            rootNode['corplist'].forEach((item) => this.dumpNode(item));
        }
    }

    loadData():RSVP.Promise<any> {
        let prom:RSVP.Promise<any> = this.pluginApi.ajax<any>(
            'GET',
            this.pluginApi.createActionUrl('corpora/ajax_get_corptree_data'),
            {},
            { contentType : 'application/x-www-form-urlencoded' }
        );
        return prom.then(
            (data) => {
                if (!data.containsErrors) {
                    this.data = this.importTree(data);

                } else {
                    this.pluginApi.showMessage('error', data.message);
                }
            },
            (error) => {
                this.pluginApi.showMessage('error', error);
            }
        );
    }

    getData():Node {
        return this.data;
    }

    getCurrentCorpusIdent():Kontext.FullCorpusIdent {
        return this.corpusIdent;
    }
}


/**
 * Creates a corplist widget which is a box containing two tabs
 *  1) user's favorite items
 *  2) corpus search tool
 *
 * @param targetElm - an element the component will mount to
 * @param targetAction - ignored here
 * @param pluginApi
 * @param querySetupHandler - query form functions
 * @param options A configuration of the widget
 */
export function createWidget(targetAction:string, pluginApi:Kontext.PluginApi,
            queryStore:QueryStore, querySetupHandler:Kontext.QuerySetupHandler, options:any):React.ComponentClass {
    const widgetWrapper = window.document.createElement('div');

    const treeStore = new TreeWidgetStore(
        pluginApi,
        pluginApi.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
        querySetupHandler,
        options.itemClickAction
    );
    return viewInit(pluginApi.dispatcher(), pluginApi.getComponentHelpers(), treeStore).CorptreeWidget;
}


export class CorplistPage implements PluginInterfaces.ICorplistPage {

    private pluginApi:Kontext.PluginApi;

    private treeStore:TreeWidgetStore;

    private viewsLib:TreeCorparchViews;

    constructor(pluginApi:Kontext.PluginApi) {
        this.pluginApi = pluginApi;
        this.treeStore = new TreeWidgetStore(
            pluginApi,
            pluginApi.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
            {
                registerCorpusSelectionListener: (fn:(corpusId:string, aligned:Immutable.List<string>, subcorpusId:string)=>void) => {},
                getCorpora: () => Immutable.List<string>(pluginApi.getConf<Kontext.FullCorpusIdent>('corpusIdent').id),
                getAvailableAlignedCorpora: () => Immutable.List<Kontext.AttrItem>(),
                getCurrentSubcorpus: () => null
            },
            (corpora:Array<string>, subcorpId:string) => {
                window.location.href = pluginApi.createActionUrl('first_form?corpname=' + corpora[0]);
                return null; // just to keep the type check cool
            }
        );
        this.viewsLib = viewInit(
            pluginApi.dispatcher(),
            pluginApi.getComponentHelpers(),
            this.treeStore
        );
    }

    setData(data:any):void {
    }

    getForm():React.ComponentClass {
        return this.viewsLib.FilterPageComponent;
    }

    getList():React.ComponentClass {
        return this.viewsLib.CorptreePageComponent;
    }
}


export function initCorplistPageComponents(pluginApi:Kontext.PluginApi):CorplistPage {
    return new CorplistPage(pluginApi);
}