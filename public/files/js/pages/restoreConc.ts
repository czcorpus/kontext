/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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
import { PageModel } from '../app/page';
import { HitReloader } from '../models/concordance/concStatus';
import { ConcRestoreModel } from '../models/concRestore';
import { ActionName, Actions } from '../models/concRestore/actions';
import { Kontext } from '../types/common';
import { init as viewInit } from '../views/restoreConc';


class ConcRestorePage {

    private readonly layoutModel:PageModel;

    private readonly hitReloader:HitReloader;

    constructor(layoutModel:PageModel, hitReloader:HitReloader) {
        this.layoutModel = layoutModel;
        this.hitReloader = hitReloader;
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            const model = new ConcRestoreModel(
                this.layoutModel.dispatcher,
                {
                    isBusy: true,
                    concPersistenceId: this.layoutModel.getConf<string>('concPersistenceOpId'),
                    nextAction: this.layoutModel.getConf<string>('NextAction'),
                    nextActionArgs: this.layoutModel.getConf<{[k:string]:string|number}>('NextActionArgs'),
                    nextActionLink: undefined
                },
                this.layoutModel
            );
            const view = viewInit(
                this.layoutModel.dispatcher,
                this.layoutModel.getComponentHelpers(),
                model
            );

            this.layoutModel.renderReactComponent(view, document.getElementById('view-mount'));
            if (!this.layoutModel.getConf<boolean>('ConcFinished')) {
                this.hitReloader.init();

            } else {
                window.setTimeout(() => {
                    this.layoutModel.dispatcher.dispatch<Actions.ConcRestored>({
                        name: ActionName.ConcRestored
                    });
                });
            }
        });
    }
}


export function init(conf:Kontext.Conf):void {
    const layout = new KontextPage(conf);
    new ConcRestorePage(layout, new HitReloader(layout)).init();
}
