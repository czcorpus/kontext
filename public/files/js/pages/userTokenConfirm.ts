/*
 * Copyright (c) 2019 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2019 Tomas Machalek <tomas.machalek@gmail.com>
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
import {KontextPage} from '../app/main';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/userTokenConfirm.less');


export function init(conf:Kontext.Conf):void {
    const layoutModel = new KontextPage(conf);

    layoutModel.init(true, [], () => {
        const link = document.getElementById('try-login');
        if (link) {
            link.addEventListener('click', () => {
                layoutModel.dispatcher.dispatch({
                    name: 'USER_SHOW_LOGIN_DIALOG',
                    payload: {
                        returnUrl: layoutModel.createActionUrl('first_form')
                    }
                });
            });
        }
    });
}