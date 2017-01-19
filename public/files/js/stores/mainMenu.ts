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

/// <reference path="../types/common.d.ts" />
/// <reference path="../../ts/declarations/immutable.d.ts" />

import {SimplePageStore} from '../util';
import {PageModel} from '../tpl/document';
import * as Immutable from 'vendor/immutable';
import * as RSVP from 'vendor/rsvp';

/**
 *
 */
export class MainMenuStore extends SimplePageStore implements Kontext.IMainMenuStore {

    private pageModel:PageModel;

    private activeItem:Kontext.MainMenuActiveItem;

    private selectionListeners:Immutable.Map<string, Immutable.List<(args:Kontext.GeneralProps)=>RSVP.Promise<any>>>;


    constructor(dispatcher:Dispatcher.Dispatcher<any>, pageModel:PageModel) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.activeItem = null;
        this.selectionListeners = Immutable.Map<string, Immutable.List<(args:Kontext.GeneralProps)=>RSVP.Promise<any>>>();

        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            if (payload.actionType === 'MAIN_MENU_CLEAR_ACTIVE_ITEM') {
                this.activeItem = null;
                this.notifyChangeListeners();

            } else if (payload.actionType.indexOf('MAIN_MENU_') === 0) {
                this.activeItem = {
                    actionName: payload.actionType,
                    actionArgs: payload.props
                }
                if (this.selectionListeners.has(payload.actionType)) {
                    this.selectionListeners.get(payload.actionType).reduce<RSVP.Promise<any>>(
                        (red, curr) => {
                            return red.then(
                                () => {
                                    return curr(payload.props);
                                }
                            );
                        },
                        new RSVP.Promise((resolve:(v)=>void, reject:(err)=>void) => { resolve(null); })

                    ).then(
                        () => {
                            this.notifyChangeListeners();
                        }
                    );

                } else {
                    this.notifyChangeListeners();
                }

            }
        });
    }

    getActiveItem():Kontext.MainMenuActiveItem {
        return this.activeItem;
    }

    addItemActionPrerequisite(actionName:string, fn:(args:Kontext.GeneralProps)=>RSVP.Promise<any>) {
        const fnList = this.selectionListeners.has(actionName) ?
                this.selectionListeners.get(actionName)
                : Immutable.List<(args:Kontext.GeneralProps)=>RSVP.Promise<any>>();
        this.selectionListeners = this.selectionListeners.set(actionName,
                fnList.push(fn));
    }

    removeItemActionPrerequisite(actionName:string, fn:(args:Kontext.GeneralProps)=>RSVP.Promise<any>) {
        if (!this.selectionListeners.has(actionName)) {
            throw new Error('No listeners for action ' + actionName);
        }
        const fnList = this.selectionListeners.get(actionName);
        const srch = fnList.indexOf(fn);
        if (srch > -1) {
            this.selectionListeners = this.selectionListeners.set(actionName,
                    fnList.remove(srch));

        } else {
            throw new Error('Function not registered as a listener');
        }
    }

}