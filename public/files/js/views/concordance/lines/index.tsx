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
import { IActionDispatcher, BoundWithProps, ExtractPayload } from 'kombo';
import { Color, List, pipe, tuple } from 'cnc-tskit';

import * as Kontext from '../../../types/kontext.js';
import * as ViewOptions from '../../../types/viewOptions.js';
import { init as lineExtrasViewsInit } from '../lineExtras/index.js';
import { ConcordanceModel, ConcordanceModelState } from '../../../models/concordance/main.js';
import { LineSelectionModel, LineSelectionModelState }
    from '../../../models/concordance/lineSelection/index.js';
import { ConcDetailModel } from '../../../models/concordance/detail.js';
import { Actions } from '../../../models/concordance/actions.js';
import { Actions as MainMenuActions } from '../../../models/mainMenu/actions.js';
import {
    KWICSection, LineSelectionModes, TextChunk,
    Line as ConcLine,
    ConcToken,
    Token} from '../../../models/concordance/common.js';
import * as S from './style.js';
import { SentenceToken } from '../../../types/plugins/syntaxViewer.js';
import { Actions as TokensLinkingActions } from '../../../types/plugins/tokensLinking.js';
import { AudioPlayerModel } from '../../../models/audioPlayer/model.js';


export interface LinesModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    lineModel:ConcordanceModel;
    lineSelectionModel:LineSelectionModel;
    concDetailModel:ConcDetailModel;
    audioPlayerModel:AudioPlayerModel;
}


export interface LinesViews {
    ConcLines:React.ComponentClass<ConcordanceModelState>;
}

const ATTR_SEPARATOR = '/';


