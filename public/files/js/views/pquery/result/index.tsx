/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import * as React from 'react';
import { Bound, IActionDispatcher } from 'kombo';

import { Kontext } from '../../../types/common';
import { PqueryResultModel, PqueryResultModelState } from '../../../models/pquery/result';
import * as S from './style';
import { List } from 'cnc-tskit';

export interface PqueryFormViewsArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    model:PqueryResultModel;
}

interface PqueryFormProps {
    corparchWidget:React.ComponentClass;
}


export function init({dispatcher, he, model}:PqueryFormViewsArgs):React.ComponentClass<{}> {

    // ---------------- <PqueryResultSection /> ----------------------------

    const PqueryResultSection:React.FC<PqueryResultModelState> = (props) => {

        return props.isVisible ?
            (
                <S.PqueryResultSection>
                    <h2>Pquery result</h2>
                    <table>
                        <tbody>
                            {List.map(
                                ([word, freq], i) => (
                                    <tr key={`${i}:${word}`}><td>{word}</td><td className="num">{freq}</td></tr>
                                ),
                                props.data
                            )}
                        </tbody>
                    </table>
                </S.PqueryResultSection>
            ) :
            null
    };

    return Bound(PqueryResultSection, model);
}
