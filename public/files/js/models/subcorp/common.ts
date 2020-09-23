/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

export type InputMode = 'gui'|'within';

export interface BaseSubcorFormState {
    subcname:Kontext.FormValue<string>;
    description:Kontext.FormValue<string>;
    otherValidationError:Error|null;
}

interface SubmitBase {
    corpname:string;
    subcname:string;
    publish:boolean;
    description:string;
}

export interface CreateSubcorpusArgs extends SubmitBase {
    text_types:{[sca:string]:Array<string>|Array<number>};
    aligned_corpora:Array<string>;
    form_type:'tt-sel';
}

export interface CreateSubcorpusWithinArgs extends SubmitBase {
    within:Array<{
        negated:boolean;
        structure_name:string;
        attribute_cql:string;
    }>;
    form_type:'within';
}

export interface CreateSubcorpusRawCQLArgs extends SubmitBase {
    cql:string;
    form_type:'cql';
}
