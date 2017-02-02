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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />

import {SimplePageStore} from '../../util';
import * as Immutable from 'vendor/immutable';


export class QueryContextStore extends SimplePageStore {

    private formData:Immutable.Map<string, any>;

    constructor(dispatcher:Kontext.FluxDispatcher) {
        super(dispatcher);
        this.formData = Immutable.Map<string, any>({
            'fc_lemword_window_type': '',
            'fc_lemword_wsize': '1',
            'fc_lemword': '',
            'fc_lemword_type': 'all',
            'fc_pos_window_type': 'left',
            'fc_pos_wsize': '1',
            'fc_pos': [],
            'fc_pos_type': 'all'
        });

        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'QUERY_INPUT_SELECT_CONTEXT_FORM_ITEM':
                    this.formData = this.formData.set(payload.props['name'], payload.props['value']);
                    this.notifyChangeListeners();
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