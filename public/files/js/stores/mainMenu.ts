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
/// <reference path="../vendor.d.ts/immutable.d.ts" />

import {SimplePageStore} from './base';
import {PageModel} from '../pages/document';
import * as Immutable from 'vendor/immutable';
import * as RSVP from 'vendor/rsvp';

export interface SubmenuItem {
    ident:string;
    label:string;
    disabled:boolean;
}

export interface DynamicSubmenuItem extends SubmenuItem {
    boundAction:()=>void;
}

export interface StaticSubmenuItem extends SubmenuItem {
    action:string;
    args:{[key:string]:any};
    keyCode:number;
    currConc:boolean;
    message:string; // a dispatcher action type
    indirect:boolean;
}

export interface MenuItem {
    disabled:boolean;
    fallbackAction:string;
    label:string;
    items:Immutable.List<SubmenuItem>;
}

export type MenuEntry = [string, MenuItem];

export interface InitialMenuItem {
    disabled:boolean;
    fallback_action:string;
    label:string;
    items:Array<SubmenuItem>;
}

export type InitialMenuEntry = [string, InitialMenuItem];

export interface InitialMenuData {
    submenuItems:Array<InitialMenuEntry>;
}

/**
 * This defines a TS type guard for DynamicSubmenuItem
 */
function isDynamicItem(item:SubmenuItem): item is DynamicSubmenuItem {
    return (<DynamicSubmenuItem>item).boundAction !== undefined;
}

/**
 * This defines a TS type guard for StaticSubmenuItem
 */
function isStaticItem(item:SubmenuItem): item is StaticSubmenuItem {
    return (<StaticSubmenuItem>item).action !== undefined;
}

function importMenuData(data:InitialMenuData):Immutable.List<MenuEntry> {
    return Immutable.List<InitialMenuEntry>(data.submenuItems).map<MenuEntry>(v => {
        return [
            v[0],
            {
                label: v[1].label,
                disabled: v[1].disabled,
                fallbackAction: v[1].fallback_action,
                items: Immutable.List<SubmenuItem>(v[1].items)
            }
        ];
    }).toList();
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
        this.data = importMenuData(initialData);

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
                    fallbackAction: srch[1].fallbackAction,
                    items: srch[1].items, // TODO - mutability
                    label: srch[1].label
                };
                const newEntry:MenuEntry = [srch[0], newItem];
                this.data = this.data.set(srchIdx, newEntry);

            } else {
                const newEntry:MenuEntry = [srch[0], srch[1]];
                newEntry[1].items = newEntry[1].items.map(item => {
                    if (isDynamicItem(item)) {
                        return {
                            ident: item.ident,
                            label: item.label,
                            boundAction: item.boundAction,
                            disabled: item.ident === subItemId ? v : item.disabled
                        }

                    } else if (isStaticItem(item)) {
                        return {
                            ident: item.ident,
                            action: item.action,
                            args: item.args,
                            keyCode: item.keyCode,
                            message: item.message,
                            currConc: item.currConc,
                            indirect: item.indirect,
                            label: item.label,
                            disabled: item.ident === subItemId ? v : item.disabled
                        }
                    }
                }).toList();
            }
        }
    }

    getActiveItem():Kontext.MainMenuActiveItem {
        return this.activeItem;
    }

    resetActiveItemAndNotify():void {
        this.activeItem = null;
        this.notifyChangeListeners();
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

    bindDynamicItem(ident:string, label:string, handler:()=>void) {
        this.data.forEach((item, i) => {
            item[1].items.forEach((subitem, j) => {
                if (subitem.ident === ident && isDynamicItem(subitem)) {
                    const newSubitem:DynamicSubmenuItem = {
                        ident: ident,
                        label: label,
                        disabled: false,
                        boundAction: handler
                    };
                    const newItem:MenuItem = {
                        disabled: item[1].disabled,
                        fallbackAction: item[1].fallbackAction,
                        label: item[1].label,
                        items: item[1].items.set(j, newSubitem)
                    };
                    this.data = this.data.set(i, [item[0], newItem]);
                    this.notifyChangeListeners();
                    return;
                }
            });
        });
    }

    getData():Immutable.List<MenuEntry> {
        return this.data;
    }

    exportKeyShortcutActions():Immutable.Map<number, Kontext.MainMenuAtom> {
        return Immutable.Map<number, Kontext.MainMenuAtom>(this.data
            .flatMap(v => Immutable.List<SubmenuItem>(v[1].items))
            .filter(v => isStaticItem(v) && !!v.keyCode && !!v.message)
            .map((v:StaticSubmenuItem) => {
                return [v.keyCode, {
                    actionName: v.message,
                    actionArgs: v.args,
                    keyCode: v.keyCode
                }];
            }));
    }

}