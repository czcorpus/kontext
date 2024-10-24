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
import { Actions } from '../../../models/searchHistory/actions';


export interface ExtendedSearchForms {
    ConcForm:React.FC<{
        fsQueryCQLProps:boolean;
        fsPosattrName:string;
        fsPosattrValue:string;
        fsPosattrValueIsSub:boolean;
        fsStructureName:string;
        fsStructattrName:string;
        fsStructattrValue:string;
        fsStructattrValueIsSub:boolean;
        fsAnyPropertyValue:string;
        fsAnyPropertyValueIsSub:boolean;
        fsCorpus:string;
        fsSubcorpus:string;
    }>;
    PQueryForm:React.FC<{
        fsQueryCQLProps:boolean;
        fsPosattrName:string;
        fsPosattrValue:string;
        fsPosattrValueIsSub:boolean;
        fsStructureName:string;
        fsStructattrName:string;
        fsStructattrValue:string;
        fsStructattrValueIsSub:boolean;
        fsAnyPropertyValue:string;
        fsAnyPropertyValueIsSub:boolean;
        fsCorpus:string;
        fsSubcorpus:string;
    }>;
    WListForm:React.FC<{
        fsQueryCQLProps:boolean;
        fsAnyPropertyValue:string;
        fsAnyPropertyValueIsSub:boolean;
        fsCorpus:string;
        fsSubcorpus:string;
        wlattr:string;
        wlpat:string;
        pfilter:string;
        nfilter:string;
    }>;
    KWordsForm:React.FC<{
        fsAnyPropertyValue:string;
        fsAnyPropertyValueIsSub:boolean;
        fsQueryCQLProps:boolean;
        fsCorpus:string;
        fsSubcorpus:string;
        fsPosattrName:string;
    }>;
    AnyForm:React.FC<{
        fsAnyPropertyValue:string;
        fsAnyPropertyValueIsSub:boolean;
        fsCorpus:string;
        fsSubcorpus:string;
    }>;
}

