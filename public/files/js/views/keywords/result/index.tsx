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


import * as React from 'react';
import { Bound, IActionDispatcher } from 'kombo';

import * as Kontext from '../../../types/kontext';
import { KeywordsResultModel, KeywordsResultState } from '../../../models/keywords/result';
import { List } from 'cnc-tskit';
import * as S from './style';


export interface KeywordsResultViewArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    keywordsResultModel:KeywordsResultModel;
}

export function init({
    dispatcher,
    he,
    keywordsResultModel
}:KeywordsResultViewArgs):React.ComponentClass<{}> {

    const layoutViews = he.getLayoutViews();


    const KeywordsResult:React.FC<KeywordsResultState> = (props) => {

        return (
            <S.KeywordsResult>

                <dl className="corpora">
                    <dt>{he.translate('kwords__focus_corpus')}:</dt>
                    <dd>{props.focusCorpname} {props.focusSubcorpname ? ` / ${props.focusSubcorpname}` : ''}</dd>
                    <dt>{he.translate('kwords__reference_corpus')}:</dt>
                    <dd>{props.refCorpname} {props.refSubcorpname ? ` / ${props.refSubcorpname}` : ''}</dd>
                </dl>

                <table className="data">
                    <thead>
                        <tr>
                            <th>{he.translate('kwords__result_word_hd')}</th>
                            <th>{he.translate('kwords__score_col_hd')}</th>
                            <th>{he.translate('kwords__effect_size')}</th>
                            <th>{he.translate('kwords__freq_in_corp1_hd')}</th>
                            <th>{he.translate('kwords__freq_in_corp2_hd')}</th>
                            <th>{he.translate('kwords__rel_freq_in_corp1_hd')}</th>
                            <th>{he.translate('kwords__rel_freq_in_corp2_hd')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {
                            List.map(
                                kw => (
                                    <tr key={`item:${kw.item}`}>
                                        <td className="kword">{kw.item}</td>
                                        <td className="num">{he.formatNumber(kw.score, 2)}</td>
                                        <td className="num">{he.formatNumber(kw.size_effect, 2)}</td>
                                        <td className="num">{he.formatNumber(kw.frq1, 0)}</td>
                                        <td className="num">{he.formatNumber(kw.frq2, 0)}</td>
                                        <td className="num">{he.formatNumber(kw.rel_frq1, 2)}</td>
                                        <td className="num">{he.formatNumber(kw.rel_frq2, 2)}</td>
                                    </tr>
                                ),
                                props.data
                            )
                        }
                    </tbody>
                </table>
            </S.KeywordsResult>
        );
    }


    return Bound(KeywordsResult, keywordsResultModel);

}