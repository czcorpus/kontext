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
import { Bound, IActionDispatcher } from 'kombo';
import * as Kontext from '../../../types/kontext';
import { SearchHistoryModel } from '../../../models/searchHistory';
import * as S from './style';
import * as theme from '../../theme/default';
import { Actions } from '../../../models/searchHistory/actions';
import { SearchHistoryModelState } from '../../../models/searchHistory/common';
import { init as extendedSearchFormInit } from './forms';


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    queryHistoryModel:SearchHistoryModel
):React.ComponentClass<{}> {

    const layoutViews = he.getLayoutViews();
    const extendedSearchForms = extendedSearchFormInit(dispatcher, he);

    // -------------------- <FulltextFieldset /> -------------------------

    const FulltextFieldset:React.FC<SearchHistoryModelState> = (props) => {

        const handleClickExpand = () => {
            dispatcher.dispatch(
                Actions.ToggleAdvancedSearch
            );
        };

        const handleClickSearch = () => {
            dispatcher.dispatch(
                Actions.SubmitExtendedSearch
            );
        };

        const renderExtendedForm = () => {
            switch (props.querySupertype) {
                case 'conc':
                    return <extendedSearchForms.ConcForm
                        fsQueryCQLProps={props.fsQueryCQLProps}
                        fsAnyPropertyValue={props.fsAnyPropertyValue}
                        fsPosattrName={props.fsPosattrName}
                        fsPosattrValue={props.fsPosattrValue}
                        fsStructureName={props.fsStructureName}
                        fsStructattrName={props.fsStructattrName}
                        fsStructattrValue={props.fsStructattrValue} />
                case 'pquery':
                    return <extendedSearchForms.PQueryForm
                        fsQueryCQLProps={props.fsQueryCQLProps}
                        fsAnyPropertyValue={props.fsAnyPropertyValue}
                        fsPosattrName={props.fsPosattrName}
                        fsPosattrValue={props.fsPosattrValue}
                        fsStructureName={props.fsStructureName}
                        fsStructattrName={props.fsStructattrName}
                        fsStructattrValue={props.fsStructattrValue} />
                case 'wlist':
                    return <extendedSearchForms.WListForm
                        fsAnyPropertyValue={props.fsAnyPropertyValue} />
                case 'kwords':
                    return <extendedSearchForms.KWordsForm
                        fsAnyPropertyValue={props.fsAnyPropertyValue} />
                default:
                    return <extendedSearchForms.AnyForm
                        fsAnyPropertyValue={props.fsAnyPropertyValue} />
            }
        }

        return (
            <S.FulltextBlock>
                <theme.ExpandableSectionLabel>
                    <layoutViews.ExpandButton isExpanded={props.extendedSearchVisible} onClick={handleClickExpand} />
                    <a style={{cursor: 'pointer'}} onClick={() => handleClickExpand()}>{he.translate('qhistory__advanced_search')}</a>
                </theme.ExpandableSectionLabel>
                {props.extendedSearchVisible ?
                    <>
                        {renderExtendedForm()}
                        <div className="button">
                            <button type="button" className="util-button"
                                    onClick={handleClickSearch}>
                                {he.translate('qhistory__search_button')}
                            </button>
                        </div>
                    </> :
                    null
                }
            </S.FulltextBlock>       
        )
    }

    return Bound(FulltextFieldset, queryHistoryModel);

}