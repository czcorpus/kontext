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

import {SimplePageStore} from '../../util';
import {PageModel} from '../../tpl/document';


export type VirtualKeys = Array<Array<[string, string]>>;

export interface VirtualKeyboardLayout {
    codes:Array<string>;
    label:string;
    name:string;
    keys:VirtualKeys;
}

export type VirtualKeyboardLayouts = Array<VirtualKeyboardLayout>;


export class VirtualKeyboardStore extends SimplePageStore {

    private pageModel:PageModel;

    private layouts:VirtualKeyboardLayouts;

    private currLayout:number;

    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.currLayout = 0;
        const self = this;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {

            switch (payload.actionType) {
                case 'QUERY_INPUT_SET_VIRTUAL_KEYBOARD_LAYOUT':
                    self.currLayout = payload.props['idx'];
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_LOAD_VIRTUAL_KEYBOARD_LAYOUTS':
                    self.pageModel.ajax<VirtualKeyboardLayouts>(
                        'GET',
                        self.pageModel.createStaticUrl('misc/kb-layouts.json'),
                        {}
                    ).then(
                        (data) => {
                            self.layouts = data;
                            self.currLayout = self.findMatchingKeyboard(payload.props['inputLanguage']);
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.pageModel.showMessage('error', err);
                        }
                    );
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

    getLayoutNames():Array<[string, string]> {
        return this.layouts.map<[string, string]>(item => [item.name, item.label]);
    }

    getCurrentLayout():VirtualKeyboardLayout {
        return this.layouts[this.currLayout];
    }

    getCurrentLayoutIdx():number {
        return this.currLayout;
    }
}
