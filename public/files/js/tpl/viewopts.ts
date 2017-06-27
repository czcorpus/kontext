/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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
 * This module contains a page model form the 'viewopts' page
 */

/// <reference path="../types/common.d.ts" />
/// <reference path="../types/views.d.ts" />

import {PageModel} from './document';
import {init as corpnameLinkInit} from 'views/overview';
import {init as structsAttrsViewInit, StructsAndAttrsViews} from 'views/options/structsAttrs';


class ViewOptsPage {

    private changed:boolean = false;

    private layoutModel:PageModel;

    private mainForm:HTMLElement;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
        this.mainForm = window.document.getElementById('viewopts-form');
    }

    private blockUnsaved():void {
        this.mainForm.querySelector('input:not([type="hidden"]):not([type="submit"])').addEventListener('change', () => {
            this.changed = true;
        });

        window.addEventListener('beforeunload', (event:JQueryEventObject) => {
            if (this.changed) {
                return this.layoutModel.translate('global__there_are_unsaved_changes');
            }
            return undefined;
        });

        this.mainForm.querySelector('input[type="submit"]').addEventListener('click', () => {
            this.changed = false;
        });
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

    private initViewOptions():void {
        const viewOptionsViews = structsAttrsViewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.layoutModel.getStores().viewOptionsStore,
            this.layoutModel.getStores().mainMenuStore
        );

        this.layoutModel.renderReactComponent(
            viewOptionsViews.StructAttrsViewOptions,
            window.document.getElementById('view-options-mount'),
            {
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                isSubmitMode: true,
                stateArgs: this.layoutModel.getConcArgs().items()
            }
        );

        this.layoutModel.getStores().mainMenuStore.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS',
            (args:Kontext.GeneralProps) => {
                return this.layoutModel.getStores().viewOptionsStore.loadData();
            }
        );
    }

    init():void {
        this.layoutModel.init();
        this.blockUnsaved();
        this.initCorpnameLink();
        this.initViewOptions();
    }
}


export function init(conf:Kontext.Conf):void {
    let page = new ViewOptsPage(new PageModel(conf));
    page.init();
}