const largeInputCSS:React.CSSProperties = {
    height: '1.8em',
    fontSize: '1.4em',
};


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
):ExtendedSearchForms {

    // -------------------- <AnyPropertyValue /> -----------------------

    const AnyPropertyValue:React.FC<{
        value:string;
        isSubstr:boolean;
    }> = (props) => {

        const handleValueChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsAnyPropertyValue,
                {
                    value: evt.target.value
                }
            );
        };

        const handleVariantChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch(
                Actions.SetFsAnyPropertyValueIsSub,
                {
                    value: evt.target.value === "1"
                }
            );
        };

        const inputStyle:React.CSSProperties = {
            width: '20em',
            height: '1.8em',
            fontSize: '1.4em',
            gridColumn: 'span 3'
        };

        return (
            <>
                <div className="aligned">
                    <select onChange={handleVariantChange}>
                        <option value="0">{he.translate('qhistory__query_contains')}</option>
                        <option value="1">{he.translate('qhistory__query_part_contains')}</option>
                    </select>
                <strong>:</strong>
                </div>
                <input style={inputStyle} type="text" value={props.value}
                    onChange={handleValueChange} />
            </>
        );
    };

    // -------------------- <UsedPosattrs /> --------------------------

    const UsedPosattrs:React.FC<{
        attr:string;
        value:string;
        isSubstr:boolean;
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

        const handleSubSelChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch(
                Actions.SetFsPosattrValueIsSub,
                {
                    value: evt.target.value === "1"
                }
            );
        };

        return (
            <>
                <div className="aligned">
                    <select onChange={handleSubSelChange} value={props.isSubstr ? "1" : "0"}>
                        <option value="0">
                            {he.translate('qhistory__used_posattr_value')}
                        </option>
                        <option value="1">
                            {he.translate('qhistory__used_posattr_value_contains')}
                        </option>
                    </select>
                    <strong>:</strong>
                </div>
                <input style={largeInputCSS} type="text" value={props.value} onChange={handleValueChange} />
                <label>{he.translate('qhistory__used_posattrs_label')}:</label>
                <input type="text" value={props.attr} onChange={handleAttrChange} />
            </>
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
            <>
                <label>{he.translate('qhistory__used_structures_label')}:</label>
                <input type="text" value={props.attr} onChange={handleAttrChange} />
            </>
        );
    };

    // -------------------- <UsedStructattrs /> --------------------------

    const UsedStructattrs:React.FC<{
        attr:string;
        value:string;
        isSubstr:boolean;
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

        const handleSubSelChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch(
                Actions.SetFsStructattrValueIsSub,
                {
                    value: evt.target.value === "1"
                }
            );
        };

        return (
            <>
                <div className="aligned">
                    <select value={props.isSubstr ? "1" : "0"} onChange={handleSubSelChange}>
                        <option value="0">{he.translate('qhistory__used_structattrs_value')}</option>
                        <option value="1">{he.translate('qhistory__used_structattrs_value_contains')}</option>
                    </select>
                    <strong>:</strong>
                </div>
                <input style={largeInputCSS} type="text" value={props.value} onChange={handleValueChange} />
                <label>{he.translate('qhistory__used_structattrs_label')}</label>
                <input type="text" value={props.attr} onChange={handleAttrChange} />
            </>
        );
    };

    // -------------------- <UsedCorpus /> --------------------------

    const UsedCorpus:React.FC<{
        value:string;
    }> = (props) => {

        const handleValueChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsCorpus,
                {
                    value: evt.target.value
                }
            );
        };

        return (
            <>
                <label>{he.translate('global__corpus')}:</label>
                <input type="text" value={props.value} onChange={handleValueChange} />
            </>
        );
    };

    // -------------------- <UsedSubcorpus /> --------------------------

    const UsedSubcorpus:React.FC<{
        value:string;
    }> = (props) => {

        const handleValueChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsSubcorpus,
                {
                    value: evt.target.value
                }
            );
        };

        return (
            <>
                <label>{he.translate('qhistory__used_subcorpus')}:</label>
                <input type="text" value={props.value} onChange={handleValueChange} />
            </>
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
            <>
                <label htmlFor="searchHistory_QueryCQLProps">{he.translate('qhistory__srch_by_query_props')}:</label>
                <div><input id="searchHistory_QueryCQLProps" type="checkbox" checked={props.isAdvancedQuery} onChange={handleClick} /></div>
                <div></div><div></div>
            </>
        )
    };

    // -------------------- <ConcForm /> -------------------------

    const ConcForm:React.FC<{
        fsQueryCQLProps:boolean;
        fsPosattrName:string;
        fsPosattrValue:string;
        fsPosattrValueIsSub:boolean;
        fsStructureName:string;
        fsStructattrName:string;
        fsStructattrValue:string;
        fsStructattrValueIsSub:boolean;
        fsAnyPropertyValue:string;
        fsAnyPropertyValueIsSub:boolean;
        fsCorpus:string;
        fsSubcorpus:string;
    }> = (props) => {

        return <>
            <UsedCorpus value={props.fsCorpus} />
            <UsedSubcorpus value={props.fsSubcorpus} />
            <QueryCQLProps isAdvancedQuery={props.fsQueryCQLProps} />
            {props.fsQueryCQLProps ?
                <>
                    <UsedPosattrs attr={props.fsPosattrName} value={props.fsPosattrValue}
                            isSubstr={props.fsPosattrValueIsSub} />
                    <UsedStructattrs attr={props.fsStructattrName} value={props.fsStructattrValue}
                            isSubstr={props.fsStructattrValueIsSub} />
                    <UsedStructures attr={props.fsStructureName} />
                    <div />
                </> :
                <>
                    <AnyPropertyValue value={props.fsAnyPropertyValue}
                            isSubstr={props.fsAnyPropertyValueIsSub} />
                </>
            }
        </>
    }

    // -------------------- <PQueryForm /> -------------------------

    const PQueryForm:React.FC<{
        fsQueryCQLProps:boolean;
        fsPosattrName:string;
        fsPosattrValue:string;
        fsPosattrValueIsSub:boolean;
        fsStructureName:string;
        fsStructattrName:string;
        fsStructattrValue:string;
        fsStructattrValueIsSub:boolean;
        fsAnyPropertyValue:string;
        fsAnyPropertyValueIsSub:boolean;
        fsCorpus:string;
        fsSubcorpus:string;
    }> = (props) => {

        return <>
            <UsedCorpus value={props.fsCorpus} />
            <UsedSubcorpus value={props.fsSubcorpus} />
            <QueryCQLProps isAdvancedQuery={props.fsQueryCQLProps} />
            {props.fsQueryCQLProps ?
                <>
                    <UsedPosattrs attr={props.fsPosattrName} value={props.fsPosattrValue}
                            isSubstr={props.fsPosattrValueIsSub} />
                    <UsedStructattrs attr={props.fsStructattrName} value={props.fsStructattrValue}
                            isSubstr={props.fsStructattrValueIsSub} />
                    <UsedStructures attr={props.fsStructureName} />
                </> :
                <>
                    <AnyPropertyValue value={props.fsAnyPropertyValue} isSubstr={props.fsAnyPropertyValueIsSub} />
                </>
            }
        </>
    }

    // -------------------- <WListForm /> -------------------------

    const WListForm:React.FC<{
        fsQueryCQLProps:boolean;
        fsAnyPropertyValue:string;
        fsAnyPropertyValueIsSub:boolean;
        fsCorpus:string;
        fsSubcorpus:string;
        wlattr:string;
        wlpat:string;
        pfilter:string;
        nfilter:string;
    }> = (props) => {

        const handleWlpatChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsWlpat,
                {
                    value: evt.target.value
                }
            );
        };

        const handleWlattrChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsWlattr,
                {
                    value: evt.target.value
                }
            );
        };

        const handleNFilterChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsNFilter,
                {
                    value: evt.target.value
                }
            );
        };

        const handlePFilterChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsPFilter,
                {
                    value: evt.target.value
                }
            );
        };

        return <>
            <UsedCorpus value={props.fsCorpus} />
            <UsedSubcorpus value={props.fsSubcorpus} />
            <QueryCQLProps isAdvancedQuery={props.fsQueryCQLProps} />
            {props.fsQueryCQLProps ?
                <>
                    <label className="emph">{he.translate('qhistory__used_wlpat')}:</label>
                    <input style={largeInputCSS} type="text" value={props.wlpat} onChange={handleWlpatChange} />
                    <label>{he.translate('qhistory__used_wlattr')}:</label>
                    <input type="text" value={props.wlattr} onChange={handleWlattrChange} />
                    <label>{he.translate('qhistory__used_pfilter')}:</label>
                    <input type="text" value={props.pfilter} onChange={handlePFilterChange} />
                    <label>{he.translate('qhistory__used_nfilter')}:</label>
                    <input type="text" value={props.nfilter} onChange={handleNFilterChange} />
                </> :
                <>
                    <AnyPropertyValue value={props.fsAnyPropertyValue} isSubstr={props.fsAnyPropertyValueIsSub} />
                </>
            }
        </>
    }

    // -------------------- <KWordsForm /> -------------------------

    const KWordsForm:React.FC<{
        fsAnyPropertyValue:string;
        fsAnyPropertyValueIsSub:boolean;
        fsQueryCQLProps:boolean;
        fsCorpus:string;
        fsSubcorpus:string;
        fsPosattrName:string;
    }> = (props) => {

        const handleAttrChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetFsPosattrName,
                {
                    value: evt.target.value
                }
            );
        };

        return <>
            <UsedCorpus value={props.fsCorpus} />
            <UsedSubcorpus value={props.fsSubcorpus} />
            <QueryCQLProps isAdvancedQuery={props.fsQueryCQLProps} />
            {props.fsQueryCQLProps ?
                <>
                    <label>{he.translate('qhistory__used_posattrs_label')}</label>
                    <input type="text" value={props.fsPosattrName} onChange={handleAttrChange} />
                </> :
                <>
                    <AnyPropertyValue value={props.fsAnyPropertyValue}
                            isSubstr={props.fsAnyPropertyValueIsSub} />
                </>
            }
        </>
    }

    // -------------------- <AnyForm /> -------------------------

    const AnyForm:React.FC<{
        fsAnyPropertyValue:string;
        fsAnyPropertyValueIsSub:boolean;
        fsCorpus:string;
        fsSubcorpus:string;
    }> = (props) => {

        return (
            <>
                <UsedCorpus value={props.fsCorpus} />
                <UsedSubcorpus value={props.fsSubcorpus} />
                <AnyPropertyValue value={props.fsAnyPropertyValue} isSubstr={props.fsAnyPropertyValueIsSub} />
            </>
        )
    }

    return {
        ConcForm,
        PQueryForm,
        KWordsForm,
        WListForm,
        AnyForm,
    }

}