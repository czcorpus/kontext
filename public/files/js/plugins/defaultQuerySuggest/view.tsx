/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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
import { Kontext } from '../../types/common';
import { IActionDispatcher } from 'kombo';
import { List, pipe, Dict, tuple } from 'cnc-tskit';
import { Model } from './model';



export enum KnownRenderers {
    BASIC = 'basic',
    ERROR = 'error',
    POS_ATTR_PAIR_REL = 'posAttrPairRel',
    UNSUPPORTED = 'unsupported'
}


export interface BasicRendererProps {
    data:Array<string>;
    itemClickHandler:(value:string)=>void;
}

export interface ErrorRendererProps {
    data:Error|string;
}

export interface UnsupportedRendererProps {
    data:unknown;
}

export interface PosAttrPairRelRendererProps {
    attrs:[string, string];
    data:{[attr1:string]:Array<string>};
    isShortened:boolean;
    itemClickHandler:(value:[string, string, string, string])=>void;
}


export interface SuggestionsViews {
    [KnownRenderers.BASIC]:React.FC<BasicRendererProps>;
    [KnownRenderers.ERROR]:React.FC<ErrorRendererProps>;
    [KnownRenderers.UNSUPPORTED]:React.FC<UnsupportedRendererProps>;
    [KnownRenderers.POS_ATTR_PAIR_REL]:React.FC<PosAttrPairRelRendererProps>;
}


export function init(dispatcher:IActionDispatcher, model:Model, he:Kontext.ComponentHelpers):SuggestionsViews {

    const layoutViews = he.getLayoutViews();

    // ------------- <UnsupportedRenderer /> -------------------------------

    const UnsupportedRenderer:React.FC<UnsupportedRendererProps> = (props) => {
        return <div className="UnsupportedRenderer">Unsupported renderer {JSON.stringify(props.data)}</div>
    }

    // ------------- <ErrorRenderer /> -------------------------------

    const ErrorRenderer:React.FC<ErrorRendererProps> = (props) => {
        return <div className="ErrorRenderer">
            <p>
                <img className="error-icon"
                        src={he.createStaticUrl('img/error-icon.svg')}
                        alt={he.translate('global__error_icon')} />
                {he.translate('defaultTD__failed_to_fetch_external_information')}.

            </p>
            <p className="gear">
                <img src={he.createStaticUrl('img/gear.svg')} alt={he.translate('defaultTD__plug_in_error_symbol_alt')}
                        style={{width: '3em'}} title={`${props.data}`} />
            </p>
        </div>
    };

    // -------------- <BasicRenderer /> ------------------------------

    const BasicRenderer:React.FC<BasicRendererProps> = (props) => {
        return <div className="BasicRenderer">
            <ul>
                {List.map(
                    (item, index) => <li key={index}>{
                        props.itemClickHandler ?
                        <a onClick={e => props.itemClickHandler(item)}>{item}</a> :
                        item
                    }</li>,
                    props.data
                )}
            </ul>
        </div>
    };

    // ------------- <PosAttrPairRelRenderer /> ----------------------

    const PosAttrPairRelRenderer:React.FC<PosAttrPairRelRendererProps> = (props) => {

        return <div className="PosAttrPairRelRenderer">
            <table>
                <thead>
                    <tr>
                        <th>{props.attrs[0]}</th>
                        <th>{props.attrs[1]}</th>
                    </tr>
                </thead>
                <tbody>
                {pipe(
                    props.data,
                    Dict.toEntries(),
                    List.sortedAlphaBy(([k,]) => k),
                    List.map(
                        ([attr1, attrs2], index) => (
                            List.empty(attrs2) ?
                                null :
                                <React.Fragment key={`${attr1}`}>
                                    <tr className={index > 0 ? 'separ' : null}>
                                        <th className="attr1" rowSpan={List.size(attrs2)}>{
                                            props.itemClickHandler ?
                                            <a onClick={e => props.itemClickHandler(tuple(props.attrs[0], attr1, props.attrs[1], undefined))}>{attr1}</a> :
                                            attr1
                                        }</th>
                                        <td>{
                                            props.itemClickHandler ?
                                            <a onClick={e => props.itemClickHandler(tuple(props.attrs[0], attr1, props.attrs[1], List.head(attrs2)))}>{List.head(attrs2)}</a> :
                                            List.head(attrs2)
                                        }</td>
                                    </tr>
                                    {pipe(
                                        attrs2,
                                        List.tail(),
                                        List.map(
                                            (attr2, i) => (
                                                <tr key={`${attr1}:${attr2}`}>
                                                <td>
                                                    {attr2 === null && i === List.size(attrs2) - 2 ?
                                                    <span title={he.translate('global__shortened')}>{'\u2026'}</span> :
                                                    (props.itemClickHandler ?
                                                        <a onClick={e => props.itemClickHandler(tuple(props.attrs[0], attr1, props.attrs[1], attr2))}>{attr2}</a> :
                                                        attr2
                                                    )
                                                    }
                                                    </td>
                                                </tr>
                                            )
                                        )
                                    )}
                                </React.Fragment>
                        )
                    )
                )}
                </tbody>
            </table>
            {props.isShortened ?
                <div className="note">
                    <layoutViews.StatusIcon status="warning" />
                    {he.translate('defaultTD__shortened_notice')}
                </div> :
                null
            }
        </div>
    };

    return {
        [KnownRenderers.BASIC]: BasicRenderer,
        [KnownRenderers.POS_ATTR_PAIR_REL]:PosAttrPairRelRenderer,
        [KnownRenderers.ERROR]: ErrorRenderer,
        [KnownRenderers.UNSUPPORTED]: UnsupportedRenderer
    }

}