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
import { List, pipe, Dict } from 'cnc-tskit';
import { Model } from './model';



export enum KnownRenderers {
    BASIC = 'basic',
    ERROR = 'error',
    POS_ATTR_PAIR_REL = 'posAttrPairRel',
    UNSUPPORTED = 'unsupported'
}


export interface BasicRendererProps {
    data:Array<string>;
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
}


export interface SuggestionsViews {
    [KnownRenderers.BASIC]:React.SFC<BasicRendererProps>;
    [KnownRenderers.ERROR]:React.SFC<ErrorRendererProps>;
    [KnownRenderers.UNSUPPORTED]:React.SFC<UnsupportedRendererProps>;
    [KnownRenderers.POS_ATTR_PAIR_REL]:React.SFC<PosAttrPairRelRendererProps>;
}


export function init(dispatcher:IActionDispatcher, model:Model, he:Kontext.ComponentHelpers):SuggestionsViews {


    const UnsupportedRenderer:React.SFC<UnsupportedRendererProps> = (props) => {
        return <div className="suggestions-box">Unsupported renderer (TODO)</div>
    }

    // ------------- <ErrorRenderer /> -------------------------------

    const ErrorRenderer:React.SFC<ErrorRendererProps> = (props) => {
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

    const BasicRenderer:React.SFC<BasicRendererProps> = (props) => {
        return <div className="BasicRenderer">
            <ul>
                {List.map(
                    (item, index) => <li key={index}>{item}</li>,
                    props.data
                )}
            </ul>
        </div>
    };

    // ------------- <PosAttrPairRelRenderer /> ----------------------

    const PosAttrPairRelRenderer:React.SFC<PosAttrPairRelRendererProps> = (props) => {
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
                            <React.Fragment key={`${attr1}`}>
                                <tr>
                                    <th className="attr1" rowSpan={List.size(attrs2)}>{attr1}</th>
                                    <td>{List.head(attrs2)}</td>
                                </tr>
                                {pipe(
                                    attrs2,
                                    List.tail(),
                                    List.map(
                                        attr2 => <tr key={`${attr1}:${attr2}`}><td>{attr2}</td></tr>,
                                    )
                                )}
                            </React.Fragment>
                        )
                    )
                )}
                </tbody>
            </table>
        </div>
    };

    return {
        [KnownRenderers.BASIC]: BasicRenderer,
        [KnownRenderers.POS_ATTR_PAIR_REL]:PosAttrPairRelRenderer,
        [KnownRenderers.ERROR]: ErrorRenderer,
        [KnownRenderers.UNSUPPORTED]: UnsupportedRenderer
    }

}