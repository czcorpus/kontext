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

import $ = require('jquery');
import {PageModel} from './document';


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

    private uncheckChecked(parentElm):void {
        $(parentElm).find('input[type="checkbox"]:checked').each(function () {
            $(this).prop('checked', false);
        });
    }

    private setupStructattrCheckboxes() {
        $(this.mainForm).find('.structattr-checkbox').on('click', (event) => {
            let triggerElm = $(event.target);
            let structId = triggerElm.attr('data-struct-id');
            let parentCheckbox = triggerElm.closest('fieldset').find('input[name="setstructs"][value="' + structId + '"]');

            if (triggerElm.is(':checked') && !parentCheckbox.is(':checked')) {
                parentCheckbox.prop('checked', true);
            }
        });

        $(this.mainForm).find('input[type="checkbox"][name="setstructs"]').on('click', (event) => {
            this.uncheckChecked($(event.target).closest('fieldset').find('ul[data-struct-id="' + $(event.target).val() + '"]'));
        });
    }

    init():void {
        this.layoutModel.init();
        $(this.mainForm).find('input.select-all').each((_, elm:HTMLElement) => {
            this.layoutModel.applySelectAll(elm, $(elm).closest('fieldset'));
        });
        this.setupStructattrCheckboxes();
        this.blockUnsaved();
    }
}


export function init(conf:Kontext.Conf):void {
    let pageModel = new ViewAttrsPage(new PageModel(conf));
    pageModel.init();
}