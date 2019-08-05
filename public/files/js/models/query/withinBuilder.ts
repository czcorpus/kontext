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

import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import {StatefulModel} from '../base';
import {AjaxResponse} from '../../types/ajaxResponses';
import {PageModel} from '../../app/main';
import { IActionDispatcher, Action } from 'kombo';

/**
 *
 */
export class WithinBuilderModel extends StatefulModel {

    private pageModel:PageModel;

    private data:Immutable.List<[string, string]>;

    private query:string;

    private currAttrIdx:number;

    constructor(dispatcher:IActionDispatcher, pageModel:PageModel) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.data = Immutable.List<[string, string]>();
        this.query = '';
        this.currAttrIdx = 0;
        const self = this;

        this.dispatcher.registerActionListener(function (action:Action) {
            switch (action.name) {
                case 'QUERY_INPUT_LOAD_WITHIN_BUILDER_DATA':
                    self.loadAttrs().then(
                        () => {
                            self.emitChange();
                        },
                        (err) => {
                            console.error(err);
                            self.pageModel.showMessage('error', err);
                        }
                    );
                break;
                case 'QUERY_INPUT_SET_WITHIN_VALUE':
                    self.query = action.payload['value'];
                    self.emitChange();
                break;
                case 'QUERY_INPUT_SET_WITHIN_ATTR':
                    self.currAttrIdx = action.payload['idx'];
                    self.emitChange();
                break;
            }
        });
    }

    private loadAttrs():RSVP.Promise<any> {
        return this.pageModel.ajax<AjaxResponse.WithinBuilderData>(
            'GET',
            this.pageModel.createActionUrl('corpora/ajax_get_structattrs_details'),
            {
                corpname: this.pageModel.getCorpusIdent().id
            },
            {contentType : 'application/x-www-form-urlencoded'}

        ).then(
            (data) => {
                this.data = this.data.clear();
                for (let attr in data.structattrs) {
                    if (data.structattrs.hasOwnProperty(attr)) {
                        data.structattrs[attr].forEach(item => {
                            this.data = this.data.push([attr, item]);
                        });
                    }
                }
                this.currAttrIdx = 0;
            }
        );
    }

    getData():Immutable.List<[string, string]> {
        return this.data;
    }

    getQuery():string {
        return this.query;
    }

    getCurrAttrIdx():number {
        return this.currAttrIdx;
    }

    exportQuery():string {
        return this.data.size > 0 ?
            `within <${this.data.get(this.currAttrIdx).join(' ')}="${this.query}" />`
            : '';
    }
}
