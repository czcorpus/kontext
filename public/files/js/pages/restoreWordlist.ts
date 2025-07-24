/*
 * Copyright (c) 2022 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import { KontextPage } from '../app/main.js';
import { PageModel } from '../app/page.js';
import * as Kontext from '../types/kontext.js';
import { Actions } from '../models/asyncTask/actions.js';
import { List } from 'cnc-tskit';
import { init as viewInit } from '../views/wordlist/restore/index.js';

class WordlistRestorePage {

    private readonly layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    init():void {
        this.layoutModel.init(true, [], () => {

            const task = this.layoutModel.getConf<Kontext.AsyncTaskInfo>('Task');

            this.layoutModel.dispatcher.registerActionListener(
                (action, dispatch) => {
                    if (Actions.isAsyncTasksChecked(action)) {
                        const srch = List.find(x => task.ident === x.ident, action.payload.tasks);
                        if (srch && srch.status === 'SUCCESS') {
                            window.location.href = srch.url;
                        }
                    }
                }
            );

            const View = viewInit(this.layoutModel.getComponentHelpers());
            this.layoutModel.renderReactComponent(View, document.getElementById('view-mount'));
        });
    }
}


export function init(conf:Kontext.Conf):void {
    const layout = new KontextPage(conf);
    new WordlistRestorePage(layout).init();
}
