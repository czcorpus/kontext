/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Action } from 'kombo';
import { Kontext } from '../../types/common';

export enum ActionName {
    UserInfoRequested = 'USER_INFO_REQUESTED',
    UserInfoLoaded = 'USER_INFO_LOADED'
}

export namespace Actions {

    export interface UserInfoRequested extends Action<{
    }> {
        name:ActionName.UserInfoRequested;
    }

    export interface UserInfoLoaded extends Action<{
        data:Kontext.UserCredentials
    }> {
        name:ActionName.UserInfoLoaded;
    }

}