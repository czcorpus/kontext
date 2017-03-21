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

import {SimplePageStore} from './base';
import {PageModel} from '../tpl/document';
import * as Immutable from 'vendor/immutable';
import * as RSVP from 'vendor/rsvp';


export interface SubmenuItem {
    ident:string;
    action:string;
    args:{[key:string]:any};
    currConc:boolean;
    message:string; // a dispatcher action type
    indirect:boolean;
    label:string;
    disabled:boolean;
}

export interface MenuItem {
    disabled:boolean;
    fallback_action:string;
    label:string;
    items:Array<SubmenuItem>;
}

export type MenuEntry = [string, MenuItem];

export interface InitialMenuData {
    submenuItems:Array<MenuEntry>;
}


/**
 *
 */
export class MainMenuStore extends SimplePageStore implements Kontext.IMainMenuStore {

    private pageModel:PageModel;

    private activeItem:Kontext.MainMenuActiveItem;

    private selectionListeners:Immutable.Map<string, Immutable.List<(args:Kontext.GeneralProps)=>RSVP.Promise<any>>>;

    private data:Immutable.List<MenuEntry>;


    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, initialData:InitialMenuData) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.activeItem = null;
        this.selectionListeners = Immutable.Map<string, Immutable.List<(args:Kontext.GeneralProps)=>RSVP.Promise<any>>>();
        this.data = Immutable.List<MenuEntry>(initialData.submenuItems);

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

    disableMenuItem(itemId:string, subItemId?:string):void {
        this.setMenuItemDisabledValue(itemId, subItemId, true);
        this.notifyChangeListeners();
    }

    enableMenuItem(itemId:string, subItemId?:string):void {
        this.setMenuItemDisabledValue(itemId, subItemId, false);
        this.notifyChangeListeners();
    }

    private setMenuItemDisabledValue(itemId:string, subItemId:string, v:boolean):void {
        const srchIdx = this.data.findIndex(item => item[0] === itemId);
        if (srchIdx) {
            const srch = this.data.get(srchIdx);
            if (subItemId === undefined) {
                const newItem:MenuItem = {
                    disabled: v,
                    fallback_action: srch[1].fallback_action,
                    items: srch[1].items, // TODO - mutability
                    label: srch[1].label
                };
                const newEntry:MenuEntry = [srch[0], newItem];
                this.data = this.data.set(srchIdx, newEntry);

            } else {
                const newEntry:MenuEntry = [srch[0], srch[1]];
                newEntry[1].items = newEntry[1].items.map(item => {
                    return {
                        ident: item.ident,
                        action: item.action,
                        args: item.args,
                        message: item.message,
                        currConc: item.currConc,
                        indirect: item.indirect,
                        label: item.label,
                        disabled: item.ident === subItemId ? v : item.disabled
                    }
                });
            }
        }
    }

    getActiveItem():Kontext.MainMenuActiveItem {
        return this.activeItem;
    }

    /**
     * Typically, it is expected that UI components reacting to main menu changes
     * will listen to MainMenuStore updates and update themselves accordingly.
     * But sometimes it is necessary to perform an action before the actual change
     * is "published" (e.g. load fresh data from server) which is why it is possible
     * to register a custom function to a specific menu action.
     *
     * @param actionName
     * @param fn
     */
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

    getData():Immutable.List<MenuEntry> {
        return this.data;
    }

}