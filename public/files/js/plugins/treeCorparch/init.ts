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


/// <reference path="../../../ts/declarations/common.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />
/// <reference path="../../../ts/declarations/flux.d.ts" />
/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../common/plugins/corparch.ts" />

/// <amd-dependency path="./view" name="views" />
declare var views:any;

import util = require('../../util');
import Immutable = require('vendor/immutable');
import $ = require('jquery');


// -----------------------------------------------------------
// TODO - testing data
let TESTING_DATA = {
    "name": "All the corpora",
    "corplist" : [
        {"name" : "Corpus 1", "ident": "corpus_1"},
        {"name" : "Corpus 2", "ident": "corpus_2"},
        {
            "name" : "Foreign",
            "corplist": [
                {"name": "Corpus Foreign 1", "ident": "corpus_foreign_1"}
            ]
        },
        {"name" : "Corpus 3", "ident": "corpus_3"},
    ]
};
// -----------------------------------------------------------

export interface Node {
    active: boolean;
    name: string;
    ident?: string;
    corplist?: Immutable.List<Node>
}

/**
 *
 */
export class TreeWidgetStore extends util.SimplePageStore {

    static DispatchToken:string;

    protected pluginApi:Kontext.PluginApi;

    private data:Node;

    private widgetId:number;

    constructor(pluginApi:Kontext.PluginApi) {
        super(pluginApi.dispatcher());
    }

    private importTree(rootNode:any) {
        rootNode['active'] = false;
        console.log('rootNode: ', rootNode);
        if (rootNode['corplist']) {
            rootNode['corplist'] = Immutable.List(
                rootNode['corplist'].map((node) => {
                    this.importTree(node);
                })
            );

        } else {
            rootNode['corplist'] = Immutable.List([]);
        }
        return rootNode;
    }

    dumpNode(rootNode:Node):void {
        console.log(rootNode['name']);
        if (rootNode['corplist']) {
            rootNode['corplist'].forEach((item) => this.dumpNode(item));
        }
    }

    loadData(data:any) {
        this.data = this.importTree(data);
        this.dumpNode(this.data);
    }
}


/**
 * Creates a corplist widget which is a box containing two tabs
 *  1) user's favorite items
 *  2) corpus search tool
 *
 * @param selectElm A HTML SELECT element for default (= non JS) corpus selection we want to be replaced by this widget
 * @param pluginApi
 * @param options A configuration for the widget
 */
export function create(selectElm:HTMLElement, pluginApi:Kontext.QueryPagePluginApi,
                       options:CorpusArchive.Options) {
    let widgetWrapper = window.document.createElement('div');
    $(widgetWrapper).addClass('corp-tree-wrapper');
    $(selectElm).replaceWith(widgetWrapper);

    let treeStore = new TreeWidgetStore(pluginApi);
    treeStore.loadData(TESTING_DATA); // TODO test
    let viewsLib = views.init(pluginApi.dispatcher(), pluginApi.exportMixins(),
            treeStore);
    pluginApi.renderReactComponent(viewsLib.CorptreeWidget, widgetWrapper);
}