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
import { ProviderWordMatch, FreqDistType } from './model';


export class Actions {

    static FetchInfoDone:Action<{
        data:Array<ProviderWordMatch>;
        freqType:FreqDistType;
    }> = {
        name: 'KWIC_CONNECT_FETCH_INFO_DONE'
    };

    static FetchPartialInfoDone:Action<{
        data:Array<ProviderWordMatch>;
    }> = {
        name: 'KWIC_CONNECT_FETCH_PARTIAL_INFO_DONE'
    }

}