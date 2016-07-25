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

/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../types/common.d.ts" />
/// <reference path="../types/views.d.ts" />

import $ = require('jquery');
import {PageModel} from './document';
import {init as structsAttrsViewInit} from 'views/options/structsAttrs';



class ViewAttrsPage {

    private layoutModel:PageModel;

    private changed:boolean = false;

    private mainForm:HTMLElement;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
        this.mainForm = window.document.getElementById('mainform');
    }

    private blockUnsaved():void {
        $(this.mainForm).find('input[type!="hidden"][type!="submit"]').on('change', () => {
            this.changed = true;
        });

        $(window).on('beforeunload', (event) => {
            if (this.changed) {
                return this.layoutModel.translate('global__there_are_unsaved_changes');
            }
            return undefined;
        });

        $(this.mainForm).find('input[type="submit"]').on('click', () => {
            this.changed = false;
        });
    }

    init():void {
        this.layoutModel.init();

        let storeData:ViewOptions.PageData = {
            AttrList: this.layoutModel.getConf<Array<ViewOptions.AttrDesc>>('AttrList'),
            FixedAttr: this.layoutModel.getConf<string>('FixedAttr'),
            CurrentAttrs: this.layoutModel.getConf<Array<string>>('CurrentAttrs'),
            AvailStructs: this.layoutModel.getConf<Array<{sel:string; label:string; n:string}>>('Availstructs'),
            StructAttrs: this.layoutModel.getConf<{[attr:string]:Array<string>}>('StructAttrs'),
            CurrStructAttrs: this.layoutModel.getConf<Array<string>>('CurrStructAttrs')
        };
        this.layoutModel.getStores().viewOptionsStore.initFromPageData(storeData);

        let views = structsAttrsViewInit(this.layoutModel.dispatcher, this.layoutModel.exportMixins(),
                this.layoutModel.getStores().viewOptionsStore);

        this.layoutModel.renderReactComponent(
            views.StructsAndAttrsForm,
            window.document.getElementById('viewattrs-mount'),
            {}
        );
        this.blockUnsaved();
    }
}


export function init(conf:Kontext.Conf):void {
    let pageModel = new ViewAttrsPage(new PageModel(conf));
    pageModel.init();
}