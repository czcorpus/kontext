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
import { IActionDispatcher } from 'kombo';
import * as Kontext from '../../../types/kontext';
import * as S from './style';
import { Actions } from '../../../models/searchHistory/actions';


export interface ExtendedSearchForms {
    ConcForm:React.FC<{
        fsQueryCQLProps:boolean;
        fsPosattrName:string;
        fsPosattrValue:string;
        fsStructureName:string;
        fsStructattrName:string;
        fsStructattrValue:string;
        fsAnyPropertyValue:string;
    }>;
    PQueryForm:React.FC<{
        fsQueryCQLProps:boolean;
        fsPosattrName:string;
        fsPosattrValue:string;
        fsStructureName:string;
        fsStructattrName:string;
        fsStructattrValue:string;
        fsAnyPropertyValue:string;
    }>;
    WListForm:React.FC<{
        fsAnyPropertyValue:string;
    }>;
    KWordsForm:React.FC<{
        fsAnyPropertyValue:string;
    }>;
    AnyForm:React.FC<{
        fsAnyPropertyValue:string;
    }>;
}


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
):ExtendedSearchForms {

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

    // -------------------- <ConcForm /> -------------------------

    const ConcForm:React.FC<{
        fsQueryCQLProps:boolean;
        fsPosattrName:string;
        fsPosattrValue:string;
        fsStructureName:string;
        fsStructattrName:string;
        fsStructattrValue:string;
        fsAnyPropertyValue:string;
    }> = (props) => {
        
        return <S.FulltextFieldset>
            <QueryCQLProps isAdvancedQuery={props.fsQueryCQLProps} />
            {props.fsQueryCQLProps ?
                <>
                    <UsedPosattrs attr={props.fsPosattrName} value={props.fsPosattrValue} />
                    <UsedStructures attr={props.fsStructureName} />
                    <UsedStructattrs attr={props.fsStructattrName} value={props.fsStructattrValue} />
                </> :
                <AnyPropertyValue value={props.fsAnyPropertyValue} />
            }
        </S.FulltextFieldset>
    }

    // -------------------- <PQueryForm /> -------------------------

    const PQueryForm:React.FC<{
        fsQueryCQLProps:boolean;
        fsPosattrName:string;
        fsPosattrValue:string;
        fsStructureName:string;
        fsStructattrName:string;
        fsStructattrValue:string;
        fsAnyPropertyValue:string;
    }> = (props) => {
        
        return <S.FulltextFieldset>
            <QueryCQLProps isAdvancedQuery={props.fsQueryCQLProps} />
            {props.fsQueryCQLProps ?
                <>
                    <UsedPosattrs attr={props.fsPosattrName} value={props.fsPosattrValue} />
                    <UsedStructures attr={props.fsStructureName} />
                    <UsedStructattrs attr={props.fsStructattrName} value={props.fsStructattrValue} />
                </> :
                <AnyPropertyValue value={props.fsAnyPropertyValue} />
            }
        </S.FulltextFieldset>
    }

    // -------------------- <WListForm /> -------------------------

    const WListForm:React.FC<{
        fsAnyPropertyValue:string;
    }> = (props) => {
        
        return <S.FulltextFieldset>
            <AnyPropertyValue value={props.fsAnyPropertyValue} />
        </S.FulltextFieldset>
    }

    // -------------------- <KWordsForm /> -------------------------

    const KWordsForm:React.FC<{
        fsAnyPropertyValue:string;
    }> = (props) => {
        
        return <S.FulltextFieldset>
            <AnyPropertyValue value={props.fsAnyPropertyValue} />
        </S.FulltextFieldset>
    }

    // -------------------- <AnyForm /> -------------------------

    const AnyForm:React.FC<{
        fsAnyPropertyValue:string;
    }> = (props) => {
        
        return <S.FulltextFieldset>
            <AnyPropertyValue value={props.fsAnyPropertyValue} />
        </S.FulltextFieldset>
    }

    return {
        ConcForm,
        PQueryForm,
        KWordsForm,
        WListForm,
        AnyForm,
    }

}