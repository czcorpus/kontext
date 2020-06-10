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

import {Kontext} from '../../types/common';
import {PageModel} from '../../app/page';
import {ActionName, Actions} from './actions';
import { IFullActionControl, StatelessModel } from 'kombo';

declare var require:(ident:string)=>any; // Webpack
const kbLayouts:Array<Kontext.VirtualKeyboardLayout> = require('misc/keyboardLayouts');


interface VirtualKeyboardState {
    externalKeyHit:number;
    currLayout:number;
    layouts:VirtualKeyboardLayouts;
}


export type VirtualKeyboardLayouts = Array<Kontext.VirtualKeyboardLayout>;


export class VirtualKeyboardModel extends StatelessModel<VirtualKeyboardState> {

    private pageModel:PageModel;

    private defaultLayout:string;

    private keyCodes:Array<Array<number>> = [
        [192, 49, 50, 51, 52, 53, 54, 55, 56, 57, 48, 189, 187, 8],
        [null, 81, 87, 69, 82, 84, 89, 85, 73, 79, 80, 219, 221, 220],
        [20, 65, 83, 68, 70, 71, 72, 74, 75, 76, 186, 222, 18],
        [null, 90, 88, 67, 86, 66, 78, 77, 188, 190, 191, 18],
        [32]
    ];

    constructor(dispatcher:IFullActionControl, pageModel:PageModel) {
        super(dispatcher, {
            externalKeyHit: null,
            currLayout: null,
            layouts: null
        });
        this.pageModel = pageModel;
        this.defaultLayout = this.pageModel.getConf('DefaultVirtKeyboard');

        this.addActionHandler<Actions.QueryInputUnhitVirtualKeyboardKey>(
            ActionName.QueryInputUnhitVirtualKeyboardKey,
            (newState, action) => {
                newState.externalKeyHit = null;
            }
        );

        this.addActionHandler<Actions.QueryInputHitVirtualKeyboardKey>(
            ActionName.QueryInputHitVirtualKeyboardKey,
            (newState, action) => {
                newState.externalKeyHit = action.payload['keyCode'];
            },
            (state, action, dispatch) => {
                let timeout;
                const clickSim = () => {
                    dispatch({name:ActionName.QueryInputUnhitVirtualKeyboardKey});
                    window.clearTimeout(timeout);
                };
                timeout = window.setTimeout(clickSim, 200);
            }
        );

        this.addActionHandler<Actions.QueryInputSetVirtualKeyboardLayout>(
            ActionName.QueryInputSetVirtualKeyboardLayout,
            (newState, action) => {
                newState.currLayout = action.payload.idx;
            }
        );

        this.addActionHandler<Actions.QueryInputLoadVirtualKeyboardLayout>(  // TODO this a legacy action (now we have kb bundled)
            ActionName.QueryInputLoadVirtualKeyboardLayout,
            (newState, action) => {
                newState.layouts = kbLayouts;
            }
        );
    }

    getLayoutNames():Kontext.ListOfPairs {
        return this.getState().layouts.map<[string, string]>(item => [item.name, item.label]);
    }

    getCurrentLayout():Kontext.VirtualKeyboardLayout {
        return this.getState().layouts[this.getCurrentLayoutIdx()];
    }

    getCurrentLayoutIdx():number {
        const state = this.getState();
        const layoutIndex = state.currLayout === null ? state.layouts.findIndex(v => v.name === this.defaultLayout) : state.currLayout;
        return layoutIndex < 0 ? 0 : layoutIndex;
    }

    getActiveKey():[number, number] {
        const state = this.getState();
        for (let i = 0; i < this.keyCodes.length; i += 1) {
            for (let j = 0; j < this.keyCodes[i].length; j += 1) {
                if (this.keyCodes[i][j] === state.externalKeyHit) {
                    return [i, j];
                }
            }
        }
        return [null, null];
    }
}
