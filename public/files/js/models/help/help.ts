/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

import { HTTP } from 'cnc-tskit';
import { IFullActionControl, StatefulModel } from 'kombo';

import { PageModel } from '../../app/page';
import { Actions, ActionName } from './actions';



export interface HtmlHelpModelState {
    isBusy:boolean;
    rawHtml:string;
}

export class HtmlHelpModel<T extends HtmlHelpModelState=HtmlHelpModelState> extends StatefulModel<T> {

    protected readonly layoutModel:PageModel;

    constructor(layoutModel:PageModel, dispatcher:IFullActionControl, initialState:T) {
        super(
            dispatcher,
            initialState
        );
        this.layoutModel = layoutModel;

        this.addActionHandler<Actions.HelpRequested>(
            ActionName.HelpRequested,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    state.rawHtml = null;
                });
                this.loadHelp(action.payload.section);
            }
        );
    }

    loadHelp(section:string):void {
        const lang = this.layoutModel.getConf<string>('uiLang').split('-')[0]
        this.layoutModel.ajax$<string>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl(`files/html/help/${section}/index.${lang}.html`),
            {},
            {responseType: 'text'}

        ).subscribe(
            data => {
                this.changeState(state => {
                    state.isBusy = false;
                    state.rawHtml = data;
                });
            },
            (err) => {
                this.changeState(state => {
                    state.isBusy = false;
                });
                this.layoutModel.showMessage('error', err);
            }
        );
    }
}