export function init({dispatcher, he, lineModel, lineSelectionModel, audioPlayerModel}:LinesModuleArgs):LinesViews {

    const extras = lineExtrasViewsInit(dispatcher, he, lineModel, audioPlayerModel);

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


    function renderTokens(token:Token, dehighlightHandler:(tokenId:number) => void):React.JSX.Element {

        const handleMouseover = ({attr, s}:{attr:string; s:string}) => () => {
            dispatcher.dispatch(
                Actions.HighlightedTokenMouseover,
                {
                    attr,
                    value: s
                }
            );
        };

        const handleMouseout = ({attr, s}:{attr:string; s:string}) => () => {
            dispatcher.dispatch(
                Actions.HighlightedTokenMouseout,
                {
                    attr,
                    value: s
                }
            );
        };

        const tunedTextColor = () => Color.color2str(
            Color.textColorFromBg(Color.importColor(1, token.hColor)));

        return <>{
            token.hIsBusy ?
            <em className="busy-highlight">{token.s}</em> :
            token.hColor ?
            <em
                    className="highlight"
                    style={{backgroundColor: token.hColor, color: tunedTextColor()}}
                    onMouseOver={token.kcConnection ? handleMouseover(token.kcConnection) : null}
                    onMouseOut={token.kcConnection ? handleMouseout(token.kcConnection) : null}
                    onClick={() => dehighlightHandler(token.id)}>
                {token.s}
            </em> :
            token.s
        }</>;
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
                {List.map(item => renderCol(item), props.cols)}
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
        dehighlightHandler:(tokenId:number) => void;

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
                    {renderTokens(props.data.token, props.dehighlightHandler)}
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
                    {renderTokens(props.data.token, props.dehighlightHandler)}
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
                        {renderTokens(props.data.token, props.dehighlightHandler)}
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
        idx:number;
        supportsTokenConnect:boolean;
        data:ConcToken;
        attrViewMode:ViewOptions.AttrViewMode;
        dehighlightHandler:(tokenId:number) => void;

    }> = (props) => {

        const hasClass = (cls:string) => {
            return props.data.className.indexOf(cls) > -1;
        };

        const title = getViewModeTitle(props.attrViewMode, false, props.supportsTokenConnect, props.data.displayPosAttrs);
        if (props.data.displayPosAttrs.length > 0) {
            if (hasClass('coll') && !hasClass('col0')) {
                return(
                    <em className={`${props.data.className} ${getViewModeClass(props.attrViewMode)}`} title={title}>
                        <Token tokenId={props.data.token.id} data={props.data}
                                viewMode={props.attrViewMode} isKwic={false} supportsTokenConnect={props.supportsTokenConnect}
                                dehighlightHandler={props.dehighlightHandler}
                            />
                    </em>
                );

            } else {
                return (
                    <span className={`${props.data.className} ${getViewModeClass(props.attrViewMode)}`} title={title}>
                        <Token tokenId={props.data.token.id} data={props.data}
                                viewMode={props.attrViewMode} isKwic={false} supportsTokenConnect={props.supportsTokenConnect}
                                dehighlightHandler={props.dehighlightHandler}
                            />
                    </span>
                );
            }

        } else {
            return <React.Fragment key={`${props.position}:${props.idx}`}>
                <span className={getViewModeClass(props.attrViewMode)}>
                    <Token tokenId={props.data.token.id} data={props.data} viewMode={props.attrViewMode} isKwic={false}
                            supportsTokenConnect={props.supportsTokenConnect}
                            dehighlightHandler={props.dehighlightHandler}
                        />
                </span>
            </React.Fragment>;
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
        tokensLinkingClickHandler?:(corpusId:string, tokenNumber:number, lineIdx:number, tokenLength:number)=>void;
        dehighlightHandler:(tokenId:number)=>void;
        textDirectionRTL:boolean;

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
            if (props.supportsTokenConnect || props.tokensLinkingClickHandler) {
                const tokenId = parseInt(evt.target.getAttribute('data-tokenid'));
                if (!isNaN(tokenId)) {
                    if (props.supportsTokenConnect) {
                        props.tokenConnectClickHandler(
                            props.corpname,
                            tokenId,
                            1,
                            props.lineIdx
                        );
                    }
                    if (props.tokensLinkingClickHandler) {
                        props.tokensLinkingClickHandler(
                            props.corpname,
                            tokenId,
                            props.lineIdx,
                            1
                        );
                    }
                }
            }
        };

        const handleKwicClick = (corpusId, kwicTokenNumber, kwicLength, lineIdx) => (evt) => {
            props.tokenConnectClickHandler(corpusId, kwicTokenNumber, kwicLength, lineIdx);
            if (props.tokensLinkingClickHandler) {
                const tokenid = parseInt(evt.target.getAttribute('data-tokenid'));
                if (!isNaN(tokenid)) {
                    props.tokensLinkingClickHandler(corpusId, tokenid, lineIdx, 1);
                }
            }
        };

        const content = [
            <td key="1" className={exportTextElmClass(props.corpname, props.textDirectionRTL ? 'rc' : 'lc')}
                    onClick={handleTokenClick}>
                {List.flatMap(
                    (item, i) => [
                        <LeftChunk key={`lc-${i}`} i={i} itemList={props.output.left} item={item}
                                    kwicTokenNum={props.output.tokenNumber} lineIdx={props.lineIdx}
                                    supportsTokenConnect={props.supportsTokenConnect}
                                    attrViewMode={props.attrViewMode}
                                    dehighlightHandler={props.dehighlightHandler}
                            />,
                        ' '
                    ],
                    props.output.left
                )}
            </td>,
            <td key="2" className={exportTextElmClass(props.corpname, 'kw')}
                    onClick={handleKwicClick(props.corpname, props.output.tokenNumber, props.kwicLength, props.lineIdx)}>
                {List.flatMap(
                    (item, i) => [
                        <KwicChunk key={`kc-${i}`} i={i} item={item} itemList={props.output.kwic}
                                prevBlockClosed={List.get(-1, props.output.left)}
                                hasKwic={hasKwic} lineIdx={props.lineIdx} attrViewMode={props.attrViewMode}
                                supportsTokenConnect={props.supportsTokenConnect}
                                kwicTokenNum={props.output.tokenNumber}
                                dehighlightHandler={props.dehighlightHandler}
                            />,
                        ' '
                    ],
                    props.output.kwic
                )}
            </td>,
            <td key="3" className={exportTextElmClass(props.corpname, props.textDirectionRTL ? 'lc' : 'rc')} onClick={handleTokenClick}>
                <>
                {List.flatMap((item, i) => [
                    ' ',
                    <RightChunk
                            key={`rc-${i}`}
                            item={item}
                            i={i}
                            itemList={props.output.right}
                            kwicTokenNum={props.output.tokenNumber}
                            prevBlockClosed={List.get(-1, props.output.kwic)}
                            lineIdx={props.lineIdx}
                            supportsTokenConnect={props.supportsTokenConnect}
                            attrViewMode={props.attrViewMode}
                            dehighlightHandler={props.dehighlightHandler}
                        />
                ],
                props.output.right)}
                </>
            </td>,
        ]
        if (props.textDirectionRTL) {
            return <>{content.reverse()}</>;
        }
        return <>{content}</>;
    }

    // ----------------------- <LeftChunk /> -----------------------------------

    const LeftChunk:React.FC<{
        i:number;
        lineIdx:number;
        itemList:Array<TextChunk>;
        item:TextChunk;
        kwicTokenNum:number;
        supportsTokenConnect:boolean;
        attrViewMode:ViewOptions.AttrViewMode;
        dehighlightHandler:(tokenId:number) => void;

    }> = (props) => {
        return <>
            {props.i > 0 && props.itemList[props.i - 1].closeLink ?
                <extras.AudioLink t="+" lineIdx={props.lineIdx}
                                chunks={[props.itemList[props.i - 1], props.item]} /> :
                null
            }
            {props.item.openLink ?
                <extras.AudioLink t="L" lineIdx={props.lineIdx} chunks={[props.item]} /> :
                null
            }
            <NonKwicText data={props.item} idx={props.i} position="l"
                            kwicTokenNum={props.kwicTokenNum} supportsTokenConnect={props.supportsTokenConnect}
                            attrViewMode={props.attrViewMode} dehighlightHandler={props.dehighlightHandler}/>
            {props.item.closeLink ?
                <extras.AudioLink t="R" lineIdx={props.lineIdx} chunks={[props.item]} /> :
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
        dehighlightHandler:(tokenId:number) => void;

    }> = (props) => {
        const prevClosed = props.i > 0 ? props.itemList[props.i - 1] : props.prevBlockClosed;

        const renderFirst = () => {
            if (prevClosed && props.item.openLink) {
                return <extras.AudioLink t="+" lineIdx={props.lineIdx}
                                    chunks={[prevClosed, props.item]} />;

            } else if (props.i > 0 && props.itemList[props.i - 1].closeLink) {
                return <extras.AudioLink t="+" lineIdx={props.lineIdx}
                                    chunks={[props.itemList[props.i - 1], props.item]} />;
            }
            return null;
        }

        const renderSecond = () => {
            if (props.hasKwic) {
                return (
                    <strong className={getViewModeClass(props.attrViewMode)}
                            title={getViewModeTitle(props.attrViewMode, true, props.supportsTokenConnect, props.item.displayPosAttrs)}>
                        <Token tokenId={props.kwicTokenNum + props.i} isKwic={true} data={props.item} viewMode={props.attrViewMode}
                                supportsTokenConnect={props.supportsTokenConnect} dehighlightHandler={props.dehighlightHandler}
                            />
                    </strong>
                );

            } else if (!props.item.token) { // TODO test array length??
                return <span>&lt;--not translated--&gt;</span>

            } else {
                return <span data-tokenid={props.item.className === 'strc' ? null : (props.kwicTokenNum + props.i)} className={props.item.className === 'strc' ? 'strc' : null}>
                    {renderTokens(props.item.token, props.dehighlightHandler)}
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
        kwicTokenNum:number;
        prevBlockClosed:TextChunk;
        lineIdx:number;
        supportsTokenConnect:boolean;
        attrViewMode:ViewOptions.AttrViewMode;
        dehighlightHandler:(tokenId:number) => void;

    }> = (props) => {

        const prevClosed = props.i > 0 ? props.itemList[props.i - 1] : props.prevBlockClosed;

        const renderFirst = () => {
            if (prevClosed && props.item.openLink) {
                return <extras.AudioLink t="+" lineIdx={props.lineIdx}
                            chunks={[prevClosed, props.item]} />;

            } else if (props.i > 0 && props.itemList[props.i - 1].closeLink) {
                return <extras.AudioLink t="+" lineIdx={props.lineIdx}
                            chunks={[props.itemList[props.i - 1], props.item]} />;
            }
            return null;
        };

        return <>
            {renderFirst()}
            {props.item.openLink ?
                <extras.AudioLink t="L" lineIdx={props.lineIdx} chunks={[props.item]} /> :
                null
            }
            <NonKwicText data={props.item} idx={props.i} position="r"
                        kwicTokenNum={props.kwicTokenNum} supportsTokenConnect={props.supportsTokenConnect}
                        attrViewMode={props.attrViewMode} dehighlightHandler={props.dehighlightHandler}/>
            {props.item.closeLink ?
                <extras.AudioLink t="R" lineIdx={props.lineIdx} chunks={[props.item]} /> :
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
        refMaxWidth:number;
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
        tokensLinkingHandler?:(
            corpusId:string,
            tokenNumber:number,
            lineIdx:number,
            tokenLength:number
        ) => void;
        textDirectionRTL:boolean;
    }> {

        constructor(props) {
            super(props);
            this._detailClickHandler = this._detailClickHandler.bind(this);
            this._refsDetailClickHandler = this._refsDetailClickHandler.bind(this);
            this._handleDehighlightClick = this._handleDehighlightClick.bind(this);
        }

        _handleDehighlightClick = (corpusId:string, lineId:number) => (tokenId:number) => {
            dispatcher.dispatch(
                TokensLinkingActions.DehighlightLinksById,
                {corpusId, lineId, tokenId}
            );
        };

        _detailClickHandler(corpusId:string, tokenNumber:number, kwicLength:number, lineIdx:number) {
            if (this.props.viewMode === 'speech') {
                dispatcher.dispatch<typeof Actions.ShowSpeechDetail>({
                    name: Actions.ShowSpeechDetail.name,
                    payload: {
                        corpusId,
                        tokenNumber,
                        kwicLength,
                        lineIdx
                    }
                });

            } else { // = default and custom modes
                if (kwicLength === -1 && this.props.supportsTokenConnect) { // non kwic search (e.g. aligned language)
                    dispatcher.dispatch<typeof Actions.ShowTokenDetail>({
                        name: Actions.ShowTokenDetail.name,
                        payload: {
                            corpusId,
                            tokenNumber,
                            lineIdx
                        }
                    });

                } else if (kwicLength !== -1) { // only when clicking kwic
                    dispatcher.dispatch<typeof Actions.ShowKwicDetail>({
                        name: Actions.ShowKwicDetail.name,
                        payload: {
                            corpusId,
                            tokenNumber,
                            kwicLength,
                            lineIdx
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
            const handleNonKwicTokenClick = (evt) => {
                const tokenid = parseInt(evt.target.getAttribute('data-tokenid'));
                if (!isNaN(tokenid)) {
                    this._handleNonKwicTokenClick(corpname, this.props.lineIdx, tokenid);
                }
            }
            const handleKwicTokenClick = (evt) => {
                const tokenid = parseInt(evt.target.getAttribute('data-tokenid'));
                if (!isNaN(tokenid)) {
                    this._handleKwicClick(corpname, corpusOutput.tokenNumber, this.props.data.kwicLength, this.props.lineIdx, tokenid);
                }
            }

            return (
                <td className={this._exportTextElmClass(corpname, 'par')}>
                    <span onClick={handleNonKwicTokenClick}>
                        {List.flatMap((item, i) => [
                            <LeftChunk key={`lc-${i}`} i={i} itemList={corpusOutput.left} item={item}
                                    kwicTokenNum={corpusOutput.tokenNumber}
                                    lineIdx={this.props.lineIdx} supportsTokenConnect={this.props.supportsTokenConnect}
                                    attrViewMode={this.props.attrViewMode}
                                    dehighlightHandler={this._handleDehighlightClick(corpname, this.props.lineIdx)}
                            />,
                            ' '
                        ], corpusOutput.left)}
                    </span>
                    <span onClick={handleKwicTokenClick}>
                        {List.flatMap((item, i) => [
                            <KwicChunk key={`kc-${i}`} i={i} itemList={corpusOutput.kwic} item={item}
                                    prevBlockClosed={List.get(-1, corpusOutput.left)} hasKwic={hasKwic}
                                    lineIdx={this.props.lineIdx}
                                    attrViewMode={this.props.attrViewMode}
                                    supportsTokenConnect={this.props.supportsTokenConnect}
                                    kwicTokenNum={corpusOutput.tokenNumber}
                                    dehighlightHandler={this._handleDehighlightClick(corpname, this.props.lineIdx)}
                            />,
                            ' '
                        ], corpusOutput.kwic)}
                    </span>
                    <span onClick={handleNonKwicTokenClick}>
                        {List.flatMap((item, i) => [
                            ' ',
                            <RightChunk key={`rc-${i}`} i={i} item={item} itemList={corpusOutput.right}
                                    kwicTokenNum={corpusOutput.tokenNumber} prevBlockClosed={List.get(-1, corpusOutput.kwic)}
                                    lineIdx={this.props.lineIdx} supportsTokenConnect={this.props.supportsTokenConnect}
                                    attrViewMode={this.props.attrViewMode}
                                    dehighlightHandler={this._handleDehighlightClick(corpname, this.props.lineIdx)}
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
                            tokensLinkingClickHandler={this.props.tokensLinkingHandler}
                            attrViewMode={this.props.attrViewMode}
                            dehighlightHandler={this._handleDehighlightClick(corpname, this.props.lineIdx)}
                            textDirectionRTL={this.props.textDirectionRTL}
                        />;

            } else {
                return this._renderTextParMode(corpname, corpusOutput);
            }
        }

        _renderTextSimple(corpusOutput:KWICSection):string {
            return pipe(
                [...corpusOutput.left, ...corpusOutput.kwic, ...corpusOutput.right],
                List.map(v => v.token.s),
                x => x.join(' ')
            );
        }

        _handleKwicClick(corpusId, kwicTokenNumber, kwicLength, lineIdx, clickedTokenNumber) {
            this._detailClickHandler(corpusId, kwicTokenNumber, kwicLength, lineIdx);
            if (this.props.tokensLinkingHandler) {
                this.props.tokensLinkingHandler(corpusId, clickedTokenNumber, lineIdx, 1);
            }
        }

        _handleNonKwicTokenClick(corpusId, lineIdx, tokenNumber) {
            this._detailClickHandler(corpusId, tokenNumber, -1, lineIdx);
            if (this.props.tokensLinkingHandler) {
                this.props.tokensLinkingHandler(corpusId, tokenNumber, lineIdx, 1);
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
                                    refMaxWidth={this.props.refMaxWidth}
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
                                        refMaxWidth={this.props.refMaxWidth}
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

    const LinesWithSelection:React.FC<ConcordanceModelState & LineSelectionModelState> = (props) => {

        React.useEffect(
            () => {
                dispatcher.dispatch<typeof Actions.ApplyStoredLineSelections>({
                    name: Actions.ApplyStoredLineSelections.name
                });
            },
            []
        );

        const tokensLinkingHandler = (
            corpusId:string,
            tokenId:number,
            lineId:number,
            tokenLength:number
        ) => {
            const payload:ExtractPayload<typeof TokensLinkingActions.FetchInfo> = {
                corpusId,
                tokenId,
                tokenLength,
                tokenRanges: {},
                lineId,
                scrollY: window.scrollY
            }
            List.forEach(
                (lang, langId) => {
                    const kwicNumber = lang.tokenNumber;
                    const tokenIdx = tokenId - kwicNumber + lang.left.length;
                    payload.tokenRanges[props.corporaColumns[langId].n] = tuple(
                        tokenId - tokenIdx,
                        tokenId - tokenIdx + List.size(lang.left) + List.size(lang.kwic) + List.size(lang.right)
                    );
                },
                props.lines[lineId].languages
            );
            dispatcher.dispatch(
                TokensLinkingActions.FetchInfo,
                payload
            );
        };

        const findGroupColor = (id:number):[string, string]|[undefined, undefined] => {
            const groupId = List.find(v => v.id === id, props.lineGroupIds);
            return groupId ? [groupId.bgColor, groupId.fgColor] : [undefined, undefined];
        };

        if (props.forceScroll) {
            window.scrollTo(null, props.forceScroll);
        }
        return (<>
            {List.map(
                (line, i) => {
                    const [bgColor, fgColor] = findGroupColor(line.lineGroup);
                    return <Line key={`${i}:${List.head(line.languages).tokenNumber}`}
                        lineIdx={i}
                        data={line}
                        groupColor={bgColor}
                        groupTextColor={fgColor}
                        cols={props.corporaColumns}
                        viewMode={props.viewMode}
                        refMaxWidth={props.refMaxWidth}
                        attrViewMode={props.attrViewMode}
                        baseCorpname={props.baseCorpname}
                        mainCorp={props.maincorp}
                        corpsWithKwic={props.kwicCorps}
                        showLineNumbers={props.showLineNumbers}
                        lineSelMode={LineSelectionModel.actualSelection(props).mode}
                        numItemsInLockedGroups={props.numItemsInLockedGroups}
                        emptyRefValPlaceholder={props.emptyRefValPlaceholder}
                        supportsSyntaxView={props.supportsSyntaxView}
                        supportsTokenConnect={props.supportsTokenConnect}
                        tokensLinkingHandler={props.supportsTokensLinking ? tokensLinkingHandler : null}
                        textDirectionRTL={props.textDirectionRTL}
                    />
                },
                props.lines
            )}
        </>);
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