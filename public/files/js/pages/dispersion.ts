/*
 * Copyright (c) 2022 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
 * Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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

import { KontextPage } from '../app/main';
import { DispersionResultModel } from '../models/dispersion/result';
import { Conf } from '../types/kontext';
import { init as viewInit } from '../views/dispersion/result';


export class DispersionPage {

    private readonly layoutModel:KontextPage;

    constructor(layoutModel:KontextPage) {
        this.layoutModel = layoutModel;
    }

    init() {
        this.layoutModel.init(true, [], () => {

            const model = new DispersionResultModel(
                this.layoutModel.dispatcher,
                this.layoutModel,
                {
                    isBusy: false
                }
            );

            const resultView = viewInit(
                this.layoutModel.dispatcher,
                this.layoutModel.getComponentHelpers(),
                model
            );

            this.layoutModel.renderReactComponent(
                resultView,
                window.document.getElementById('result-mount'),
                {
                }
            );

            console.log('Dispersion page init OK, model is: ', model);

        });
    }
}



export function init(conf:Conf):void {
    const page = new DispersionPage(new KontextPage(conf));
    page.init();
}