/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../../vendor.d.ts/rsvp.d.ts" />

import * as Immutable from 'immutable';
import {SimplePageStore} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {MultiDict} from '../../util';


export class QuerySaveAsFormStore extends SimplePageStore {

    private layoutModel:PageModel;

    private queryId:string;

    private name:string;

    private isBusy:boolean;

    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel, queryId:string) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.name = '';
        this.queryId = queryId;
        this.isBusy = false;

        dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'QUERY_SAVE_AS_FORM_SET_NAME':
                    this.name = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'QUERY_SAVE_AS_FORM_SUBMIT':
                    if (this.name) {
                        this.isBusy = true;
                        this.notifyChangeListeners();
                        this.submit().then(
                            () => {
                                this.isBusy = false;
                                this.notifyChangeListeners();
                                this.layoutModel.resetMenuActiveItemAndNotify();
                                this.layoutModel.showMessage('info',
                                        this.layoutModel.translate('query__save_as_item_saved'));
                            },
                            (err) => {
                                this.isBusy = false;
                                this.notifyChangeListeners();
                                this.layoutModel.showMessage('error', err);
                            }
                        );

                    } else {
                        this.layoutModel.showMessage('error',
                                this.layoutModel.translate('query__save_as_cannot_have_empty_name'));
                    }
                break;
            }
        });
    }

    private submit():RSVP.Promise<boolean> {
        const args = new MultiDict();
        args.set('query_id', this.queryId);
        args.set('name', this.name);
        return this.layoutModel.ajax<any>(
            'POST',
            this.layoutModel.createActionUrl('save_query'),
            args
        );
    }

    getName():string {
        return this.name;
    }

    getIsBusy():boolean {
        return this.isBusy;
    }

}