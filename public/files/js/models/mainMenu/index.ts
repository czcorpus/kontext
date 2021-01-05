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

 import { IActionDispatcher, StatelessModel } from 'kombo';
import { List, tuple, pipe } from 'cnc-tskit';

import { Kontext } from '../../types/common';
import { PageModel } from '../../app/page';
import { Actions, ActionName } from './actions';
import { ActionName as ConcActionName } from '../concordance/actions';
import { Actions as GeneralOptsActions,
    ActionName as GeneralOptsActionName } from '../options/actions';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';
import { ConcServerArgs } from '../concordance/common';



export interface DynamicSubmenuItem extends Kontext.SubmenuItem {
    boundAction:()=>void;
    indirect:boolean;
}

export interface StaticSubmenuItem extends Kontext.SubmenuItem {
    action:string;
    args:Array<[string, string]>;
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

export function isEventTriggeringItem(item:Kontext.SubmenuItem):
        item is Kontext.EventTriggeringSubmenuItem {
    return (<Kontext.EventTriggeringSubmenuItem>item).message !== undefined;
}

function importMenuData(data:Array<InitialMenuEntry>):Array<Kontext.MenuEntry> {
    return List.map(
        ([ident, item]) => tuple(
            ident,
            {
                label: item.label,
                disabled: item.disabled,
                fallbackAction: item.fallback_action,
                items: item.items
            }
        ),
        data
    );
}

/**
 * Note - the function mutates data
 */
export function disableMenuItems(data:InitialMenuData, ...disabled:Array<[string, string|null]>
        ):InitialMenuData {
    List.forEach(
        ([itemId, subItemId]) => {
            const submenuEntry = List.find(([ident,]) => ident === itemId, data.submenuItems);
            if (submenuEntry) {
                const [,submenu] = submenuEntry;
                // no submenu specified => we disable whole menu section
                if (subItemId === undefined) {
                    submenu.disabled = true;

                } else {
                    const item = List.find(v => v.ident === itemId, submenu.items);
                    if (item) {
                        item.disabled = true;
                    }
                }
            }
        },
        disabled
    );
    return data;
}

/**
 *
 */
class MenuShortcutMapper implements Kontext.IMainMenuShortcutMapper {

    private shortcuts:Array<Kontext.EventTriggeringSubmenuItem>;

    constructor(shortcuts:Array<Kontext.EventTriggeringSubmenuItem>) {
        this.shortcuts = shortcuts;
    }

    get(keyCode:number, keyMod:string):Kontext.EventTriggeringSubmenuItem {
        return this.shortcuts.find(x => {
            return x.keyCode === keyCode && x.keyMod === keyMod;
        });
    }

    register(keyCode:number, keyMod:string, message:string, args:Kontext.GeneralProps):void {
        this.shortcuts.push({
            ident: `${keyCode}_${keyMod}_${message}`,
            label: '',
            hint: null,
            message,
            args,
            keyCode,
            keyMod,
            indirect: false,
            disabled: false
        });
    }
}


export interface MainMenuModelState {
    activeItem:Kontext.MainMenuActiveItem|null;
    visibleSubmenu:string|null;
    data:Array<Kontext.MenuEntry>;
    isBusy:boolean;
    concArgs:ConcServerArgs;
}


export class MainMenuModel extends StatelessModel<MainMenuModelState> {

    private readonly pageModel:PageModel;


    constructor(dispatcher:IActionDispatcher, pageModel:PageModel, initialData:InitialMenuData,
            concArgs:ConcServerArgs) {
        super(
            dispatcher,
            {
                activeItem: null,
                visibleSubmenu: null,
                data: importMenuData(initialData.submenuItems),
                isBusy: false,
                concArgs
            }
        );
        this.pageModel = pageModel;

        this.addActionHandler<Actions.UndoLastQueryOp>(
            ActionName.UndoLastQueryOp,
            null,
            (state, action, dispatch) => {
                window.history.back();
            }
        );

        this.addActionHandler<Actions.SetVisibleSubmenu>(
            ActionName.SetVisibleSubmenu,
            (state, action) => {
                state.visibleSubmenu = action.payload.value;
            }
        );

        this.addActionHandler<Actions.ClearVisibleSubmenu>(
            ActionName.ClearVisibleSubmenu,
            (state, action) => {
                state.visibleSubmenu = null;
            }
        );

        this.addActionHandler<Actions.ClearActiveItem>(
            ActionName.ClearActiveItem,
            (state, action) => {
                state.activeItem = null;
            }
        ).reduceAlsoOn(
            ConcActionName.AddedNewOperation
        );

        this.addActionHandler<Actions.ShowSort>(
            ActionName.ShowSort,
            (state, action) => {
                state.activeItem = {
                    actionName: action.name,
                    actionArgs: action.payload
                };
            }
        ).reduceAlsoOn(
            ActionName.ApplyShuffle,
            ActionName.ShowSample,
            ActionName.OverviewShowQueryInfo,
            ActionName.ShowSaveQueryAsForm,
            ActionName.MakeConcLinkPersistent,
            ActionName.UndoLastQueryOp,
            ActionName.FilterApplySubhitsRemove,
            ActionName.FilterApplyFirstOccurrences,
            ActionName.ShowFreqForm,
            ActionName.ShowCollForm,
            ConcActionName.SwitchKwicSentMode,
            ActionName.ShowAttrsViewOptions,
            ActionName.ShowGeneralViewOptions,
            ActionName.ShowCitationInfo,
            ActionName.ShowKeyShortcuts,
            ActionName.ShowQueryHistory
        );

        this.addActionHandler<Actions.ShowFilter>(
            ActionName.ShowFilter,
            (state, action) => {
                state.activeItem = {
                    actionName: action.name,
                    actionArgs: action.payload
                };
            },
            (_, action, __) => {
                if (action.payload.within) {
                    this.pageModel.replaceConcArg('maincorp', [action.payload.maincorp]);
                }
            }
        );

        this.addActionHandler<GeneralOptsActions.GeneralSubmitDone>(
            GeneralOptsActionName.GeneralSubmitDone,
            (state, action) => {
                state.activeItem = null;
            }
        );

        this.addActionHandler<GlobalActions.ConcArgsUpdated>(
            GlobalActionName.ConcArgsUpdated,
            (state, action) => {
                state.concArgs = action.payload.args
            }
        );
    }

    exportKeyShortcutActions():Kontext.IMainMenuShortcutMapper {
        return new MenuShortcutMapper(pipe(
            this.getState().data,
            List.flatMap(([,v]) => v.items),
            List.filter(v => isEventTriggeringItem(v) && !!v.keyCode),
            List.map(v => v as Kontext.EventTriggeringSubmenuItem)
        ));
    }

}