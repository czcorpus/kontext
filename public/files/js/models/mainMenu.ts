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

import {Kontext} from '../types/common';
import {StatefulModel} from './base';
import {PageModel} from '../app/main';
import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import { MultiDict } from '../util';
import { IActionDispatcher, Action, IFullActionControl } from 'kombo';
import { Observable, of as rxOf, forkJoin } from 'rxjs';
import { ObserveOnOperator } from 'rxjs/internal/operators/observeOn';



export interface DynamicSubmenuItem extends Kontext.SubmenuItem {
    boundAction:()=>void;
    indirect:boolean;
}

export interface StaticSubmenuItem extends Kontext.SubmenuItem {
    action:string;
    args:{[key:string]:any};
    keyCode:number;
    keyMod:string;
    currConc:boolean;
    indirect:boolean;
    openInBlank:boolean;
}

export interface InitialMenuItem {
    disabled:boolean;
    fallback_action:string;
    label:string;
    items:Array<Kontext.SubmenuItem>;
}

export type InitialMenuEntry = [string, InitialMenuItem];

export interface InitialMenuData {
    submenuItems:Array<InitialMenuEntry>;
}

/**
 * This defines a TS type guard for DynamicSubmenuItem
 */
export function isDynamicItem(item:Kontext.SubmenuItem): item is DynamicSubmenuItem {
    return (<DynamicSubmenuItem>item).boundAction !== undefined;
}

/**
 * This defines a TS type guard for StaticSubmenuItem
 */
export function isStaticItem(item:Kontext.SubmenuItem): item is StaticSubmenuItem {
    return (<StaticSubmenuItem>item).args !== undefined &&
                !item.hasOwnProperty('message');
}

export function isEventTriggeringItem(item:Kontext.SubmenuItem): item is Kontext.EventTriggeringSubmenuItem {
    return (<Kontext.EventTriggeringSubmenuItem>item).message !== undefined;
}

function importMenuData(data:InitialMenuData):Immutable.List<Kontext.MenuEntry> {
    return Immutable.List<InitialMenuEntry>(data.submenuItems).map<Kontext.MenuEntry>(v => {
        return [
            v[0],
            {
                label: v[1].label,
                disabled: v[1].disabled,
                fallbackAction: v[1].fallback_action,
                items: Immutable.List<Kontext.SubmenuItem>(v[1].items)
            }
        ];
    }).toList();
}


/**
 *
 */
class MenuShortcutMapper implements Kontext.IMainMenuShortcutMapper {

    private shortcuts:Immutable.List<Kontext.EventTriggeringSubmenuItem>;

    constructor(shortcuts:Immutable.List<Kontext.EventTriggeringSubmenuItem>) {
        this.shortcuts = shortcuts;
    }

    get(keyCode:number, keyMod:string):Kontext.EventTriggeringSubmenuItem {
        return this.shortcuts.find(x => {
            return x.keyCode === keyCode && x.keyMod === keyMod;
        });
    }

    register(keyCode:number, keyMod:string, message:string, args:Kontext.GeneralProps):void {
        this.shortcuts = this.shortcuts.push({
            ident: `${keyCode}_${keyMod}_${message}`,
            label: '',
            hint: null,
            message: message,
            args: args,
            keyCode: keyCode,
            keyMod: keyMod,
            indirect: false,
            disabled: false
        });
    }
}


export type PromisePrerequisite = (args:Kontext.GeneralProps)=>RSVP.Promise<any>;

export type ObservablePrerequisite = (args:Kontext.GeneralProps)=>Observable<any>;


/**
 *
 */
export class MainMenuModel extends StatefulModel implements Kontext.IMainMenuModel {

    private pageModel:PageModel;

    private activeItem:Kontext.MainMenuActiveItem;

    private visibleSubmenu:string;

    private selectionListeners:Immutable.Map<string, Immutable.List<ObservablePrerequisite>>;

    private data:Immutable.List<Kontext.MenuEntry>;

    private _isBusy:boolean;


    constructor(dispatcher:IFullActionControl, pageModel:PageModel, initialData:InitialMenuData) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.activeItem = null;
        this.visibleSubmenu = null;
        this.selectionListeners = Immutable.Map<string, Immutable.List<ObservablePrerequisite>>();
        this.data = importMenuData(initialData);
        this._isBusy = false;

