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

/// <reference path="../vendor.d.ts/rsvp.d.ts" />

import {Kontext} from '../types/common';
import {AjaxResponse} from '../types/ajaxResponses';
import {PageModel, PluginApi} from '../app/main';
import * as corplist from 'plugins/corparch/init';
import {SubcorpListStore, SortKey, SubcListFilter} from '../models/subcorp/list';
import {init as listViewInit} from 'views/subcorp/list';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/subcorpList.less');

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


class SubcorpListPage {

    private layoutModel:PageModel;

    private subcorpListStore:SubcorpListStore;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private renderView():void {
        const views = listViewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.subcorpListStore
        );
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
                this.subcorpListStore = new SubcorpListStore(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    this.layoutModel.getConf<Array<AjaxResponse.ServerSubcorpListItem>>('SubcorpList'),
                    this.layoutModel.getConf<SortKey>('SortKey'),
                    this.layoutModel.getConf<Array<string>>('RelatedCorpora'),
                    this.layoutModel.getConf<Array<Kontext.AsyncTaskInfo>>('UnfinishedSubcorpora'),
                    this.layoutModel.getConf<SubcListFilter>('Filter')
                );
                this.renderView();
            }

        ).then(
            this.layoutModel.addUiTestingFlag

        ).catch(
            (err) => console.error(err)
        );
    }
}

/**
 * A function used to initialize the model on a respective page.
 */
export function init(conf):void {
    const layoutModel = new PageModel(conf);
    const pageModel = new SubcorpListPage(layoutModel);
    pageModel.init();
}
