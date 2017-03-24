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
/// <reference path="../../types/plugins/corparch.d.ts" />
/// <reference path="./view.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />
/// <reference path="../../../ts/declarations/flux.d.ts" />
/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />

import {SimplePageStore} from '../../stores/base';
import * as Immutable from 'vendor/immutable';
import * as $ from 'jquery';
import {init as viewInit} from './view';


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

    private corpusClickHandler:(item:CorparchCommon.Item)=>void;

    constructor(pluginApi:Kontext.PluginApi, corpusClickHandler:(item:CorparchCommon.Item)=>void) {
        super(pluginApi.dispatcher());
        this.pluginApi = pluginApi;
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
                        this.corpusClickHandler({
                            corpus_id: payload.props['ident']
                        });
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
export function create(targetElm:HTMLElement, targetAction:string, pluginApi:Kontext.PluginApi,
            querySetupHandler:Kontext.QuerySetupHandler, options:CorparchCommon.Options):void {
    const widgetWrapper = window.document.createElement('div');
    $(widgetWrapper).addClass('corp-tree-wrapper');
    $(targetElm).replaceWith(widgetWrapper);
    const treeStore = new TreeWidgetStore(
        pluginApi,
        (item:CorparchCommon.Item) => {
            window.location.href = pluginApi.createActionUrl('first_form?corpname=' + item.corpus_id);
        }
    );
    const viewsLib = viewInit(pluginApi.dispatcher(), pluginApi.exportMixins(),
            treeStore);
    pluginApi.renderReactComponent(
        viewsLib.CorptreeWidget,
        widgetWrapper,
        {currentCorpus: pluginApi.getConf<string>('humanCorpname')}
    );
}


export class CorplistPage implements CorplistPage {

    private pluginApi:Kontext.PluginApi;

    private treeStore:TreeWidgetStore;

    private viewsLib:any;

    constructor(pluginApi:Kontext.PluginApi) {
        this.pluginApi = pluginApi;
        this.treeStore = new TreeWidgetStore(pluginApi, (item:CorparchCommon.Item) => {
            window.location.href = pluginApi.createActionUrl('first_form?corpname=' + item.corpus_id);
        });
        this.viewsLib = viewInit(pluginApi.dispatcher(), pluginApi.exportMixins(),
                this.treeStore);
    }

    createForm(targetElm:HTMLElement, properties:any):void {}

    createList(targetElm:HTMLElement, properties:any):void {
        let wrapper = window.document.createElement('div');
        $('section.corplist').append(wrapper);

        this.pluginApi.renderReactComponent(
            this.viewsLib.CorptreePageComponent,
            wrapper,
            {
                currentCorpus: this.pluginApi.getConf<string>('humanCorpname')
            }
        );
    }
}


export function initCorplistPageComponents(pluginApi:Kontext.PluginApi):CorplistPage {
    return new CorplistPage(pluginApi);
}