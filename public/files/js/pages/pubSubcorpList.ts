/*
 * Copyright (c) 2018 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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
import { init as viewInit } from '../views/subcorp/listPublic';
import { PublicSubcorpListModel, DataItem } from '../models/subcorp/listPublic';
import { KontextPage } from '../app/main';


class PubSubcorpPage {

    private layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            const model = new PublicSubcorpListModel(
                this.layoutModel.dispatcher,
                this.layoutModel,
                this.layoutModel.getConf<Array<DataItem>>('Data'),
                this.layoutModel.getConf<number>('MinQuerySize'),
            );
            const views = viewInit(
                this.layoutModel.dispatcher,
                this.layoutModel.getComponentHelpers(),
                model
            )
            this.layoutModel.renderReactComponent(
                views.ListPublic,
                document.getElementById('published-subcorpora-mount')
            );
        });
    }
}


export function init(conf):void {
    new PubSubcorpPage(new KontextPage(conf)).init();
}