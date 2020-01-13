/*
 * Copyright (c) 2013 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

import {Kontext} from '../types/common';
import {AjaxResponse} from '../types/ajaxResponses';
import {PageModel} from '../app/page';
import {SubcorpListModel, SortKey, SubcListFilter} from '../models/subcorp/list';
import {init as listViewInit} from '../views/subcorp/list';
import { KontextPage } from '../app/main';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/subcorpList.less');


/**
 *
 */
class SubcorpListPage {

    private layoutModel:PageModel;

    private subcorpListModel:SubcorpListModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private renderView():void {
        const views = listViewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.subcorpListModel
        );
        const props = {};
        this.layoutModel.renderReactComponent(
            views.SubcorpList,
            window.document.getElementById('my-subcorpora-mount'),
            props
        );
    }

    init():void {
        this.layoutModel.init(() => {
            this.subcorpListModel = new SubcorpListModel(
                this.layoutModel.dispatcher,
                this.layoutModel,
                this.layoutModel.getConf<Array<AjaxResponse.ServerSubcorpListItem>>('SubcorpList'),
                this.layoutModel.getConf<SortKey>('SortKey'),
                this.layoutModel.getConf<Array<string>>('RelatedCorpora'),
                this.layoutModel.getConf<Array<Kontext.AsyncTaskInfo>>('ProcessedSubcorpora'),
                this.layoutModel.getConf<SubcListFilter>('Filter')
            );
            this.renderView();
            this.layoutModel.addUiTestingFlag();
        });
    }
}

/**
 * A function used to initialize the model on a respective page.
 */
export function init(conf):void {
    new SubcorpListPage(new KontextPage(conf)).init();
}
