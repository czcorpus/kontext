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
import {StatefulModel} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher, Action} from '../../app/dispatcher';

declare var require:(ident:string)=>any; // Webpack
const kbLayouts:Array<Kontext.VirtualKeyboardLayout> = require('misc/keyboardLayouts');


export type VirtualKeyboardLayouts = Array<Kontext.VirtualKeyboardLayout>;


export class VirtualKeyboardModel extends StatefulModel {

    private pageModel:PageModel;

    private layouts:VirtualKeyboardLayouts;

    private currLayout:number;

    private externalKeyHit:number;

    private keyCodes:Array<Array<number>> = [
        [192, 49, 50, 51, 52, 53, 54, 55, 56, 57, 48, 189, 187, 8],
        [null, 81, 87, 69, 82, 84, 89, 85, 73, 79, 80, 219, 221, 220],
        [20, 65, 83, 68, 70, 71, 72, 74, 75, 76, 186, 222, 18],
        [null, 90, 88, 67, 86, 66, 78, 77, 188, 190, 191, 18],
        [32]
    ];

    constructor(dispatcher:ActionDispatcher, pageModel:PageModel) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.currLayout = 0;

        this.dispatcher.register((action:Action) => {

            switch (action.actionType) {
                case 'QUERY_INPUT_HIT_VIRTUAL_KEYBOARD_KEY':
                    this.externalKeyHit = action.props['keyCode'];
                    this.notifyChangeListeners();
                    let timeout;
                    const clickSim = () => {
                        this.externalKeyHit = null;
                        this.notifyChangeListeners();
                        window.clearTimeout(timeout);
                    };
                    timeout = window.setTimeout(clickSim, 200);
                break;
                case 'QUERY_INPUT_SET_VIRTUAL_KEYBOARD_LAYOUT':
                    this.currLayout = action.props['idx'];
                    this.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_LOAD_VIRTUAL_KEYBOARD_LAYOUTS': // TODO this a legacy action (now we have kb bundled)
                    this.layouts = kbLayouts;
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    private findMatchingKeyboard(lang:string):number {
        const ans = [];
        const walkThru = (fn:(item:string)=>boolean) => {
            for (let i = 0; i < this.layouts.length; i += 1) {
                for (let code of this.layouts[i].codes || ['en_US']) {
                    if (fn((code || '').replace('-', '_').toLowerCase())) {
                        ans.push(i);
                    }
                }
            }
        };
        const normLang = lang.toLowerCase();
        walkThru(item => item === normLang);
        walkThru(item => item.substr(0, 2) === normLang.substr(0, 2));
        if (ans.length > 0) {
            return ans[0];

        } else {
            throw new Error('Unable to find matching keyboard layout');
        }
    }

    getLayoutNames():Kontext.ListOfPairs {
        return this.layouts.map<[string, string]>(item => [item.name, item.label]);
    }

    getCurrentLayout():Kontext.VirtualKeyboardLayout {
        return this.layouts[this.currLayout];
    }

    getCurrentLayoutIdx():number {
        return this.currLayout;
    }

    getActiveKey():[number, number] {
        for (let i = 0; i < this.keyCodes.length; i += 1) {
            for (let j = 0; j < this.keyCodes[i].length; j += 1) {
                if (this.keyCodes[i][j] === this.externalKeyHit) {
                    return [i, j];
                }
            }
        }
        return [null, null];
    }
}
