/*
 * Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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


export class Actions {
    static SubmitQuery:Action<{}> = {
        name: 'KEYWORDS_SUBMIT_QUERY'
    };

    static SubmitQueryDone:Action<{}> = {
        name: 'KEYWORDS_SUBMIT_QUERY_DONE'
    };

    static SetRefCorp:Action<{
        value: string
    }> = {
        name: 'KEYWORDS_SET_REF_CORP'
    };

    static SetRefSubcorp:Action<{
        value: string
    }> = {
        name: 'KEYWORDS_SET_REF_SUBCORP'
    };

    static SetAttr:Action<{
        value: string
    }> = {
        name: 'KEYWORDS_SET_ATTR'
    };

    static SetPattern:Action<{
        value: string
    }> = {
        name: 'KEYWORDS_SET_PATTERN'
    };
}
