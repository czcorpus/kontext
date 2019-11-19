/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

import {StatefulModel} from '..//base';
import * as Immutable from 'immutable';
import { Action, IFullActionControl } from 'kombo';


export class QueryContextModel extends StatefulModel {

    private formData:Immutable.Map<string, any>;

    constructor(dispatcher:IFullActionControl) {
        super(dispatcher);
        this.formData = Immutable.Map<string, any>({
            fc_lemword_window_type: 'both',
            fc_lemword_wsize: '1',
            fc_lemword: '',
            fc_lemword_type: 'all',
            fc_pos_window_type: 'left',
            fc_pos_wsize: '1',
            fc_pos: [],
            fc_pos_type: 'all'
        });

        this.dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'QUERY_INPUT_SELECT_CONTEXT_FORM_ITEM':
                    this.formData = this.formData.set(action.payload['name'], action.payload['value']);

                    this.emitChange();
                break;
            }
        });
    }

    exportForm():{[name:string]:any} {
        return this.formData.toJS();
    }

    getData():Immutable.Map<string, any> {
        return this.formData;
    }

}