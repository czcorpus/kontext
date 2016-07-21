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

/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../types/common.d.ts" />

import $ = require('jquery');
import {PageModel} from './document';
import {bind as bindPopupBox} from '../popupbox';
import kwicAlignUtils = require('../kwicAlignUtils');
import {init as initFormViews} from 'views/wordlist/forms';


class SaveWordlistForm {

    private layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }


    updateExportTypeSwitch(jqForm, currentElement) {
        var jqHeadingInput = $(jqForm).find('input[name="colheaders"]'),
            jqHeadingRow = jqHeadingInput.closest('tr'),
            jqHeadingInput2 = $(jqForm).find('input[name="heading"]'),
            jqHeadingRow2 = jqHeadingInput2.closest('tr');

        if ($(currentElement).val() === 'csv' || $(currentElement).val() === 'xlsx') {
            jqHeadingInput.prop('disabled', false);
            jqHeadingRow.show();
            jqHeadingInput2.prop('disabled', true);
            jqHeadingRow2.hide();

        } else {
            jqHeadingInput.prop('disabled', true);
            jqHeadingRow.hide();
            jqHeadingInput2.prop('disabled', false);
            jqHeadingRow2.show();
        }
    };

    /**
     *
     */
    bindStaticElements() {
        var jqForm = $('form[action="savewl"]');

        jqForm.find('input[name="saveformat"]').on('click', (event) => {
            this.updateExportTypeSwitch(jqForm, event.target);
        });
    };

    /**
     */
    init():void {
        this.layoutModel.init();
        let uiComponents = initFormViews(this.layoutModel.dispatcher,
                this.layoutModel.exportMixins());

        this.layoutModel.renderReactComponent(
            uiComponents.SaveWlForm,
            window.document.getElementById('savewl-form-mount'),
            {
                hiddenInputValues: this.layoutModel.getConf<Array<Array<any>>>('WlStateForm')
            }
        );

        /*
        this.bindStaticElements();

        // obtain current state of the form and update
        var jqForm = $('form[action="savewl"]'),
            checkedRadio = jqForm.find('input[name="saveformat"]:checked').get(0);

        if (checkedRadio) {
            this.updateExportTypeSwitch(jqForm, checkedRadio);
        }
        */
    }
}


export function init(conf:Kontext.Conf):void {
    let page = new SaveWordlistForm(new PageModel(conf));
    page.init();
}