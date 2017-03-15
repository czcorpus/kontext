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

import {PageModel} from './document';
import {init as initSaveForms} from 'views/wordlist/save';


class SaveWordlistForm {

    private layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    init():void {
        this.layoutModel.init();
        const uiComponents = initSaveForms(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins()
        );

        this.layoutModel.renderReactComponent(
            uiComponents.SaveWlForm,
            window.document.getElementById('savewl-form-mount'),
            {
                hiddenInputValues: this.layoutModel.getConf<Array<Array<any>>>('WlStateForm')
            }
        );
    }
}


export function init(conf:Kontext.Conf):void {
    const page = new SaveWordlistForm(new PageModel(conf));
    page.init();
}