/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import { PageModel } from '../app/page';
import { KontextPage } from '../app/main';
import { Kontext } from '../types/common';
import { init as formViewInit } from '../views/pquery/form';
import { PqueryFormModel } from '../models/pquery/form';


class ParadigmaticQueryFormPage {

    private readonly layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    init():void {
        this.layoutModel.init(true, [], () => {


            const model = new PqueryFormModel(
                this.layoutModel.dispatcher,
                {
                    isBusy: false,
                    corpname: this.layoutModel.getCorpusIdent().id
                },
                this.layoutModel
            );

            const formView = formViewInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                model
            })
            this.layoutModel.renderReactComponent(
                formView,
                window.document.getElementById('pquery-form-mount'),
                {
                }
            );

            console.log('init query page done'); // TODO
        });
    }
}


class ParadigmaticQueryResultPage {

    private readonly layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            console.log('init result page done'); // TODO
        });
    }
}


export function init(conf:Kontext.Conf):void {
    const layout = new KontextPage(conf);
    const view = layout.getConf<string>('View');
    switch (view) {
        case 'form':
            new ParadigmaticQueryFormPage(layout).init();
            break;
        case 'result':
            new ParadigmaticQueryResultPage(layout).init();
            break;
        default:
            layout.showMessage('error', `Invalid view specified: ${view}`);
    }
}