/*
 * Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
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

/**
 * This module contains a page model for the 'viewattrs' page
 */

/// <reference path="../types/common.d.ts" />
/// <reference path="../types/views.d.ts" />

import {PageModel} from './document';
import {init as structsAttrsViewInit} from 'views/options/structsAttrs';
import {init as corpnameLinkInit} from 'views/overview';



class ViewAttrsPage {

    private layoutModel:PageModel;

    private changed:boolean = false;

    private mainForm:HTMLElement;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
        this.mainForm = window.document.getElementById('viewopts-form');
    }

    private initCorpnameLink():void {
        const corpInfoViews = corpnameLinkInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.getStores().corpusInfoStore,
            this.layoutModel.layoutViews.PopupBox
        );
        this.layoutModel.renderReactComponent(
            this.layoutModel.layoutViews.EmptyQueryOverviewBar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getConf<string>('corpname'),
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                usesubcorp: this.layoutModel.getConf<string>('usesubcorp')
            }
        );
    }

    init():void {
        this.layoutModel.init();

        let storeData:ViewOptions.PageData = {
            AttrList: this.layoutModel.getConf<Array<ViewOptions.AttrDesc>>('AttrList'),
            FixedAttr: this.layoutModel.getConf<string>('FixedAttr'),
            AttrAllpos: this.layoutModel.getConf<string>('AttrAllpos'),
            AttrVmode: this.layoutModel.getConf<string>('AttrVmode'),
            CurrentAttrs: this.layoutModel.getConf<Array<string>>('CurrentAttrs'),
            AvailStructs: this.layoutModel.getConf<Array<{sel:string; label:string; n:string}>>('Availstructs'),
            StructAttrs: this.layoutModel.getConf<{[attr:string]:Array<string>}>('StructAttrs'),
            CurrStructAttrs: this.layoutModel.getConf<Array<string>>('CurrStructAttrs'),
            AvailRefs: this.layoutModel.getConf<Array<{n:string; label:string; sel:string}>>('AvailRefs'),
            ShowConcToolbar: this.layoutModel.getConf<boolean>('ShowConcToolbar')
        };
        this.layoutModel.getStores().viewOptionsStore.initFromPageData(storeData);

        let views = structsAttrsViewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.layoutModel.getStores().viewOptionsStore,
            this.layoutModel.getStores().mainMenuStore
        );

        this.layoutModel.renderReactComponent(
            views.StructAttrsViewOptions,
            window.document.getElementById('viewattrs-mount'),
            {
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                isSubmitMode: true,
                stateArgs: this.layoutModel.getConcArgs().items()
            }
        );
        this.initCorpnameLink();
    }
}


export function init(conf:Kontext.Conf):void {
    let pageModel = new ViewAttrsPage(new PageModel(conf));
    pageModel.init();
}