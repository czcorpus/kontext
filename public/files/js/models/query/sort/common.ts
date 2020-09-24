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

import { Kontext } from '../../../types/common';
import { AjaxResponse } from '../../../types/ajaxResponses';
import { Dict, List, pipe, tuple } from 'cnc-tskit';



export interface SortFormProperties {
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    sbward:Array<[string, string]>;
    skey:Array<[string, string]>;
    spos:Array<[string, string]>;
    sicase:Array<[string, string]>;
    sattr:Array<[string, string]>;
    // multi-level form specific stuff
    sortlevel:Array<[string, number]>; // specifies an actual number of levels to be used from the lists below
    defaultFormAction:Array<[string, string]>; // specifies whether 'sortx' or 'mlsortx' is the default sub-form
    mlxattr:Array<[string, Array<string>]>;
    mlxicase:Array<[string, Array<string>]>;
    mlxbward:Array<[string, Array<string>]>;
    mlxpos:Array<[string, Array<number>]>;
    mlxctx:Array<[string, Array<string>]>;
}


export function importMultiLevelArg<T extends AjaxResponse.SortFormArgs[keyof AjaxResponse.SortFormArgs]>(
    name:string,
    data:AjaxResponse.SortFormArgs,
    dflt?:(n:string)=>T
):Array<T> {
    const ans:Array<T> = [];
    const srch = /mlx(.+)/.exec(name);
    const dfltFn = dflt ? dflt : (n:string) => '';
    if (!srch) {
        throw new Error('failed to parse name - not a multi-level sort identifier: ' + name);
    }
    const mkid = (i) => `ml${i}${srch[1]}`;
    let key;
    for (let i = 1; i <= 9; i += 1) {
        key = mkid(i);
        if (data.hasOwnProperty(key)) {
            ans.push(data[key] || dfltFn(key));

        } else {
            break;
        }
    }
    return ans;
}

/**
 * Extract a specific arg (using the key() function) out
 * of multiple form data storage 'args'. We assume that
 * 'args' contain multiple data sets for 'sort'
 * form type - that's why we return a list.
 *
 * @returns a list of pairs [form ID, form args] where
 * each ID is of 'sort' type
 */
export function fetchSortFormArgs<T extends AjaxResponse.SortFormArgs[keyof AjaxResponse.SortFormArgs]>(
    args:{[ident:string]:AjaxResponse.ConcFormArgs},
    initialArgs:AjaxResponse.SortFormArgs,
    key:(item:AjaxResponse.SortFormArgs)=>T|Array<T>
):Array<[string, Array<T>]> {
    const asArr = (v:T|Array<T>) => Array.isArray(v) ? v : [v];

    return pipe(
        args,
        Dict.toEntries(),
        List.filter(([, v]) => v.form_type === 'sort'),
        List.map(([formId, args]) => tuple(formId, asArr(key(<AjaxResponse.SortFormArgs>args)))),
        List.concat([tuple('__new__', asArr(key(initialArgs)))])
    );
}