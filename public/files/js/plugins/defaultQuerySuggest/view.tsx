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
import { CncExtendedSublemmaFrontendClickHandler, KnownRenderers, PosAttrPairRelFrontendClickHanlder } from './frontends';


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
    attrs:[string, string, string];
    data:{[attr1:string]:Array<string>};
    value:string;
    isShortened:boolean;
    itemClickHandler:PosAttrPairRelFrontendClickHanlder;
}


export interface CncExtendedSublemmaRendererProps {
    attrs:[string, string, string];
    data:{[attr1:string]:{
        found_in:Array<'lemma'|'sublemma'|'word'>;
        sublemmas:Array<string>;
    }};
    value:string;
    isShortened:boolean;
    itemClickHandler:CncExtendedSublemmaFrontendClickHandler;
}


export interface SuggestionsViews {
    [KnownRenderers.BASIC]:React.FC<BasicRendererProps>;
    [KnownRenderers.ERROR]:React.FC<ErrorRendererProps>;
    [KnownRenderers.UNSUPPORTED]:React.FC<UnsupportedRendererProps>;
    [KnownRenderers.POS_ATTR_PAIR_REL]:React.FC<PosAttrPairRelRendererProps>;
    [KnownRenderers.CNC_EXTENDED_SUBLEMMA]:React.FC<CncExtendedSublemmaRendererProps>;
}


export function init(
    dispatcher:IActionDispatcher,
    model:Model,
    he:Kontext.ComponentHelpers
):SuggestionsViews {

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
                                            <a onClick={e => props.itemClickHandler({
                                                attr1: props.attrs[0], attr1Val: attr1,
                                                attr2: props.attrs[1], attr2Val: undefined,
                                                renderer: KnownRenderers.POS_ATTR_PAIR_REL})}>{attr1}</a> :
                                            attr1
                                        }</th>
                                        <td>{
                                            props.itemClickHandler ?
                                            <a onClick={e => props.itemClickHandler({
                                                attr1: props.attrs[0], attr1Val: attr1,
                                                attr2: props.attrs[1], attr2Val: List.head(attrs2),
                                                renderer: KnownRenderers.POS_ATTR_PAIR_REL})}>{List.head(attrs2)}</a> :
                                            <span>{List.head(attrs2)}</span>
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
                                                        <a onClick={e => props.itemClickHandler({
                                                            attr1: props.attrs[0], attr1Val: attr1,
                                                            attr2: props.attrs[1], attr2Val: attr2,
                                                            renderer: KnownRenderers.POS_ATTR_PAIR_REL})}>{attr2}</a> :
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


// ------------- <CncExtendedSublemmaRenderer /> ----------------------

const CncExtendedSublemmaRenderer:React.FC<CncExtendedSublemmaRendererProps> = (props) => {
    const hasSomeWordMatch = pipe(
        props.data,
        Dict.values(),
        List.flatMap(v => v.found_in),
        List.filter(v => v === 'word'),
        List.size()
    ) > 0;

    return <div className="CncExtendedSublemmaRenderer">
        <table>
            <thead>
                <tr>
                    <th>{props.attrs[0]}</th>
                    <th>{props.attrs[1]}</th>
                    {hasSomeWordMatch ?
                        <th>{props.attrs[2] ? props.attrs[2] : '??'}</th> :
                        <th />}
                </tr>
            </thead>
            <tbody>
            {pipe(
                props.data,
                Dict.toEntries(),
                List.sortedAlphaBy(([k,]) => k),
                List.map(
                    ([attr1, data], index) => (
                        List.empty(data.sublemmas) ?
                            null :
                            <React.Fragment key={`${attr1}`}>
                                <tr className={index > 0 ? 'separ' : null}>
                                    <th className="attr1" rowSpan={List.size(data.sublemmas)}>{
                                        props.itemClickHandler ?
                                        <a onClick={e => props.itemClickHandler({
                                            attr1: props.attrs[0], attr1Val: attr1,
                                            attr2: props.attrs[1], attr2Val: undefined,
                                            attr3: undefined, attr3Val: undefined,
                                            renderer: KnownRenderers.CNC_EXTENDED_SUBLEMMA})}>{attr1}</a> :
                                        attr1
                                    }</th>
                                    <td>{
                                        props.itemClickHandler ?
                                        <a onClick={e => props.itemClickHandler({
                                            attr1: props.attrs[0], attr1Val: attr1,
                                            attr2: props.attrs[1], attr2Val: List.head(data.sublemmas),
                                            attr3: undefined, attr3Val: undefined,
                                            renderer: KnownRenderers.CNC_EXTENDED_SUBLEMMA})}>{List.head(data.sublemmas)}</a> :
                                        <span>{List.head(data.sublemmas)}</span>
                                    }</td>
                                    {List.find(v => v === 'word', data.found_in) ?
                                        <td className="attr3" rowSpan={List.size(data.sublemmas)}>
                                            {props.itemClickHandler ?
                                                <a onClick={e => props.itemClickHandler({
                                                    attr1: props.attrs[0], attr1Val: attr1,
                                                    attr2: props.attrs[1], attr2Val: List.head(data.sublemmas),
                                                    attr3: props.attrs[2], attr3Val: props.value,
                                                    renderer: KnownRenderers.CNC_EXTENDED_SUBLEMMA})}>{props.value}</a> :
                                                <span>{props.value}</span>
                                            }
                                        </td> :
                                        hasSomeWordMatch ? <td className="attr3" /> : null
                                    }
                                </tr>
                                {pipe(
                                    data.sublemmas,
                                    List.tail(),
                                    List.map(
                                        (attr2, i) => (
                                            <tr key={`${attr1}:${attr2}`}>
                                            <td>
                                                {attr2 === null && i === List.size(data.sublemmas) - 2 ?
                                                <span title={he.translate('global__shortened')}>{'\u2026'}</span> :
                                                (props.itemClickHandler ?
                                                    <a onClick={e => props.itemClickHandler({
                                                        attr1: props.attrs[0], attr1Val: attr1,
                                                        attr2: props.attrs[1], attr2Val: attr2,
                                                        attr3: undefined, attr3Val: undefined,
                                                        renderer: KnownRenderers.CNC_EXTENDED_SUBLEMMA})}>{attr2}</a> :
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
        [KnownRenderers.CNC_EXTENDED_SUBLEMMA]:CncExtendedSublemmaRenderer,
        [KnownRenderers.ERROR]: ErrorRenderer,
        [KnownRenderers.UNSUPPORTED]: UnsupportedRenderer
    }

}