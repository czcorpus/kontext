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

import {Kontext} from '../../types/common';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {ActionPayload} from '../../app/dispatcher';
import {StatefulModel} from '../../models/base';
import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import {init as viewInit, Views as TreeCorparchViews} from './view';
import {QueryModel} from '../../models/query/first';
import { QuerySaveAsFormModel } from '../../models/query/save';

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
export class TreeWidgetModel extends StatefulModel {

    static DispatchToken:string;

    protected pluginApi:IPluginApi;

    private data:Node;

    private idMap:Immutable.Map<string, Node>;

    private widgetId:number;

    private corpusClickHandler:Kontext.CorplistItemClick;

    private corpusIdent:Kontext.FullCorpusIdent;

    private queryModel:PluginInterfaces.Corparch.ICorpSelection;

    constructor(pluginApi:IPluginApi, corpusIdent:Kontext.FullCorpusIdent,
                queryModel:PluginInterfaces.Corparch.ICorpSelection, corpusClickHandler:Kontext.CorplistItemClick) { // TODO type !!!!
        super(pluginApi.dispatcher());
        this.pluginApi = pluginApi;
        this.corpusIdent = corpusIdent;
        this.queryModel = queryModel;
        this.corpusClickHandler = corpusClickHandler;
        this.idMap = Immutable.Map<string, Node>();
        this.dispatcher.register((payload:ActionPayload) => {
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
                            this.queryModel.getCurrentSubcorpus()
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


export class CorplistPage implements PluginInterfaces.Corparch.ICorplistPage {

    private pluginApi:IPluginApi;

    private treeModel:TreeWidgetModel;

    private viewsLib:TreeCorparchViews;

    private queryModel:PluginInterfaces.Corparch.ICorpSelection;

    constructor(pluginApi:IPluginApi, queryModel:PluginInterfaces.Corparch.ICorpSelection) {
        this.pluginApi = pluginApi;
        this.queryModel = queryModel;
        this.treeModel = new TreeWidgetModel(
            pluginApi,
            pluginApi.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
            queryModel,
            (corpora:Array<string>, subcorpId:string) => {
                window.location.href = pluginApi.createActionUrl('first_form?corpname=' + corpora[0]);
                return null; // just to keep the type check cool
            }
        );
        this.viewsLib = viewInit(
            pluginApi.dispatcher(),
            pluginApi.getComponentHelpers(),
            this.treeModel
        );
    }

    setData(data:any):void {
    }

    getForm():React.SFC<{}> {
        return this.viewsLib.FilterPageComponent;
    }

    getList():React.ComponentClass {
        return this.viewsLib.CorptreePageComponent;
    }
}


class DummyQueryModel implements PluginInterfaces.Corparch.ICorpSelection {

    getCurrentSubcorpus():string {
        return null;
    }

    getCurrentSubcorpusOrigName():string {
        return null;
    }

    getAvailableSubcorpora():Immutable.List<Kontext.SubcorpListItem> {
        return Immutable.List<Kontext.SubcorpListItem>();
    }

    getAvailableAlignedCorpora():Immutable.List<Kontext.AttrItem> {
        return Immutable.List<Kontext.AttrItem>();
    }

    getCorpora():Immutable.List<string> {
        return Immutable.List<string>();
    }

    getIsForeignSubcorpus():boolean {
        return false;
    }

    addChangeListener(fn:()=>void):void {}

    removeChangeListener(fn:()=>void):void {}

    notifyChangeListeners(eventType?:string, error?:Error):void {}
}


class Plugin {

    private pluginApi:IPluginApi;

    constructor(pluginApi:IPluginApi) {
        this.pluginApi = pluginApi;
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
    createWidget(targetAction:string, queryModel:QueryModel, options:Kontext.GeneralProps):React.ComponentClass {
        const widgetWrapper = window.document.createElement('div');

        const treeModel = new TreeWidgetModel(
            this.pluginApi,
            this.pluginApi.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
            queryModel,
            options.itemClickAction
        );
        return viewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            treeModel
        ).CorptreeWidget;
    }


    initCorplistPageComponents():CorplistPage {
        return new CorplistPage(this.pluginApi, new DummyQueryModel());
    }
}


const create:PluginInterfaces.Corparch.Factory = (pluginApi) => {
    return new Plugin(pluginApi);
}

export default create;