        this.dispatcher.registerActionListener((action:Action) => {
            if (action.name === 'MAIN_MENU_SET_VISIBLE_SUBMENU') {
                this.visibleSubmenu = action.payload['value'];
                this.emitChange();

            } else if (action.name === 'MAIN_MENU_CLEAR_VISIBLE_SUBMENU') {
                this.visibleSubmenu = null;
                this.emitChange();

            } else if (action.name === 'MAIN_MENU_CLEAR_ACTIVE_ITEM') {
                this.activeItem = null;
                this.emitChange();

            } else if (action.name.indexOf('MAIN_MENU_') === 0) {
                const listeners = this.selectionListeners.get(action.name);
                if (listeners) {
                    this._isBusy = true;
                    forkJoin(...listeners.map(v => v(action.payload)).toArray()).subscribe(
                        (_) => {
                            this.activeItem = {
                                actionName: action.name,
                                actionArgs: action.payload
                            };
                            this._isBusy = false;
                            this.emitChange();
                        },
                        (err) => {
                            this._isBusy = false;
                            this.emitChange();
                            this.pageModel.showMessage('error', err);
                        }
                    );

                } else {
                    this.activeItem = {
                        actionName: action.name,
                        actionArgs: action.payload
                    };
                    this.emitChange();
                }
            }
        });
    }

    disableMenuItem(itemId:string, subItemId?:string):void {
        this.setMenuItemDisabledValue(itemId, subItemId, true);
        this.emitChange();
    }

    enableMenuItem(itemId:string, subItemId?:string):void {
        this.setMenuItemDisabledValue(itemId, subItemId, false);
        this.emitChange();
    }

    private setMenuItemDisabledValue(itemId:string, subItemId:string, v:boolean):void {
        const srchIdx = this.data.findIndex(item => item[0] === itemId);
        if (srchIdx) {
            const srch = this.data.get(srchIdx);
            if (subItemId === undefined) { // no submenu specified => we disable whole menu section
                const newItem:Kontext.MenuItem = {
                    disabled: v,
                    fallbackAction: srch[1].fallbackAction,
                    items: srch[1].items, // TODO - mutability
                    label: srch[1].label
                };
                const newEntry:Kontext.MenuEntry = [srch[0], newItem];
                this.data = this.data.set(srchIdx, newEntry);

            } else {
                const newEntry:Kontext.MenuEntry = [srch[0], srch[1]];
                newEntry[1].items = newEntry[1].items.map(item => {
                    if (isDynamicItem(item)) {
                        return {
                            ident: item.ident,
                            label: item.label,
                            hint: item.hint,
                            boundAction: item.boundAction,
                            disabled: item.ident === subItemId ? v : item.disabled
                        }

                    } else if (isStaticItem(item)) {
                        return {
                            ident: item.ident,
                            action: item.action,
                            hint: item.hint,
                            args: item.args,
                            keyCode: item.keyCode,
                            keyMod: item.keyMod,
                            currConc: item.currConc,
                            indirect: item.indirect,
                            label: item.label,
                            disabled: item.ident === subItemId ? v : item.disabled,
                            openInBlank: item.openInBlank
                        }

                    } else if (isEventTriggeringItem(item)) {
                        return {
                            ident: item.ident,
                            hint: item.hint,
                            args: item.args,
                            keyCode: item.keyCode,
                            keyMod: item.keyMod,
                            message: item.message,
                            indirect: item.indirect,
                            label: item.label,
                            disabled: item.ident === subItemId ? v : item.disabled
                        };

                    } else {
                        console.error('unknown menu item ', item);
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
        this.emitChange();
    }

    /**
     * @deprecated
     */
    addItemActionPrerequisitePromise(actionName:string, fn:PromisePrerequisite):ObservablePrerequisite {
        const fnWrap:ObservablePrerequisite = (args:Kontext.GeneralProps) => new Observable((observer) => {
            fn(args).then(
                (data) => {
                    observer.next(data);
                    observer.complete();
                }
            ).catch(
                (err) => {
                    observer.error(err);
                }
            );
        });
        this.addItemActionPrerequisite(actionName, fnWrap);
        return fnWrap;
    }

    /**
     * Typically, it is expected that UI components reacting to main menu changes
     * will listen to MainMenuModel updates and update themselves accordingly.
     * But sometimes it is necessary to perform an action before the actual change
     * is "published" (e.g. load fresh data from server) which is why it is possible
     * to register a custom function to a specific menu action.
     *
     * @param actionName
     * @param fn
     */
    addItemActionPrerequisite(actionName:string, fn:ObservablePrerequisite) {
        const fnList = this.selectionListeners.has(actionName) ?
                this.selectionListeners.get(actionName)
                : Immutable.List<ObservablePrerequisite>();
        this.selectionListeners = this.selectionListeners.set(actionName, fnList.push(fn));
    }

    removeItemActionPrerequisite(actionName:string, fn:ObservablePrerequisite) {
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

    // TODO currently unused - remove if not needed
    bindDynamicItem(ident:string, label:string, hint:string, indirect:boolean, handler:()=>void) {
        this.data.forEach((item, i) => {
            item[1].items.forEach((subitem, j) => {
                if (subitem.ident === ident && isDynamicItem(subitem)) {
                    const newSubitem:DynamicSubmenuItem = {
                        ident: ident,
                        label: label,
                        hint: hint,
                        disabled: false,
                        indirect: indirect,
                        boundAction: handler
                    };
                    const newItem:Kontext.MenuItem = {
                        disabled: item[1].disabled,
                        fallbackAction: item[1].fallbackAction,
                        label: item[1].label,
                        items: item[1].items.set(j, newSubitem)
                    };
                    this.data = this.data.set(i, [item[0], newItem]);
                    this.emitChange();
                    return;
                }
            });
        });
    }

    getData():Immutable.List<Kontext.MenuEntry> {
        return this.data;
    }

    exportKeyShortcutActions():Kontext.IMainMenuShortcutMapper {
        return new MenuShortcutMapper(
                    this.data
                        .flatMap(v => Immutable.List<Kontext.SubmenuItem>(v[1].items))
                        .filter(v => isEventTriggeringItem(v) && !!v.keyCode)
                        .map<Kontext.EventTriggeringSubmenuItem>(v => v as Kontext.EventTriggeringSubmenuItem)
                        .toList());

    }

    getConcArgs():MultiDict {
        return this.pageModel.getConcArgs();
    }

    getVisibleSubmenu():string {
        return this.visibleSubmenu;
    }

    isBusy():boolean {
        return this._isBusy;
    }

}