/*
 * Copyright (c) 2023 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import * as Kontext from '../../../types/kontext.js';
import { KeywordsResultModel, KeywordsResultState } from '../../../models/keywords/result.js';
import { List } from 'cnc-tskit';
import * as S from './style.js';
import { Actions } from '../../../models/keywords/actions.js';
import { KeywordsResultsSaveModel } from '../../../models/keywords/save.js';
import { init as initSaveViews } from './save.js';


export interface KeywordsResultViewArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    keywordsResultModel:KeywordsResultModel;
    saveModel:KeywordsResultsSaveModel;
}

export function init({
    dispatcher,
    he,
    keywordsResultModel,
    saveModel,
}:KeywordsResultViewArgs):React.ComponentClass<{}> {

    const layoutViews = he.getLayoutViews();

    const saveViews = initSaveViews(dispatcher, he, saveModel);

    const SortableCol:React.FC<{text:string, value:string, kwsort:string}> = (props) => {
        const handleClick = () => {
            dispatcher.dispatch<typeof Actions.ResultSetSort>({
                name: Actions.ResultSetSort.name,
                payload: {sort: props.value}
            });
        };

        if (props.value === props.kwsort) {
            return <th>
                <span title={he.translate('global__sorted')}>
                    {props.text}
                    <img className="sort-flag" src={he.createStaticUrl('img/sort_desc.svg')} />
                </span>
            </th>
        } else {
            return <th>
                <a onClick={handleClick} title={he.translate('global__click_to_sort')}>
                    {props.text}
                </a>
            </th>
        }
    }

    const PossiblyNaNValue:React.FC<{v:number}> = ({v}) => {
        if (isNaN(v) || v === null) {
            return (
                <span>
                    <layoutViews.Abbreviation
                        value={he.translate('kwords__undefined_value')}
                        desc={he.translate('kwords__undefined_value_explained')} />
                </span>
            );

        } else {
            return <span>{he.formatNumber(v, 2)}</span>
        }
    }

    const KeywordsResult:React.FC<KeywordsResultState> = (props) => {

        const _handleSaveFormClose = () => {
            dispatcher.dispatch<typeof Actions.ResultCloseSaveForm>({
                name: Actions.ResultCloseSaveForm.name
            })
        };

        const handlePageChange = (value:string) => {
            dispatcher.dispatch(
                Actions.ResultSetPage,
                {page: value},
            );
        };

        const buildQ = (value:string) => `aword,[${props.attr}="${value}"]`;

        if (props.data.length === 0) {
            return (
                <S.KeywordsResult>
                    <p className="no-result">
                        <strong>{he.translate('kwords__no_result')}</strong>
                    </p>
                    <p className="modify">
                        (<a href={he.createActionLink('keywords/form', {q: `~${props.queryId}`})}>
                            {he.translate('kwords__query_again')}
                        </a>)
                    </p>
                </S.KeywordsResult>
            );
        }
        return (
            <S.KeywordsResult>

                <dl className="corpora">
                    <dt>{he.translate('kwords__focus_corpus')}:</dt>
                    <dd>{props.focusCorpname} {props.focusSubcorpname ? ` / ${props.focusSubcorpname}` : ''}</dd>
                    <dt>{he.translate('kwords__reference_corpus')}:</dt>
                    <dd>{props.refCorpname} {props.refSubcorpId ? ` / ${props.refSubcorpId}` : ''}</dd>
                </dl>
                <div className="ktx-pagination">
                    <S.PNote>
                        {he.translate('kwords__max_list_size_explained_{limit}', {limit: props.maxItems})}
                    </S.PNote>
                    <S.PaginatorWrapper>
                        <layoutViews.SimplePaginator
                            isLoading={props.isLoading}
                            currentPage={`${props.kwpage}`}
                            totalPages={props.totalPages}
                            handlePageChange={handlePageChange} />
                    </S.PaginatorWrapper>
                </div>

                <table className="data">
                    <thead>
                        <tr>
                            <th />
                            <th>{he.translate('kwords__result_word_hd')}</th>
                            {props.manateeIsCustomCNC ?
                                <>
                                    <SortableCol text={he.translate('kwords__score_col_logL')} value="logL" kwsort={props.kwsort}/>
                                    <SortableCol text={he.translate('kwords__score_col_chi2')} value="chi2" kwsort={props.kwsort}/>
                                    <SortableCol text={he.translate('kwords__effect_size')} value="din" kwsort={props.kwsort}/>
                                </> :
                                <th>{he.translate('kwords__score_col_hd')}</th>
                            }
                            <th colSpan={2}>{he.translate('kwords__freq_in_corp1_hd')}</th>
                            <th colSpan={2}>{he.translate('kwords__freq_in_corp2_hd')}</th>
                            <th>{he.translate('kwords__rel_freq_in_corp1_hd')}</th>
                            <th>{he.translate('kwords__rel_freq_in_corp2_hd')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {
                            List.map(
                                (kw, i) => (
                                    <tr key={`item:${kw.item}`}>
                                        <td>{(props.kwpage-1)*props.kwpagesize + i + 1}.</td>
                                        <td className="kword">{kw.item}</td>
                                        {props.manateeIsCustomCNC ?
                                            <>
                                                <td className="num"><PossiblyNaNValue v={kw.logL} /></td>
                                                <td className="num">{he.formatNumber(kw.chi2, 2)}</td>
                                                <td className="num">{he.formatNumber(kw.din, 2)}</td>
                                            </> :
                                            <td className="num">{he.formatNumber(kw.score, 2)}</td>
                                        }
                                        <td className="num">{he.formatNumber(kw.frq1, 0)}</td>
                                        <td>
                                            <a title={he.translate('global__pnfilter_label_p')} href={he.createActionLink('create_view',
                                                props.focusSubcorpId ?
                                                    {corpname: props.focusCorpname, usesubcorp: props.focusSubcorpId, q: buildQ(kw.item)} :
                                                    {corpname: props.focusCorpname, q: buildQ(kw.item)}
                                            )}> p </a>
                                        </td>
                                        <td className="num">{he.formatNumber(kw.frq2, 0)}</td>
                                        <td>
                                            <a title={he.translate('global__pnfilter_label_p')} href={he.createActionLink('create_view',
                                            props.refSubcorpId ?
                                                {corpname: props.refCorpname, usesubcorp: props.refSubcorpId, q: buildQ(kw.item)} :
                                                {corpname: props.refCorpname, q: buildQ(kw.item)}
                                            )}> p </a>
                                        </td>
                                        <td className="num">{he.formatNumber(kw.rel_frq1, 2)}</td>
                                        <td className="num">{he.formatNumber(kw.rel_frq2, 2)}</td>
                                    </tr>
                                ),
                                props.data
                            )
                        }
                    </tbody>
                </table>

                {props.saveFormActive ?
                    <saveViews.SavePqueryForm onClose={_handleSaveFormClose} /> :
                    null}
            </S.KeywordsResult>
        );
    }


    return Bound(KeywordsResult, keywordsResultModel);

}