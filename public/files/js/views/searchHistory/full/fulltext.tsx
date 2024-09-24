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
import { Keyboard, Dict, pipe, List } from 'cnc-tskit';
import * as Kontext from '../../../types/kontext';
import { SearchHistoryModel } from '../../../models/searchHistory';
import * as S from './style';
import * as theme from '../../theme/default';
import { Actions } from '../../../models/searchHistory/actions';
import { SearchHistoryModelState } from '../../../models/searchHistory/common';


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    queryHistoryModel:SearchHistoryModel
):React.ComponentClass<{}> {

    const layoutViews = he.getLayoutViews();

    // -------------------- <UsedPosattrs /> --------------------------

    const UsedPosattrs:React.FC<{
        attr:string;
        value:string;
    }> = (props) => {

        const handleAttrChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsPosattrName,
                {
                    value: evt.target.value
                }
            );
        };

        const handleValueChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsPosattrValue,
                {
                    value: evt.target.value
                }
            );
        };

        return (
            <div className="prop-query">
                <label>{he.translate('qhistory__used_posattrs_label')}</label>
                {'\u00a0'}
                <input type="text" value={props.attr} onChange={handleAttrChange} />
                {'\u00a0'}
                {he.translate('qhistory__used_property_value')}
                {'\u00a0'}
                <input type="text" value={props.value} onChange={handleValueChange} />
            </div>
        );
    };

    // -------------------- <UsedStructures /> --------------------------

    const UsedStructures:React.FC<{
        attr:string;
    }> = (props) => {

        const handleAttrChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsStructureName,
                {
                    value: evt.target.value
                }
            );
        };

        return (
            <div className="prop-query">
                <label>{he.translate('qhistory__used_structures_label')}</label>
                {'\u00a0'}
                <input type="text" value={props.attr} onChange={handleAttrChange} />
            </div>
        );
    };

    // -------------------- <UsedStructattrs /> --------------------------

    const UsedStructattrs:React.FC<{
        attr:string;
        value:string;
    }> = (props) => {

        const handleAttrChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsStructattrName,
                {
                    value: evt.target.value
                }
            );
        };

        const handleValueChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsStructattrValue,
                {
                    value: evt.target.value
                }
            );
        };

        return (
            <div className="prop-query">
                <label>{he.translate('qhistory__used_structattrs_label')}</label>
                {'\u00a0'}
                <input type="text" value={props.attr} onChange={handleAttrChange} />
                {'\u00a0'}
                {he.translate('qhistory__used_property_value')}
                {'\u00a0'}
                <input type="text" value={props.value} onChange={handleValueChange} />
            </div>

        );
    };

    // -------------------- <AnyPropertyValue /> -----------------------

    const AnyPropertyValue:React.FC<{
        value:string;
    }> = (props) => {

        const handleValueChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsAnyPropertyValue,
                {
                    value: evt.target.value
                }
            );
        };

        return (
            <div className="prop-query">
                <label>{he.translate('qhistory__query_contains')}</label>
                {'\u00a0'}
                <input type="text" value={props.value} onChange={handleValueChange} />
            </div>
        );
    };

    // -------------------- <QueryType /> --------------------------------

    const QueryCQLProps:React.FC<{
        isAdvancedQuery:boolean;
    }> = (props) => {

        const handleClick = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsAdvancedQuery,
                {
                    value: !props.isAdvancedQuery
                }
            )
        }

        return (
            <div className="prop-query">
                <label htmlFor="searchHistory_QueryCQLProps">{he.translate('qhistory__query_cql_props')}:</label>{'\u00a0'}
                <input id="searchHistory_QueryCQLProps" type="checkbox" checked={props.isAdvancedQuery} onChange={handleClick} />
            </div>
        )
    };

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

        const shouldSeeCQLProps = (props.querySupertype === 'conc'  ||
                props.querySupertype === 'pquery') && props.fsQueryCQLProps;

        return (
            <S.FulltextBlock>
                <theme.ExpandableSectionLabel>
                    <layoutViews.ExpandButton isExpanded={props.extendedSearchVisible} onClick={handleClickExpand} />
                    <a style={{cursor: 'pointer'}} onClick={() => handleClickExpand()}>{he.translate('qhistory__advanced_search')}</a>
                </theme.ExpandableSectionLabel>
                {props.extendedSearchVisible ?
                    <>
                        <S.FulltextFieldset>
                            {props.querySupertype === 'conc' || props.querySupertype === 'pquery' ?
                                <QueryCQLProps isAdvancedQuery={props.fsQueryCQLProps} /> :
                                null
                            }
                            {shouldSeeCQLProps ?
                                <>
                                    <UsedPosattrs attr={props.fsPosattrName} value={props.fsPosattrValue} />
                                    <UsedStructures attr={props.fsStructureName} />
                                    <UsedStructattrs attr={props.fsStructattrName} value={props.fsStructattrValue} />
                                </> :
                                <AnyPropertyValue value={props.fsAnyPropertyValue} />
                            }
                        </S.FulltextFieldset>
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