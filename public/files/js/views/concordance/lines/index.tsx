/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { List, pipe } from 'cnc-tskit';

import * as Kontext from '../../../types/kontext';
import * as ViewOptions from '../../../types/viewOptions';
import { init as lineExtrasViewsInit } from '../lineExtras';
import { ConcordanceModel, ConcordanceModelState } from '../../../models/concordance/main';
import { LineSelectionModel, LineSelectionModelState }
    from '../../../models/concordance/lineSelection';
import { ConcDetailModel } from '../../../models/concordance/detail';
import { Actions } from '../../../models/concordance/actions';
import { Actions as MainMenuActions } from '../../../models/mainMenu/actions';
import {
    KWICSection, LineSelectionModes, TextChunk,
    Line as ConcLine,
    ConcToken,
    Token} from '../../../models/concordance/common';
import * as S from './style';
import { PlayerStatus } from '../../../models/concordance/media';
import { SentenceToken } from '../../../types/plugins/syntaxViewer';
import { Actions as KwicRowConnectActions } from '../../../types/plugins/kwicRowConnect';


export interface LinesModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    lineModel:ConcordanceModel;
    lineSelectionModel:LineSelectionModel;
    concDetailModel:ConcDetailModel;
}


export interface LinesViews {
    ConcLines:React.ComponentClass<ConcordanceModelState>;
}

const ATTR_SEPARATOR = '/';


