/*
 * Copyright (c) 2024 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2024 Tomas Machalek <tomas.machalek@gmail.com>
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
import { Bound, BoundWithProps, IActionDispatcher } from 'kombo';
import * as Kontext from '../../../types/kontext.js';
import { SearchHistoryModel } from '../../../models/searchHistory/index.js';
import { Actions } from '../../../models/searchHistory/actions.js';
import { SearchHistoryModelState } from '../../../models/searchHistory/common.js';
import { init as extendedSearchFormInit } from './fulltextForms.js';
import * as S from './style.js';

export interface FieldsViews {
    BasicFields:React.ComponentClass<{corpusSel:boolean; archivedAsEnable:boolean}>;
    ExtendedFields:React.ComponentClass<{}>;
}

export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    queryHistoryModel:SearchHistoryModel
):FieldsViews {

    const extendedSearchForms = extendedSearchFormInit(dispatcher, he);

    // -------------------- <QueryTypeSelector /> ------------------------

    const SearchKindSelector:React.FC<{
        value:Kontext.QuerySupertype;

    }> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch<typeof Actions.HistorySetQuerySupertype>({
                name: Actions.HistorySetQuerySupertype.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return <>
            <label>{he.translate('qhistory__query_supertype_sel')}:</label>
            <S.SearchKindSelector value={props.value} onChange={handleChange}>
                <option value="">{he.translate('qhistory__qs_any')}</option>
                <option value="conc">{he.translate('qhistory__qs_conc')}</option>
                <option value="pquery">{he.translate('qhistory__qs_pquery')}</option>
                <option value="wlist">{he.translate('qhistory__qs_wlist')}</option>
                <option value="kwords">{he.translate('qhistory__qs_kwords')}</option>
            </S.SearchKindSelector>
        </>;
    };

    // -------------------- <CurrentCorpCheckbox /> ------------------------

    const CurrentCorpCheckbox:React.FC<{
        corpname:string;
        value:boolean;

    }> = (props) => {

        const handleChange = () => {
            dispatcher.dispatch<typeof Actions.HistorySetCurrentCorpusOnly>({
                name: Actions.HistorySetCurrentCorpusOnly.name,
                payload: {
                    value: !props.value
                }
            });
        };
        return <>
            <label htmlFor="curr-corp-only">{he.translate('qhistory__curr_corp_only_label_{corpus}', {corpus: props.corpname})}:</label>
            <S.CurrentCorpCheckbox>
                 <input id="curr-corp-only" type="checkbox" checked={props.value} onChange={handleChange}
                        style={{verticalAlign: 'middle'}} />
            </S.CurrentCorpCheckbox>
        </>;
    };

    // -------------------- <ArchivedOnlyCheckbox /> ------------------------

    const ArchivedOnlyCheckbox:React.FC<{
        value:boolean;

    }> = (props) => {
        const handleChange = () => {
            dispatcher.dispatch<typeof Actions.HistorySetArchivedOnly>({
                name: Actions.HistorySetArchivedOnly.name,
                payload: {
                    value: !props.value
                }
            });
        };

        return (
            <>
                <label htmlFor="archived-only">{he.translate('qhistory__checkbox_archived_only')}:</label>
                <S.ArchivedOnlyCheckbox>
                    <input id="archived-only" type="checkbox" checked={props.value} onChange={handleChange}
                        style={{verticalAlign: 'middle'}} />
                </S.ArchivedOnlyCheckbox>
            </>
        );
    };

    // -------------- <ArchivedAsInput /> ----------------------------

    const ArchivedAsInput:React.FC<{
        value:string;
    }> = (props) => {

        const handleChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.HistorySetArchivedAs,
                {
                    value: evt.target.value
                }
            );
        };

        return (
            <>
                <label>{he.translate('qhistory__archived_as_label')}:</label>
                <input type="text" value={props.value} onChange={handleChange} />
            </>
        );
    };

    // -------------------- <BasicFieldset /> -------------------------

    const BasicFields:React.FC<SearchHistoryModelState & {corpusSel:boolean; archivedAsEnable:boolean}> = (props) => {
        return (
            <>
                {props.corpusSel ?
                    <CurrentCorpCheckbox corpname={props.corpname} value={props.currentCorpusOnly} /> :
                    null
                }
                <SearchKindSelector value={props.querySupertype} />
                {props.archivedAsEnable ?
                    <ArchivedAsInput value={props.fsArchAs} /> :
                    <ArchivedOnlyCheckbox value={props.archivedOnly} />
                }
            </>
        );
    }

    // -------------------- <AdvancedFieldset /> -------------------------

    const AdvancedFields:React.FC<SearchHistoryModelState> = (props) => {

        const renderExtendedForm = () => {
            switch (props.querySupertype) {
                case 'conc':
                    return <extendedSearchForms.ConcForm
                        fsQueryCQLProps={props.fsQueryCQLProps}
                        fsAnyPropertyValue={props.fsAnyPropertyValue}
                        fsAnyPropertyValueIsSub={props.fsAnyPropertyValueIsSub}
                        fsCorpus={props.fsCorpus}
                        fsSubcorpus={props.fsSubcorpus}
                        fsPosattrName={props.fsPosattrName}
                        fsPosattrValue={props.fsPosattrValue}
                        fsPosattrValueIsSub={props.fsPosattrValueIsSub}
                        fsStructureName={props.fsStructureName}
                        fsStructattrName={props.fsStructattrName}
                        fsStructattrValue={props.fsStructattrValue}
                        fsStructattrValueIsSub={props.fsStructattrValueIsSub} />
                case 'pquery':
                    return <extendedSearchForms.PQueryForm
                        fsQueryCQLProps={props.fsQueryCQLProps}
                        fsAnyPropertyValue={props.fsAnyPropertyValue}
                        fsAnyPropertyValueIsSub={props.fsAnyPropertyValueIsSub}
                        fsCorpus={props.fsCorpus}
                        fsSubcorpus={props.fsSubcorpus}
                        fsPosattrName={props.fsPosattrName}
                        fsPosattrValue={props.fsPosattrValue}
                        fsPosattrValueIsSub={props.fsPosattrValueIsSub}
                        fsStructureName={props.fsStructureName}
                        fsStructattrName={props.fsStructattrName}
                        fsStructattrValue={props.fsStructattrValue}
                        fsStructattrValueIsSub={props.fsStructattrValueIsSub} />
                case 'wlist':
                    return <extendedSearchForms.WListForm
                        fsAnyPropertyValue={props.fsAnyPropertyValue}
                        fsAnyPropertyValueIsSub={props.fsAnyPropertyValueIsSub}
                        fsQueryCQLProps={props.fsQueryCQLProps}
                        fsCorpus={props.fsCorpus}
                        fsSubcorpus={props.fsSubcorpus}
                        wlattr={props.fsWlAttr}
                        wlpat={props.fsWlPat}
                        nfilter={props.fsWlNFilter}
                        pfilter={props.fsWlPFilter} />
                case 'kwords':
                    return <extendedSearchForms.KWordsForm
                        fsAnyPropertyValue={props.fsAnyPropertyValue}
                        fsAnyPropertyValueIsSub={props.fsAnyPropertyValueIsSub}
                        fsQueryCQLProps={props.fsQueryCQLProps}
                        fsCorpus={props.fsCorpus}
                        fsSubcorpus={props.fsSubcorpus}
                        fsPosattrName={props.fsPosattrName} />
                default:
                    return <extendedSearchForms.AnyForm
                            fsCorpus={props.fsCorpus}
                            fsSubcorpus={props.fsSubcorpus}
                            fsAnyPropertyValue={props.fsAnyPropertyValue}
                            fsAnyPropertyValueIsSub={props.fsAnyPropertyValueIsSub} />
            }
        }

        return renderExtendedForm();
    }

    return {
        BasicFields: BoundWithProps<{corpusSel:boolean; archivedAsEnable:boolean}, SearchHistoryModelState>(
            BasicFields, queryHistoryModel),
        ExtendedFields: Bound(AdvancedFields, queryHistoryModel),
    }
}