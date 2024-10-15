/*
 * Copyright (c) 2024 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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
import * as Kontext from '../../../types/kontext';
import { SearchHistoryModel } from '../../../models/searchHistory';
import { Actions } from '../../../models/searchHistory/actions';
import { SearchHistoryModelState } from '../../../models/searchHistory/common';
import { init as extendedSearchFormInit } from './fulltextForms';
import * as S from './style';

export interface FieldsViews {
    BasicFields:React.ComponentClass<{corpusSel:boolean}>;
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

        return (
            <S.SearchKindSelector value={props.value} onChange={handleChange}>
                <option value="">{he.translate('qhistory__qs_any')}</option>
                <option value="conc">{he.translate('qhistory__qs_conc')}</option>
                <option value="pquery">{he.translate('qhistory__qs_pquery')}</option>
                <option value="wlist">{he.translate('qhistory__qs_wlist')}</option>
                <option value="kwords">{he.translate('qhistory__qs_kwords')}</option>
            </S.SearchKindSelector>
        );
    };

    // -------------------- <CurrentCorpCheckbox /> ------------------------

    const CurrentCorpCheckbox:React.FC<{
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
        return (
            <S.CurrentCorpCheckbox>
                 <input type="checkbox" checked={props.value} onChange={handleChange}
                        style={{verticalAlign: 'middle'}} />
            </S.CurrentCorpCheckbox>
        );
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
            <S.ArchivedOnlyCheckbox>
               <input type="checkbox" checked={props.value} onChange={handleChange}
                        style={{verticalAlign: 'middle'}} />
            </S.ArchivedOnlyCheckbox>
        )
    }

    // -------------------- <BasicFieldset /> -------------------------

    const BasicFields:React.FC<SearchHistoryModelState & {corpusSel:boolean}> = (props) => {
        return (
            <>
                {props.corpusSel ?
                    <>
                        <label>{he.translate('qhistory__curr_corp_only_label_{corpus}', {corpus: props.corpname})}:</label>
                        <CurrentCorpCheckbox value={props.currentCorpusOnly} />
                    </> :
                    null
                }
                <label>{he.translate('qhistory__query_supertype_sel')}:</label>
                <SearchKindSelector value={props.querySupertype} />
                <label>{he.translate('qhistory__checkbox_archived_only')}:</label>
                <ArchivedOnlyCheckbox value={props.archivedOnly} />
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
                        fsCorpus={props.fsCorpus}
                        fsSubcorpus={props.fsSubcorpus}
                        fsPosattrName={props.fsPosattrName}
                        fsPosattrValue={props.fsPosattrValue}
                        fsStructureName={props.fsStructureName}
                        fsStructattrName={props.fsStructattrName}
                        fsStructattrValue={props.fsStructattrValue} />
                case 'pquery':
                    return <extendedSearchForms.PQueryForm
                        fsQueryCQLProps={props.fsQueryCQLProps}
                        fsAnyPropertyValue={props.fsAnyPropertyValue}
                        fsCorpus={props.fsCorpus}
                        fsSubcorpus={props.fsSubcorpus}
                        fsPosattrName={props.fsPosattrName}
                        fsPosattrValue={props.fsPosattrValue}
                        fsStructureName={props.fsStructureName}
                        fsStructattrName={props.fsStructattrName}
                        fsStructattrValue={props.fsStructattrValue} />
                case 'wlist':
                    return <extendedSearchForms.WListForm
                        fsAnyPropertyValue={props.fsAnyPropertyValue}
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
                        fsQueryCQLProps={props.fsQueryCQLProps}
                        fsCorpus={props.fsCorpus}
                        fsSubcorpus={props.fsSubcorpus}
                        fsPosattrName={props.fsPosattrName} />
                default:
                    return <extendedSearchForms.AnyForm
                            fsCorpus={props.fsCorpus}
                            fsSubcorpus={props.fsSubcorpus}
                            fsAnyPropertyValue={props.fsAnyPropertyValue} />
            }
        }

        return renderExtendedForm();
    }

    return {
        BasicFields: BoundWithProps<{corpusSel:boolean}, SearchHistoryModelState>(
            BasicFields, queryHistoryModel),
        ExtendedFields: Bound(AdvancedFields, queryHistoryModel),
    }
}