export function init({dispatcher, he, lineModel, lineSelectionModel}:LinesModuleArgs):LinesViews {

    const extras = lineExtrasViewsInit(dispatcher, he, lineModel);

    function getViewModeClass(mode:ViewOptions.AttrViewMode):string {
        switch (mode) {
            case ViewOptions.AttrViewMode.VISIBLE_MULTILINE:
                return 'ml';
            default:
                return '';
        }
    }

    function getViewModeTitle(
        mode:ViewOptions.AttrViewMode,
        isKwic:boolean,
        supportsTokenConnect:boolean,
        tailAttrs:Array<string>
    ):string {

        const tokenConnectInfo1 = supportsTokenConnect ?
            he.translate('concview__click_to_see_external_token_info') : '';
        const tokenConnectInfo2 = supportsTokenConnect ?
            `(${he.translate('concview__click_to_see_external_token_info')})` : '';

        if (mode === ViewOptions.AttrViewMode.MOUSEOVER ||
                mode === ViewOptions.AttrViewMode.VISIBLE_KWIC && !isKwic) {
            return tailAttrs.length > 0 ?
                `${tailAttrs.join(ATTR_SEPARATOR)} ${tokenConnectInfo2}` :
                tokenConnectInfo1;
        }
        return tokenConnectInfo1;
    }


    function renderTokens(data:Array<Token>):JSX.Element {

        const handleMouseover = ({attr, s}:{attr:string; s:string}) => () => {
            dispatcher.dispatch(
                Actions.HighlightedTokenMouseover,
                {
                    attr,
                    value: s
                }
            );
        }

        const handleMouseout = ({attr, s}:{attr:string; s:string}) => () => {
            dispatcher.dispatch(
                Actions.HighlightedTokenMouseout,
                {
                    attr,
                    value: s
                }
            );
        }

        return <>
        {pipe(
            data,
            List.map(({s, h, kcConnection}, i) => h ?
                <em key={i} className="highlight"
                        onMouseOver={handleMouseover(kcConnection)}
                        onMouseOut={handleMouseout(kcConnection)}>
                    {s}
                </em> :
                s
            ),
            List.join<string|JSX.Element>(_ => ' ')
        )}
        </>;
    }

    // ------------------------- <ConcColHideSwitch /> ---------------------------

    const ConcColHideSwitch:React.FC<{
        corpusId:string;
        isVisible:boolean;

    }> = (props) => {

        const handleChange = (_) => {
            dispatcher.dispatch<typeof Actions.ChangeLangVisibility>({
                name: Actions.ChangeLangVisibility.name,
                payload: {
                    corpusId: props.corpusId,
                    value: !props.isVisible
                }
            });
        }

        const title = props.isVisible ?
                he.translate('concview__click_to_hide_the_corpus') :
                he.translate('concview__click_to_show_the_corpus');

        return (
            <input type="checkbox" style={{verticalAlign: 'middle'}}
                title={title} checked={props.isVisible}
                onChange={handleChange} />
        );
    }

    // ------------------------- <ConcColsHeading /> ---------------------------

    const ConcColsHeading:React.FC<{
        corpsWithKwic:Array<string>;
        viewMode:string; // TODO enum
        hideable:boolean;
        cols:Array<{n:string; label:string; visible:boolean}>;

    }> = (props) => {

        const handleSetMainCorpClick = (corpusId) => {
            if (props.corpsWithKwic.indexOf(corpusId) > -1) {
                dispatcher.dispatch<typeof Actions.ChangeMainCorpus>({
                    name: Actions.ChangeMainCorpus.name,
                    payload: {
                        maincorp: corpusId
                    }
                });

            } else {
                dispatcher.dispatch<typeof MainMenuActions.ShowFilter>({
                    name: MainMenuActions.ShowFilter.name,
                    payload: {
                        pnfilter: 'p',
                        within: true,
                        maincorp: corpusId
                    }
                });
            }
        };

        const renderCol = (corpInfo:{n:string; label:string; visible:boolean}) => {
            const colSpan = props.viewMode === 'kwic' ? 3 : 1;

            const htmlClass = corpInfo.visible ? 'concordance-col-heading' : 'concordance-col-heading-hidden';

            return [
                <td key={'ref:' + corpInfo.n}>{/* matches reference column */}</td>,
                <td key={corpInfo.n} className={htmlClass} colSpan={colSpan}>
                    <a className="select-primary-lang" onClick={handleSetMainCorpClick.bind(null, corpInfo.n)}
                                title={corpInfo.visible ? '' : corpInfo.label}>
                        {corpInfo.visible ? corpInfo.label : '\u2026'}
                    </a>
                    {props.hideable || !corpInfo.visible ?
                        <ConcColHideSwitch corpusId={corpInfo.n} isVisible={corpInfo.visible} /> :
                        null}
                </td>
            ];
        };

        return (
            <tr>
                <td>{/* matches line number column */}</td>
                <td>{/* matches selection checkbox column */}</td>
                <td>{/* matches syntax tree column */}</td>
                {props.cols.map(item => renderCol(item))}
            </tr>
        );
    };

    // ------------------------- <Token /> ---------------------------

    const Token:React.FC<{
        tokenId:number;
        data:ConcToken;
        viewMode:ViewOptions.AttrViewMode;
        isKwic:boolean;
        supportsTokenConnect:boolean;

    }> = (props) => {

        const mkClass = () => `${props.supportsTokenConnect ? 'active' : ''} ${props.data.className}`;

        if (props.data.className === 'strc') {
            return (
                <span className="strc">
                    {props.data.description ?
                        <img className="warning"
                             src={he.createStaticUrl('img/warning-icon.svg')}
                             alt={he.translate('global__warning_icon')}
                             title={props.data.description.map(v => he.translate(v)).join('\n')}/> : null}
                    {renderTokens(props.data.text)}
                </span>
            );

        } else if (props.viewMode === ViewOptions.AttrViewMode.MOUSEOVER ||
                props.viewMode === ViewOptions.AttrViewMode.VISIBLE_KWIC && !props.isKwic) {
            const title = props.data.displayPosAttrs.length > 0 ? props.data.displayPosAttrs.join(ATTR_SEPARATOR) : null;
            return (
                <mark data-tokenid={props.tokenId} className={mkClass()} title={title}>
                    {props.data.description ?
                        <img className="warning"
                             src={he.createStaticUrl('img/warning-icon.svg')}
                             alt={he.translate('global__warning_icon')}
                             title={props.data.description.map(v => he.translate(v)).join('\n')}/> : null}
                    {renderTokens(props.data.text)}
                </mark>
            );

        } else {
            return (
                <>
                    <mark data-tokenid={props.tokenId} className={mkClass()}>
                        {props.data.description ?
                            <img className="warning"
                                src={he.createStaticUrl('img/warning-icon.svg')}
                                alt={he.translate('global__warning_icon')}
                                title={props.data.description.map(v => he.translate(v)).join('\n')}/> : null}
                        {renderTokens(props.data.text)}
                    </mark>
                    {props.data.displayPosAttrs.length > 0 ?
                        <span className="tail attr">
                            {props.viewMode !== ViewOptions.AttrViewMode.VISIBLE_MULTILINE ? ATTR_SEPARATOR : ''}
                            {props.data.displayPosAttrs.join(ATTR_SEPARATOR) || '\u00a0'}
                        </span> :
                        null
                    }
                </>
            );
        }
    }


    // ------------------------- <NonKwicText /> ---------------------------

    const NonKwicText:React.FC<{
        position:string;
        kwicTokenNum:number;
        chunkOffset:number;
        idx:number;
        supportsTokenConnect:boolean;
        data:ConcToken;
        attrViewMode:ViewOptions.AttrViewMode;

    }> = (props) => {

        const hasClass = (cls:string) => {
            return props.data.className.indexOf(cls) > -1;
        };

        const mkTokenId = (i:number) => {
            return props.kwicTokenNum + props.chunkOffset + i;
        };

        const title = getViewModeTitle(props.attrViewMode, false, props.supportsTokenConnect, props.data.displayPosAttrs);
        if (props.data.displayPosAttrs.length > 0) {
            if (hasClass('coll') && !hasClass('col0')) {
                return(
                    <em className={`${props.data.className} ${getViewModeClass(props.attrViewMode)}`} title={title}>
                        <Token tokenId={mkTokenId(0)} data={props.data}
                                viewMode={props.attrViewMode} isKwic={false} supportsTokenConnect={props.supportsTokenConnect}
                            />
                    </em>
                );

            } else {
                return (
                    <span className={`${props.data.className} ${getViewModeClass(props.attrViewMode)}`} title={title}>
                        <Token tokenId={mkTokenId(0)} data={props.data}
                                viewMode={props.attrViewMode} isKwic={false} supportsTokenConnect={props.supportsTokenConnect}
                            />
                    </span>
                );
            }

        } else {
            return (<>{
                pipe(
                    props.data.text,
                    List.map(
                        (token) => ({
                            text: [token],
                            className: props.data.className,
                            tailPosAttrs: [],
                            posAttrs: props.data.posAttrs,
                            displayPosAttrs: props.data.displayPosAttrs,
                        })
                    ),
                    List.map(
                        (data, i) => (
                            <React.Fragment key={`${props.position}:${props.idx}:${i}`}>
                                {i > 0 ? ' ' : ''}
                                <span className={getViewModeClass(props.attrViewMode)}>
                                    <Token tokenId={mkTokenId(i)} data={data} viewMode={props.attrViewMode} isKwic={false}
                                            supportsTokenConnect={props.supportsTokenConnect}
                                        />
                                </span>
                            </React.Fragment>
                        )
                    )
                )
            }</>);
        }
    };

    // ------------------------- <TextKwicMode /> ---------------------------

    const TextKwicMode:React.FC<{
        corpname:string;
        isAlignedMainCorp:boolean;
        corpsWithKwic:Array<string>;
        supportsTokenConnect:boolean;
        lineIdx:number;
        output:KWICSection;
        kwicLength:number;
        attrViewMode:ViewOptions.AttrViewMode;
        tokenConnectClickHandler:(corpusId:string, tokenNumber:number, kwicLength:number, lineIdx:number)=>void;
        kwicRowConnectClickHandler?:(corpusId:string, tokenNumber:number, lineIdx:number, tokenLength:number)=>void;
        audioPlayerStatus:PlayerStatus;

    }> = (props) => {

        const hasKwic = props.corpsWithKwic.indexOf(props.corpname) > -1;

        const exportTextElmClass = (corpname:string, ...customClasses:Array<string>) => {
            const ans = customClasses.slice();
            if (props.isAlignedMainCorp) {
                ans.push('maincorp');
            }
            return ans.join(' ');
        };

        const handleTokenClick = (evt) => {
            if (props.supportsTokenConnect || props.kwicRowConnectClickHandler) {
                let tokenId = evt.target.getAttribute('data-tokenid');
                if (tokenId !== null) {
                    tokenId = parseInt(tokenId);
                    if (props.supportsTokenConnect) {
                        props.tokenConnectClickHandler(props.corpname, props.lineIdx, -1, tokenId);
                    }
                    if (props.kwicRowConnectClickHandler) {
                        props.kwicRowConnectClickHandler(props.corpname, tokenId, props.lineIdx, 1);
                    }
                }
            }
        };

        const handleKwicClick = (corpusId, tokenNumber, lineIdx) => {
            props.tokenConnectClickHandler(corpusId, tokenNumber, props.kwicLength, lineIdx);
            if (props.kwicRowConnectClickHandler) {
                props.kwicRowConnectClickHandler(corpusId, tokenNumber, lineIdx, props.kwicLength);
            }
        };

        return <>
            <td className={exportTextElmClass(props.corpname, 'lc')}
                    onClick={handleTokenClick}>
                {List.flatMap(
                    (item, i) => [
                        <LeftChunk key={`lc-${i}`} i={i} itemList={props.output.left} item={item} chunkOffsets={props.output.leftOffsets}
                                    kwicTokenNum={props.output.tokenNumber} lineIdx={props.lineIdx}
                                    supportsTokenConnect={props.supportsTokenConnect}
                                    attrViewMode={props.attrViewMode} audioPlayerStatus={props.audioPlayerStatus}
                            />,
                        ' '
                    ],
                    props.output.left
                )}
            </td>
            <td className={exportTextElmClass(props.corpname, 'kw')}
                    onClick={handleKwicClick.bind(null, props.corpname,
                        props.output.tokenNumber, props.lineIdx)}>
                {List.flatMap(
                    (item, i) => [
                        <KwicChunk key={`kc-${i}`} i={i} item={item} itemList={props.output.kwic}
                                prevBlockClosed={List.get(-1, props.output.left)}
                                hasKwic={hasKwic} lineIdx={props.lineIdx} attrViewMode={props.attrViewMode}
                                supportsTokenConnect={props.supportsTokenConnect}
                                kwicTokenNum={props.output.tokenNumber} audioPlayerStatus={props.audioPlayerStatus}
                            />,
                        ' '
                    ],
                    props.output.kwic
                )}
            </td>
            <td className={exportTextElmClass(props.corpname, 'rc')} onClick={handleTokenClick}>
                <>
                {List.flatMap((item, i) => [
                    ' ',
                    <RightChunk key={`rc-${i}`} item={item} i={i} itemList={props.output.right} chunkOffsets={props.output.rightOffsets}
                            kwicTokenNum={props.output.tokenNumber} prevBlockClosed={List.get(-1, props.output.kwic)}
                            lineIdx={props.lineIdx} supportsTokenConnect={props.supportsTokenConnect}
                            attrViewMode={props.attrViewMode} audioPlayerStatus={props.audioPlayerStatus}
                        />
                ],
                props.output.right)}
                </>
            </td>
        </>
    }

    // ----------------------- <LeftChunk /> -----------------------------------

    const LeftChunk:React.FC<{
        i:number;
        lineIdx:number;
        itemList:Array<TextChunk>;
        item:TextChunk;
        chunkOffsets:Array<number>;
        kwicTokenNum:number;
        supportsTokenConnect:boolean;
        attrViewMode:ViewOptions.AttrViewMode;
        audioPlayerStatus:PlayerStatus;

    }> = (props) => {
        return <>
            {props.i > 0 && props.itemList[props.i - 1].closeLink ?
                <extras.AudioLink t="+" lineIdx={props.lineIdx}
                                chunks={[props.itemList[props.i - 1], props.item]}
                                audioPlayerStatus={props.audioPlayerStatus}/> :
                null
            }
            {props.item.openLink ?
                <extras.AudioLink t="L" lineIdx={props.lineIdx} chunks={[props.item]} audioPlayerStatus={props.audioPlayerStatus}/> :
                null
            }
            <NonKwicText data={props.item} idx={props.i} position="l" chunkOffset={-1 * props.chunkOffsets[props.i]}
                            kwicTokenNum={props.kwicTokenNum} supportsTokenConnect={props.supportsTokenConnect}
                            attrViewMode={props.attrViewMode} />
            {props.item.closeLink ?
                <extras.AudioLink t="R" lineIdx={props.lineIdx} chunks={[props.item]} audioPlayerStatus={props.audioPlayerStatus} /> :
                null
            }
        </>;
    };

    // -------------------------- <KwicChunk /> --------------------

    const KwicChunk:React.FC<{
        i:number;
        kwicTokenNum:number;
        lineIdx:number;
        itemList:Array<TextChunk>;
        item:TextChunk;
        prevBlockClosed:TextChunk;
        hasKwic:boolean;
        attrViewMode:ViewOptions.AttrViewMode;
        supportsTokenConnect:boolean;
        audioPlayerStatus:PlayerStatus;

    }> = (props) => {
        const prevClosed = props.i > 0 ? props.itemList[props.i - 1] : props.prevBlockClosed;

        const renderFirst = () => {
            if (prevClosed && props.item.openLink) {
                return <extras.AudioLink t="+" lineIdx={props.lineIdx}
                                    chunks={[prevClosed, props.item]}
                                    audioPlayerStatus={props.audioPlayerStatus} />;

            } else if (props.i > 0 && props.itemList[props.i - 1].closeLink) {
                return <extras.AudioLink t="+" lineIdx={props.lineIdx}
                                    chunks={[props.itemList[props.i - 1], props.item]}
                                    audioPlayerStatus={props.audioPlayerStatus} />;
            }
            return null;
        }

        const renderSecond = () => {
            if (props.hasKwic) {
                return (
                    <strong className={getViewModeClass(props.attrViewMode)}
                            title={getViewModeTitle(props.attrViewMode, true, props.supportsTokenConnect, props.item.displayPosAttrs)}>
                        <Token tokenId={props.kwicTokenNum} isKwic={true} data={props.item} viewMode={props.attrViewMode}
                                supportsTokenConnect={props.supportsTokenConnect}
                            />
                    </strong>
                );

            } else if (!props.item.text) { // TODO test array length??
                return <span>&lt;--not translated--&gt;</span>

            } else {
                return <span className={props.item.className === 'strc' ? 'strc' : null}>
                    {renderTokens(props.item.text)}
                </span>;
            }
        }

        return <>
            {renderFirst()}
            {renderSecond()}
        </>;
    };

    // -------------------------- <RightChunk /> ---------------------

    const RightChunk:React.FC<{
        i:number;
        itemList:Array<TextChunk>;
        item:TextChunk;
        chunkOffsets:Array<number>;
        kwicTokenNum:number;
        prevBlockClosed:TextChunk;
        lineIdx:number;
        supportsTokenConnect:boolean;
        attrViewMode:ViewOptions.AttrViewMode;
        audioPlayerStatus:PlayerStatus;

    }> = (props) => {

        const prevClosed = props.i > 0 ? props.itemList[props.i - 1] : props.prevBlockClosed;

        const renderFirst = () => {
            if (prevClosed && props.item.openLink) {
                return <extras.AudioLink t="+" lineIdx={props.lineIdx}
                            chunks={[prevClosed, props.item]} audioPlayerStatus={props.audioPlayerStatus} />;

            } else if (props.i > 0 && props.itemList[props.i - 1].closeLink) {
                return <extras.AudioLink t="+" lineIdx={props.lineIdx}
                            chunks={[props.itemList[props.i - 1], props.item]} audioPlayerStatus={props.audioPlayerStatus} />;
            }
            return null;
        };

        return <>
            {renderFirst()}
            {props.item.openLink ?
                <extras.AudioLink t="L" lineIdx={props.lineIdx} chunks={[props.item]} audioPlayerStatus={props.audioPlayerStatus}/> :
                null
            }
            <NonKwicText data={props.item} idx={props.i} position="r" chunkOffset={props.chunkOffsets[props.i]}
                        kwicTokenNum={props.kwicTokenNum} supportsTokenConnect={props.supportsTokenConnect}
                        attrViewMode={props.attrViewMode} />
            {props.item.closeLink ?
                <extras.AudioLink t="R" lineIdx={props.lineIdx} chunks={[props.item]} audioPlayerStatus={props.audioPlayerStatus}/> :
                null
            }
        </>;
    }

    // ------------------------- <Line /> ---------------------------

    class Line extends React.PureComponent<{
        lineIdx:number;
        baseCorpname:string;
        mainCorp:string;
        supportsTokenConnect:boolean;
        corpsWithKwic:Array<string>;
        viewMode:string; // TODO enum
        attrViewMode:ViewOptions.AttrViewMode;
        lineSelMode:LineSelectionModes;
        cols:Array<{n:string; visible:boolean;}>;
        showLineNumbers:boolean;
        supportsSyntaxView:boolean;
        numItemsInLockedGroups:number;
        emptyRefValPlaceholder:string;
        data:ConcLine;
        groupColor:string|undefined;
        groupTextColor:string|undefined;
        audioPlayerStatus:PlayerStatus;
        kwicRowConnectHandler?:(corpusId:string, tokenNumber:number, lineIdx:number, tokenLength:number) => void;
    }> {

        constructor(props) {
            super(props);
            this._detailClickHandler = this._detailClickHandler.bind(this);
            this._refsDetailClickHandler = this._refsDetailClickHandler.bind(this);
        }

        _detailClickHandler(corpusId, tokenNumber, kwicLength, lineIdx) {
            if (this.props.viewMode === 'speech') {
                dispatcher.dispatch<typeof Actions.ShowSpeechDetail>({
                    name: Actions.ShowSpeechDetail.name,
                    payload: {
                        corpusId: corpusId,
                        tokenNumber: tokenNumber,
                        kwicLength: kwicLength,
                        lineIdx: lineIdx
                    }
                });

            } else { // = default and custom modes
                if (kwicLength === -1 && this.props.supportsTokenConnect) { // non kwic search (e.g. aligned language)
                    dispatcher.dispatch<typeof Actions.ShowTokenDetail>({
                        name: Actions.ShowTokenDetail.name,
                        payload: {
                            corpusId: corpusId,
                            tokenNumber: tokenNumber,
                            lineIdx: lineIdx
                        }
                    });

                } else {
                    dispatcher.dispatch<typeof Actions.ShowKwicDetail>({
                        name: Actions.ShowKwicDetail.name,
                        payload: {
                            corpusId: corpusId,
                            tokenNumber: tokenNumber,
                            kwicLength: kwicLength,
                            lineIdx: lineIdx
                        }
                    });
                }
            }
        }

        _exportTextElmClass(corpname, ...customClasses) {
            const ans = customClasses.slice();
            if (corpname === this.props.mainCorp) {
                ans.push('maincorp');
            }
            return ans.join(' ');
        }

        _renderTextParMode(corpname, corpusOutput:KWICSection) {
            const hasKwic = this.props.corpsWithKwic.indexOf(corpname) > -1;
            const handleTokenClick = (evt) => this._handleNonKwicTokenClick(
                corpname, this.props.lineIdx, Number(evt.target.getAttribute('data-tokenid'))
            );

            return (
                <td className={this._exportTextElmClass(corpname, 'par')}>
                    <span onClick={handleTokenClick}>
                        {List.flatMap((item, i) => [
                                <LeftChunk key={`lc-${i}`} i={i} itemList={corpusOutput.left} item={item}
                                        chunkOffsets={corpusOutput.leftOffsets} kwicTokenNum={corpusOutput.tokenNumber}
                                        lineIdx={this.props.lineIdx} supportsTokenConnect={this.props.supportsTokenConnect}
                                        attrViewMode={this.props.attrViewMode} audioPlayerStatus={this.props.audioPlayerStatus}
                                        />,
                                        ' '
                                ], corpusOutput.left)}
                    </span>
                    <span onClick={this._handleKwicClick.bind(this, corpname,
                                    corpusOutput.tokenNumber, this.props.lineIdx)}>
                        {List.flatMap(
                            (item, i) => [
                                <KwicChunk key={`kc-${i}`} i={i} itemList={corpusOutput.kwic} item={item}
                                        prevBlockClosed={List.get(-1, corpusOutput.left)} hasKwic={hasKwic}
                                        lineIdx={this.props.lineIdx}
                                        attrViewMode={this.props.attrViewMode}
                                        supportsTokenConnect={this.props.supportsTokenConnect}
                                        kwicTokenNum={corpusOutput.tokenNumber}
                                        audioPlayerStatus={this.props.audioPlayerStatus}
                                    />,
                                ' '
                            ],
                            corpusOutput.kwic
                        )}
                    </span>
                    <span onClick={handleTokenClick}>
                        {List.flatMap((item, i) => [
                            ' ',
                            <RightChunk key={`rc-${i}`} i={i} item={item} itemList={corpusOutput.right} chunkOffsets={corpusOutput.rightOffsets}
                                    kwicTokenNum={corpusOutput.tokenNumber} prevBlockClosed={List.get(-1, corpusOutput.kwic)}
                                    lineIdx={this.props.lineIdx} supportsTokenConnect={this.props.supportsTokenConnect}
                                    attrViewMode={this.props.attrViewMode} audioPlayerStatus={this.props.audioPlayerStatus}
                                />
                        ], corpusOutput.right)}
                    </span>
                </td>
            );
        }

        _renderText(corpusOutput, corpusIdx) {
            const corpname = this.props.cols[corpusIdx].n;
            if (this.props.viewMode === 'kwic') {
                return <TextKwicMode
                            corpname={corpname}
                            isAlignedMainCorp={this.props.mainCorp === corpname && this.props.cols.length > 1}
                            corpsWithKwic={this.props.corpsWithKwic}
                            supportsTokenConnect={this.props.supportsTokenConnect}
                            lineIdx={this.props.lineIdx}
                            output={corpusOutput}
                            kwicLength={this.props.data.kwicLength}
                            tokenConnectClickHandler={this._detailClickHandler}
                            kwicRowConnectClickHandler={this.props.kwicRowConnectHandler}
                            attrViewMode={this.props.attrViewMode}
                            audioPlayerStatus={this.props.audioPlayerStatus}
                        />;

            } else {
                return this._renderTextParMode(corpname, corpusOutput);
            }
        }

        _renderTextSimple(corpusOutput:KWICSection):string {
            return pipe(
                [...corpusOutput.left, ...corpusOutput.kwic, ...corpusOutput.right],
                List.flatMap(v => v.text),
                List.map(v => v.s),
                x => x.join(' ')
            );
        }

        _handleKwicClick(corpusId, tokenNumber, lineIdx) {
            this._detailClickHandler(corpusId, tokenNumber, this.props.data.kwicLength, lineIdx);
            if (this.props.kwicRowConnectHandler) {
                this.props.kwicRowConnectHandler(corpusId, tokenNumber, lineIdx, this.props.data.kwicLength);
            }
        }

        _handleNonKwicTokenClick(corpusId, lineIdx, tokenNumber) {
            this._detailClickHandler(corpusId, tokenNumber, -1, lineIdx);
            if (this.props.kwicRowConnectHandler) {
                this.props.kwicRowConnectHandler(corpusId, tokenNumber, lineIdx, 1);
            }
        }

        _refsDetailClickHandler(corpusId, tokenNumber, lineIdx) {
            dispatcher.dispatch<typeof Actions.ShowRefDetail>({
                name: Actions.ShowRefDetail.name,
                payload: {
                    corpusId: corpusId,
                    tokenNumber: tokenNumber,
                    lineIdx: lineIdx
                }
            });
        }

        render() {
            const primaryLang = List.head(this.props.data.languages);
            const alignedCorpora = List.tail(this.props.data.languages);
            const htmlClasses = [];
            if (this.props.data.hasFocus) {
                htmlClasses.push('active');
            }
            const sentenceTokens:Array<SentenceToken> = pipe(
                this.props.data.languages,
                List.map(
                    (x, i) => ({

                        corpus: this.props.cols[i].n,
                        tokenId: x.tokenNumber,
                        kwicLength: this.props.data.kwicLength // TODO we have no per-corpus info here
                    })
                )
            );
            return (
                <tr className={htmlClasses.join(' ')}>
                    <td className="line-num">{this.props.showLineNumbers ? this.props.data.lineNumber + 1 : null}</td>
                    <extras.TdLineSelection
                        kwicLength={this.props.data.kwicLength}
                        tokenNumber={primaryLang.tokenNumber}
                        mode={this.props.lineSelMode}
                        lockedGroupId={this.props.numItemsInLockedGroups > 0 ? this.props.data.lineGroup : null}
                        isEditLocked={this.props.numItemsInLockedGroups > 0}
                        groupId={this.props.data.lineGroup}
                        groupColor={this.props.groupColor}
                        groupTextColor={this.props.groupTextColor} />
                    <td className="syntax-tree">
                        {this.props.supportsSyntaxView ?
                            <extras.SyntaxTreeButton sentenceTokens={sentenceTokens} /> :
                            null
                        }
                    </td>
                    <td className="ref">
                        {List.head(this.props.cols).visible ?
                            <extras.RefInfo corpusId={List.head(this.props.cols).n}
                                    tokenNumber={primaryLang.tokenNumber}
                                    lineIdx={this.props.lineIdx}
                                    data={primaryLang.ref}
                                    refsDetailClickHandler={this._refsDetailClickHandler}
                                    emptyRefValPlaceholder={this.props.emptyRefValPlaceholder} /> :
                            null}

                    </td>
                    {List.head(this.props.cols).visible ?
                            this._renderText(primaryLang, 0) :
                            <td title={this._renderTextSimple(primaryLang)}>{'\u2026'}</td>
                    }
                    {alignedCorpora.map((alCorp, i) => {
                        if (this.props.cols[i + 1].visible) {
                            return <React.Fragment key={`al-${i}`}>
                                <td className="ref">
                                <extras.RefInfo corpusId={this.props.cols[i + 1].n}
                                        tokenNumber={alCorp.tokenNumber}
                                        lineIdx={this.props.lineIdx}
                                        data={alCorp.ref}
                                        emptyRefValPlaceholder={this.props.emptyRefValPlaceholder}
                                        refsDetailClickHandler={this._refsDetailClickHandler} />
                                </td>
                                {alCorp.tokenNumber > -1 ? this._renderText(alCorp, i + 1) :
                                    <td className="note">{`// ${he.translate('concview__translat_not_avail')} //`}</td>
                                }
                            </React.Fragment>;

                        } else {
                            return <React.Fragment key={`al-${i}`}>
                                <td className="ref" />
                                <td key="par" title={this._renderTextSimple(alCorp)}>{'\u2026'}</td>
                            </React.Fragment>;
                        }
                    })}
                </tr>
            );
        }
    }

    // --------------------------- <LinesWithSelection /> ------------------------------

    class LinesWithSelection extends React.PureComponent<ConcordanceModelState & LineSelectionModelState> {

        constructor(props) {
            super(props);
            this._kwicRowConnectHandler = this._kwicRowConnectHandler.bind(this);
        }

        componentDidMount() {
            dispatcher.dispatch<typeof Actions.ApplyStoredLineSelections>({
                name: Actions.ApplyStoredLineSelections.name
            });
        }

        _kwicRowConnectHandler(corpusId:string, tokenNumber:number, lineIdx:number, tokenLength:number) {
            const corpIndex = List.findIndex(col => col.n === corpusId, this.props.corporaColumns);
            const kwicNumber = this.props.lines[lineIdx].languages[corpIndex].tokenNumber;

            const left = List.map(token => {
                const attrs = {};
                attrs[this.props.baseViewAttr] = List.map(v => v.s, token.text).join(' ');
                List.forEach((a, i) => {
                    attrs[a[0]] = token.posAttrs[i];
                }, this.props.mergedCtxAttrs.slice(1));
                return attrs;
            }, this.props.lines[lineIdx].languages[corpIndex].left);
            const kwic = List.map(token => {
                const attrs = {};
                attrs[this.props.baseViewAttr] = List.map(v => v.s, token.text).join(' ');
                List.forEach((a, i) => {
                    attrs[a[0]] = token.posAttrs[i];
                }, this.props.mergedAttrs.slice(1));
                return attrs;
            }, this.props.lines[lineIdx].languages[corpIndex].kwic);
            const right = List.map(token => {
                const attrs = {};
                attrs[this.props.baseViewAttr] = List.map(v => v.s, token.text).join(' ');
                List.forEach((a, i) => {
                    attrs[a[0]] = token.posAttrs[i];
                }, this.props.mergedCtxAttrs.slice(1));
                return attrs;
            }, this.props.lines[lineIdx].languages[corpIndex].right);

            dispatcher.dispatch(
                KwicRowConnectActions.FetchInfo,
                {
                    corpusId,
                    tokenIdx: tokenNumber - kwicNumber + left.length,
                    tokenLength: tokenLength,
                    tokens: [...left, ...kwic, ...right],
                },
                undefined
            );
        }

        private findGroupColor(id:number):[string, string]|[undefined, undefined] {
            const groupId = List.find(v => v.id === id, this.props.lineGroupIds);
            return groupId ? [groupId.bgColor, groupId.fgColor] : [undefined, undefined];
        }

        render() {
            if (this.props.forceScroll) {
                window.scrollTo(null, this.props.forceScroll);
            }
            return (<>
                {List.map(
                    (line, i) => {
                        const [bgColor, fgColor] = this.findGroupColor(line.lineGroup);
                        return <Line key={`${i}:${List.head(line.languages).tokenNumber}`}
                            lineIdx={i}
                            data={line}
                            groupColor={bgColor}
                            groupTextColor={fgColor}
                            cols={this.props.corporaColumns}
                            viewMode={this.props.viewMode}
                            attrViewMode={this.props.attrViewMode}
                            baseCorpname={this.props.baseCorpname}
                            mainCorp={this.props.maincorp}
                            corpsWithKwic={this.props.kwicCorps}
                            showLineNumbers={this.props.showLineNumbers}
                            lineSelMode={LineSelectionModel.actualSelection(this.props).mode}
                            numItemsInLockedGroups={this.props.numItemsInLockedGroups}
                            emptyRefValPlaceholder={this.props.emptyRefValPlaceholder}
                            supportsSyntaxView={this.props.supportsSyntaxView}
                            supportsTokenConnect={this.props.supportsTokenConnect}
                            audioPlayerStatus={this.props.audioPlayerStatus}
                            kwicRowConnectHandler={this.props.supportsKwicRowConnect ? this._kwicRowConnectHandler : null}
                        />
                    },
                    this.props.lines
                )}
            </>);
        }
    }

    const BoundLinesWithSelection = BoundWithProps<ConcordanceModelState,
            LineSelectionModelState>(LinesWithSelection, lineSelectionModel);

    // ------------------------- <ConcLines /> ---------------------------

    class ConcLines extends React.PureComponent<ConcordanceModelState> {

        render() {
            const numVisibleCols = List.reduce(
                (prev, c) => prev + (c.visible ? 1 : 0),
                0,
                this.props.corporaColumns
            );
            return (
                <S.ConcLines className={this.props.useSafeFont ? 'safe' : null}>
                    <tbody>
                        {this.props.corporaColumns.length > 1 ?
                            <ConcColsHeading cols={this.props.corporaColumns}
                                    corpsWithKwic={this.props.kwicCorps}
                                    viewMode={this.props.viewMode} hideable={numVisibleCols > 1} />
                            : null
                        }
                        <BoundLinesWithSelection {...this.props} />
                    </tbody>
                </S.ConcLines>
            );
        }
    }

    return {
        ConcLines
    };
}