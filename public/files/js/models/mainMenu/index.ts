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

import * as Kontext from '../../types/kontext';
import { PageModel } from '../../app/page';
import { Actions } from './actions';
import { Actions as ConcActions } from '../concordance/actions';
import { Actions as GeneralOptsActions } from '../options/actions';
import { Actions as GlobalActions } from '../common/actions';
import { Actions as FreqActions } from '../freqs/regular/actions';
import { ConcServerArgs } from '../concordance/common';
import { FreqResultViews } from '../freqs/common';



export interface DynamicSubmenuItem extends Kontext.SubmenuItem {
    boundAction:()=>void;
    indirect:boolean;
}

export interface StaticSubmenuItem extends Kontext.SubmenuItem {
    action:string;
    args:{[key:string]:string};
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
    return (item as DynamicSubmenuItem).boundAction !== undefined;
}

/**
 * This defines a TS type guard for StaticSubmenuItem
 */
export function isStaticItem(item:Kontext.SubmenuItem): item is StaticSubmenuItem {
    return (item as StaticSubmenuItem).args !== undefined &&
                !item.hasOwnProperty('message');
}

export function isEventTriggeringItem(item:Kontext.SubmenuItem):
        item is Kontext.EventTriggeringSubmenuItem {
    return (item as Kontext.EventTriggeringSubmenuItem).message !== undefined;
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
    freqsPrevItems:Array<Kontext.SubmenuItem>;
    corpname:string;
    humanCorpname:string;
    usesubcorp?:string;
    subcName?:string;
    foreignSubcorp?:boolean;
}

interface MainMenuModelArgs {
    dispatcher:IActionDispatcher;
    pageModel:PageModel;
    initialData:InitialMenuData;
    concArgs:ConcServerArgs;
    freqDefaultView:FreqResultViews;
}


export class MainMenuModel extends StatelessModel<MainMenuModelState> {

    private readonly pageModel:PageModel;


