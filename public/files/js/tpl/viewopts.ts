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

/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../types/common.d.ts" />

import $ = require('jquery');
import {PageModel} from './document';


class ViewOptsPage {

    private changed:boolean = false;

    private layoutModel:PageModel;

    private mainForm:HTMLElement;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
        this.mainForm = window.document.getElementById('mainform');
    }

    private blockUnsaved():void {
        $(this.mainForm).find('input[type!="hidden"][type!="submit"]').on('change', () => {
            this.changed = true;
        });

        $(window).on('beforeunload', (event:JQueryEventObject) => {
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
        this.blockUnsaved();
    }
}


export function init(conf:Kontext.Conf):void {
    let page = new ViewOptsPage(new PageModel(conf));
    page.init();
}
