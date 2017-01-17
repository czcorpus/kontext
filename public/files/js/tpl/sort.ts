/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../types/views.d.ts" />

import {PageModel} from './document';
import * as popupBox from '../popupbox';
import * as $ from 'jquery';
import * as kwicAlignUtils from '../kwicAlignUtils';
import {SortStore, MultiLevelSortStore, SortFormProperties, fetchSortFormArgs, importMultiLevelArg} from '../stores/query/sort';
import {init as sortFormInit, SortFormViews} from 'views/query/sort';


class SortPage {

    private layoutModel:PageModel;

    private sortFormViews:SortFormViews;

    private sortStore:SortStore;

    private multiLevelSortStore:MultiLevelSortStore;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    /**
     *
     */
    init():void {
        this.layoutModel.init().then(
            () => {
                const concFormsArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
                const availAttrs = this.layoutModel.getConf<Array<{n:string; label:string}>>('AttrList');
                const fetchArgs = <T>(key:(item:AjaxResponse.SortFormArgs)=>T):Array<[string, T]>=>fetchSortFormArgs(concFormsArgs, key);
                const sortStoreProps:SortFormProperties = {
                    attrList: availAttrs,
                    sattr: fetchArgs<string>(item => item.sattr ? item.sattr : availAttrs[0].n),
                    sbward: fetchArgs<string>(item => item.sbward),
                    sicase: fetchArgs<string>(item => item.sicase),
                    skey: fetchArgs<string>(item => item.skey),
                    spos: fetchArgs<string>(item => item.spos),
                    sortlevel : fetchArgs<number>(item => item.sortlevel),
                    defaultFormAction : fetchSortFormArgs<string>(concFormsArgs, item => 'sortx'),
                    mlxattr : fetchArgs<Array<string>>(item => importMultiLevelArg<string>('mlxattr', item, (n)=>availAttrs[0].n)),
                    mlxicase : fetchArgs<Array<string>>(item => importMultiLevelArg<string>('mlxicase', item)),
                    mlxbward : fetchArgs<Array<string>>(item => importMultiLevelArg<string>('mlxbward', item)),
                    mlxctx : fetchArgs<Array<string>>(item => importMultiLevelArg<string>('mlxctx', item)),
                    mlxpos : fetchArgs<Array<number>>(item => importMultiLevelArg<number>('mlxpos', item)),
                };
                this.sortStore = new SortStore(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    sortStoreProps
                );
                this.multiLevelSortStore = new MultiLevelSortStore(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    sortStoreProps
                );
                this.sortFormViews = sortFormInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.exportMixins(),
                    this.layoutModel.layoutViews,
                    this.sortStore,
                    this.multiLevelSortStore
                );

                this.layoutModel.renderReactComponent(
                    this.sortFormViews.SortFormView,
                    window.document.getElementById('sort-form-mount'),
                    {
                        sortId: '__new__'
                    }
                );
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }

}


export function init(conf:Kontext.Conf):void {
    const layoutModel = new PageModel(conf);
    const pageModel = new SortPage(layoutModel);
    pageModel.init();
}