    constructor({
        dispatcher,
        pageModel,
        initialData,
        concArgs,
        freqDefaultView
    }:MainMenuModelArgs) {
        const data = importMenuData(initialData.submenuItems);
        // here we have to make a kind of correction as traditionally, server
        // sends "save" menu items but starting from v0.16, it is configurable
        // whether we display tables (with different avail. formats for "quick save")
        // or charts (with only "custom..." save action)
        const [,customSaveItem] = List.find(([id,]) => id === 'menu-save', data);
        const freqsPrevItems = freqDefaultView === 'charts' ? customSaveItem.items : [];
        customSaveItem.items = freqDefaultView === 'charts' ?
                [List.last(customSaveItem.items)] : customSaveItem.items;
        super(
            dispatcher,
            {
                activeItem: null,
                visibleSubmenu: null,
                data,
                isBusy: false,
                concArgs,
                freqsPrevItems,
                corpname: pageModel.getCorpusIdent().id,
                humanCorpname: pageModel.getCorpusIdent().name,
                usesubcorp: pageModel.getCorpusIdent().usesubcorp,
                subcName: pageModel.getCorpusIdent().subcName,
                foreignSubcorp: pageModel.getCorpusIdent().foreignSubcorp
            }
        );
        this.pageModel = pageModel;

        if (this.pageModel.getConf('integrationTestingEnv')) {
            window['integrationTesting'] = {
                showSubmenu : (value:string) => {
                    dispatcher.dispatch(
                        Actions.SetVisibleSubmenu,
                        {value}
                    )
                }
            }
        }

        this.addActionHandler(
            Actions.UndoLastQueryOp,
            null,
            (state, action, dispatch) => {
                window.history.back();
            }
        );

        this.addActionHandler(
            Actions.SetVisibleSubmenu,
            (state, action) => {
                state.visibleSubmenu = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.ClearVisibleSubmenu,
            (state, action) => {
                state.visibleSubmenu = null;
            }
        );

        this.addActionHandler(
            Actions.ClearActiveItem,
            (state, action) => {
                state.activeItem = null;
            }
        ).reduceAlsoOn(
            ConcActions.AddedNewOperation.name
        );

        this.addActionHandler(
            Actions.ShowSort,
            (state, action) => {
                state.activeItem = {
                    actionName: action.name,
                    actionArgs: action.payload
                };
            }
        ).reduceAlsoOn(
            Actions.ApplyShuffle.name,
            Actions.ShowSample.name,
            Actions.OverviewShowQueryInfo.name,
            Actions.MakeConcLinkPersistent.name,
            Actions.UndoLastQueryOp.name,
            Actions.FilterApplySubhitsRemove.name,
            Actions.FilterApplyFirstOccurrences.name,
            Actions.ShowFreqForm.name,
            Actions.ShowCollForm.name,
            ConcActions.SwitchKwicSentMode.name,
            Actions.ShowAttrsViewOptions.name,
            Actions.ShowGeneralViewOptions.name,
            Actions.ShowCitationInfo.name,
            Actions.ShowKeyShortcuts.name,
            Actions.ShowQueryHistory.name
        );

        this.addActionHandler(
            Actions.ShowFilter,
            (state, action) => {
                state.activeItem = {
                    actionName: action.name,
                    actionArgs: action.payload
                };
            },
            (_, action, __) => {
                if (action.payload.within) {
                    this.pageModel.updateConcArgs({maincorp: action.payload.maincorp});
                }
            }
        );

        this.addActionHandler(
            Actions.ToggleDisabled,
            (state, action) => {
                List.forEach(
                    ({menuId, submenuId, disabled}) => {
                        this.toggleMenuItem(state, menuId, submenuId, disabled);
                    },
                    action.payload.items
                )
            }
        );

        this.addActionHandler(
            GeneralOptsActions.GeneralSubmitDone,
            (state, action) => {
                state.activeItem = null;
            }
        );

        this.addActionHandler(
            GlobalActions.ConcArgsUpdated,
            (state, action) => {
                state.concArgs = action.payload.args
            }
        );

        this.addActionHandler(
            GlobalActions.CorpusSwitchModelRestore,
            (state, action) => {
                const targetCorp = action.payload.corpora[0][1];
                this.updateStaticMenuItemTargetCorpus(
                    state,
                    'menu-corpora',
                    'create-subcorpus',
                    targetCorp
                );
                this.updateStaticMenuItemTargetCorpus(
                    state,
                    'menu-new-query',
                    'new-query',
                    targetCorp
                );
                this.updateStaticMenuItemTargetCorpus(
                    state,
                    'menu-new-query',
                    'paradigmatic-query',
                    targetCorp
                );
                this.updateStaticMenuItemTargetCorpus(
                    state,
                    'menu-new-query',
                    'wordlist',
                    targetCorp
                );
            }
        );

        this.addActionHandler(
            FreqActions.ResultSetActiveTab,
            (state, action) => {
                const [,srch] = List.find(([id,]) => id === 'menu-save', state.data);
                const tmp = state.freqsPrevItems;
                state.freqsPrevItems = srch.items;
                srch.items = tmp;
            }
        )
    }

    private findMenuItem(
        state:MainMenuModelState,
        menuSection:string,
        menuItem:string
    ):Kontext.SubmenuItem|undefined {

        const [,section] = List.find(([id,]) => id === menuSection, state.data);
        if (!section) {
            return undefined;
        }
        return List.find(item => item.ident === menuItem, section.items);
    }

    private updateStaticMenuItemTargetCorpus(
        state:MainMenuModelState,
        menuSection:string,
        menuItem:string,
        corpname:string

    ):void {
        const submenuItem = this.findMenuItem(state, menuSection, menuItem);
        if (!submenuItem) {
            throw new Error(`Menu item "${menuSection}"->"${menuItem}" not found. Probably a broken installation`);
        }
        if (!submenuItem.disabled && isStaticItem(submenuItem)) {
            submenuItem.args['corpname'] = corpname;
        }
    }

    private toggleMenuItem(
        state:MainMenuModelState,
        menuId:string,
        submenuId:string|undefined,
        disabled:boolean
    ):void {

        const srchIdx = List.findIndex(([id,]) => id === menuId, state.data);
        if (srchIdx > -1) {
            const [,submenu] = state.data[srchIdx];
            if (submenuId) {
                const subSrchIdx = List.findIndex(
                    v => v.ident === submenuId, submenu.items);
                if (subSrchIdx > -1) {
                    submenu.items[subSrchIdx].disabled = disabled;
                }

            } else {
                submenu.disabled = disabled;
            }
        }
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