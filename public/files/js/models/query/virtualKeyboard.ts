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

import { Kontext } from '../../types/common';
import { PageModel } from '../../app/page';
import { ActionName, Actions } from './actions';
import { IFullActionControl, StatelessModel } from 'kombo';
import { List } from 'cnc-tskit';
import { IUnregistrable } from '../common/common';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';


declare var require:(ident:string)=>any; // Webpack
const kbLayouts:Array<Kontext.VirtualKeyboardLayout> = require('misc/keyboardLayouts');


export interface VirtualKeyboardState {
    shiftOn:boolean;
    capsOn:boolean;
    layouts:VirtualKeyboardLayouts;
    activeKey:[number, number];
    currentLayoutIdx:number;
}


export type VirtualKeyboardLayouts = Array<Kontext.VirtualKeyboardLayout>;


export class VirtualKeyboardModel extends StatelessModel<VirtualKeyboardState>
        implements IUnregistrable {

    private pageModel:PageModel;

    private keyCodes:Array<Array<number>> = [
        [192, 49, 50, 51, 52, 53, 54, 55, 56, 57, 48, 189, 187, 8],
        [null, 81, 87, 69, 82, 84, 89, 85, 73, 79, 80, 219, 221, 220],
        [20, 65, 83, 68, 70, 71, 72, 74, 75, 76, 186, 222, 18],
        [null, 90, 88, 67, 86, 66, 78, 77, 188, 190, 191, 18],
        [32]
    ];

    constructor(dispatcher:IFullActionControl, pageModel:PageModel) {
        super(dispatcher, {
            shiftOn: false,
            capsOn: false,
            layouts: kbLayouts,
            activeKey: null,
            currentLayoutIdx: List.findIndex(
                v => v.name === pageModel.getConf('DefaultVirtKeyboard'),
                kbLayouts
            )
        });
        this.pageModel = pageModel;

        this.addActionHandler<Actions.QueryInputToggleVirtualKeyboardShift>(
            ActionName.QueryInputToggleVirtualKeyboardShift,
            (state, action) => {
                state.shiftOn = !state.shiftOn;
                state.capsOn = false;
            }
        );

        this.addActionHandler<Actions.QueryInputUnhitVirtualKeyboardShift>(
            ActionName.QueryInputUnhitVirtualKeyboardShift,
            (state, action) => {
                state.shiftOn = false;
            }
        );

        this.addActionHandler<Actions.QueryInputToggleVirtualKeyboardCaps>(
            ActionName.QueryInputToggleVirtualKeyboardCaps,
            (state, action) => {
                state.capsOn = !state.capsOn;
                state.shiftOn = false;
            }
        );

        this.addActionHandler<Actions.QueryInputUnhitVirtualKeyboardKey>(
            ActionName.QueryInputUnhitVirtualKeyboardKey,
            (state, action) => {
                state.activeKey = null;
            }
        );

        this.addActionHandler<Actions.QueryInputHitVirtualKeyboardKey>(
            ActionName.QueryInputHitVirtualKeyboardKey,
            (state, action) => {
                state.activeKey = this.getActiveKey(action.payload.keyCode);
            },
            (state, action, dispatch) => {
                let timeout;
                const clickSim = () => {
                    dispatch<Actions.QueryInputUnhitVirtualKeyboardKey>({
                        name:ActionName.QueryInputUnhitVirtualKeyboardKey
                    });
                    window.clearTimeout(timeout);
                };
                timeout = window.setTimeout(clickSim, 200);
            }
        );

        this.addActionHandler<Actions.QueryInputSetVirtualKeyboardLayout>(
            ActionName.QueryInputSetVirtualKeyboardLayout,
            (state, action) => {
                state.currentLayoutIdx = action.payload.idx;
            }
        );

        this.addActionHandler<GlobalActions.SwitchCorpus>(
            GlobalActionName.SwitchCorpus,
            null,
            (state, action, dispatch) => {
                dispatch<GlobalActions.SwitchCorpusReady<{}>>({
                    name: GlobalActionName.SwitchCorpusReady,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: {}
                    }
                });
            }
        );
    }

    getRegistrationId():string {
        return 'virtual-keyboard-model';
    }

    getActiveKey(keyCode:number):[number, number] {
        const rowIdx = List.findIndex(row => row.includes(keyCode), this.keyCodes);
        if (rowIdx === -1) return null;
        const collIdx = List.findIndex(key => key === keyCode, this.keyCodes[rowIdx]);
        return [rowIdx, collIdx];
    }
}
