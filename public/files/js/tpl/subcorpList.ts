/*
 * Copyright (c) 2013 Institute of the Czech National Corpus
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

/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />
/// <reference path="../types/common.d.ts" />
/// <reference path="../types/ajaxResponses.d.ts" />

import $ = require('jquery');
import {PageModel, PluginApi} from './document';
import corplist = require('plugins/corparch/init');
import popupBox = require('../popupbox');
import {SubcorpListStore, SortKey} from '../stores/subcorp/list';
import {init as listViewInit} from 'views/subcorp/list';

/**
 * Server-defined data (subcorpus/ajax_subcorp_info)
 */
interface SubcorpusExtendedInfo {
    corpname:string;
    cql:string;
    id:number;
    subcname:string;
    timestamp:number;
    user_id:number;
}

/**
 * Server-defined data (subcorpus/ajax_subcorp_info)
 */
interface SubcorpusInfo {
    corpusName:string;
    subCorpusName:string;
    corpusSize:string;
    subCorpusSize:string;
    created:string;
    extended_info:SubcorpusExtendedInfo
}

/**
 * This is an extended version of PluginApi as required by corparch plug-ins.
 * But in this case most of added methods are useless...
 *
 * @todo current version of KonText does not use corpus selection widget
 * here on the 'subcorp_list' page which makes this class useless
 * @deprecated
 */
class ExtendedApi extends PluginApi implements Kontext.QueryPagePluginApi {

    pluginApi:Kontext.PluginApi;

    queryFieldsetToggleEvents:Array<(elm:HTMLElement)=>void>;

    queryFieldsetReadyEvents:Array<(elm:HTMLElement)=>void>;

    constructor(model:PageModel) {
        super(model);
        this.queryFieldsetToggleEvents = [];
        this.queryFieldsetReadyEvents = [];
    }

    bindFieldsetToggleEvent(fn:(elm:HTMLElement)=>void) {
        this.queryFieldsetToggleEvents.push(fn);
    }

    bindFieldsetReadyEvent(fn:(elm:HTMLElement)=>void) {
        this.queryFieldsetReadyEvents.push(fn);
    }

    registerOnSubcorpChangeAction(fn:(subcname:string)=>void) {}

    registerOnAddParallelCorpAction(fn:(corpname:string)=>void) {}

    registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void) {}

    registerOnRemoveParallelCorpAction(fn:(corpname:string)=>void) {}

    applyOnQueryFieldsetToggleEvents(elm:HTMLElement) {
        this.queryFieldsetReadyEvents.forEach((fn)=>fn(elm));
    }

    applyOnQueryFieldsetReadyEvents(elm:HTMLElement) {
        this.queryFieldsetReadyEvents.forEach((fn)=>fn(elm));
    }
}


class SubcorpListPage {

    private layoutModel:PageModel;

    private subcorpListStore:SubcorpListStore;

    constructor(layoutModel:PageModel, subcorpListStore:SubcorpListStore) {
        this.layoutModel = layoutModel;
        this.subcorpListStore = subcorpListStore;
    }

    private renderView():void {
        const views = listViewInit(this.layoutModel.dispatcher, this.layoutModel.exportMixins(),
                this.layoutModel.layoutViews, this.subcorpListStore);
        const props = {};
        this.layoutModel.renderReactComponent(
            views.SubcorpList,
            window.document.getElementById('my-subcorpora-mount'),
            props
        );
    }


    init():void {
        this.layoutModel.init().then(
            (data) => {
                this.renderView();
            }
        );
    }
}

/**
 * A function used to initialize the model on a respective page.
 */
export function init(conf) {
    const layoutModel = new PageModel(conf);
    const subcorpListStore = new SubcorpListStore(
        layoutModel.dispatcher,
        layoutModel,
        layoutModel.getConf<Array<AjaxResponse.ServerSubcorpListItem>>('SubcorpList'),
        layoutModel.getConf<SortKey>('SortKey'),
        layoutModel.getConf<Array<string>>('RelatedCorpora'),
        layoutModel.getConf<Array<AjaxResponse.UnfinishedSubcorp>>('UnfinishedSubcorpora')
    );
    const pageModel = new SubcorpListPage(layoutModel, subcorpListStore);
    pageModel.init();
}
