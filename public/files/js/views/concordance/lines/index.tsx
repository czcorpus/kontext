/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { IActionDispatcher, BoundWithProps, ExtractPayload, useModel } from 'kombo';
import { Color, List, pipe, tuple } from 'cnc-tskit';

import * as Kontext from '../../../types/kontext.js';
import * as ViewOptions from '../../../types/viewOptions.js';
import { init as lineExtrasViewsInit, RefsClickHandler } from '../lineExtras/index.js';
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
import { Line } from 'recharts';


export interface LinesModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    lineModel:ConcordanceModel;
    lineSelectionModel:LineSelectionModel;
    concDetailModel:ConcDetailModel;
    audioPlayerModel:AudioPlayerModel;
}


export interface LinesViews {
    ConcLines:React.FC;
}

const ATTR_SEPARATOR = '/';


interface tokensLinkinkHandler {
    (
        corpusId:string,
        tokenNumber:number,
        lineIdx:number,
        tokenLength:number
    ):void;
}

interface tokenConnectHandler {
    (corpusId:string, tokenNumber:number, kwicLength:number, lineIdx:number):void;
}

interface detailClickHandler {
    (corpusId:string, tokenNumber:number, kwicLength:number, lineIdx:number):void;
}

interface dehighlightClickHandler {
    (corpusId:string, lineId:number, tokenId:number):void;
}



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


    function renderTokens(
        corpname:string,
        lineIdx:number,
        token:Token,
        dehighlightHandler:(corpname:string, lineIdx:number, tokenId:number) => void
    ):React.JSX.Element {

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
                    onClick={() => dehighlightHandler(corpname, lineIdx, token.id)}>
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

        const handleSetMainCorpClick = (maincorp:string) => {
            if (props.corpsWithKwic.indexOf(maincorp) > -1) {
                dispatcher.dispatch<typeof Actions.ChangeMainCorpus>({
                    name: Actions.ChangeMainCorpus.name,
                    payload: {
                        maincorp
                    }
                });

            } else {
                dispatcher.dispatch<typeof Actions.ShowMissingAlignedQueryForm>({
                    name: Actions.ShowMissingAlignedQueryForm.name,
                    payload: {
                        maincorp
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
        corpname:string;
        lineIdx:number;
        tokenId:number;
        data:ConcToken;
        viewMode:ViewOptions.AttrViewMode;
        isKwic:boolean;
        supportsTokenConnect:boolean;
        htmlClasses:Array<string>;
        htmlTitle:string;
        emphasized:boolean;
        dehighlightHandler:(corpname:string, lineIdx:number, tokenId:number) => void;

    }> = (props) => {

        const mkClass = (...custom:Array<string>) => pipe(
            props.htmlClasses,
            List.concat([
                ...custom,
                props.supportsTokenConnect ? 'active' : null,
                props.data.className
            ]),
            List.filter(x => x !== null),
            x => x.join(' ')
        );

        if (props.data.className === 'strc') {
            return (
                <span className={mkClass("strc")}>
                    {props.data.description ?
                        <img className="warning"
                             src={he.createStaticUrl('img/warning-icon.svg')}
                             alt={he.translate('global__warning_icon')}
                             title={props.data.description.map(v => he.translate(v)).join('\n')}/> : null}
                    {renderTokens(props.corpname, props.lineIdx, props.data.token, props.dehighlightHandler)}
                </span>
            );

        } else if (props.viewMode === ViewOptions.AttrViewMode.MOUSEOVER ||
                props.viewMode === ViewOptions.AttrViewMode.VISIBLE_KWIC && !props.isKwic) {
            const title = props.data.displayPosAttrs.length > 0 ? props.data.displayPosAttrs.join(ATTR_SEPARATOR) : null;
            return (
                <span data-tokenid={props.tokenId} className={mkClass()} title={title}>
                    {props.data.description ?
                        <img className="warning"
                             src={he.createStaticUrl('img/warning-icon.svg')}
                             alt={he.translate('global__warning_icon')}
                             title={props.data.description.map(v => he.translate(v)).join('\n')}/> : null}
                    {renderTokens(props.corpname, props.lineIdx, props.data.token, props.dehighlightHandler)}
                </span>
            );

        } else {
            return (
                <>
                    <span data-tokenid={props.tokenId} className={mkClass()}>
                        {props.data.description ?
                            <img className="warning"
                                src={he.createStaticUrl('img/warning-icon.svg')}
                                alt={he.translate('global__warning_icon')}
                                title={props.data.description.map(v => he.translate(v)).join('\n')}/> : null}
                        {renderTokens(props.corpname, props.lineIdx, props.data.token, props.dehighlightHandler)}
                    </span>
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
        corpname:string;
        lineIdx:number;
        position:string;
        kwicTokenNum:number;
        idx:number;
        supportsTokenConnect:boolean;
        data:ConcToken;
        attrViewMode:ViewOptions.AttrViewMode;
        dehighlightHandler:(corpname:string, lineIdx:number, tokenId:number) => void;

    }> = (props) => {

        const hasClass = (cls:string) => {
            return props.data.className.indexOf(cls) > -1;
        };

        const title = getViewModeTitle(props.attrViewMode, false, props.supportsTokenConnect, props.data.displayPosAttrs);
        if (props.data.displayPosAttrs.length > 0) {
            if (hasClass('coll') && !hasClass('col0')) {
                return(
                    <Token
                        corpname={props.corpname}
                        lineIdx={props.lineIdx}
                        tokenId={props.data.token.id}
                        data={props.data}
                        htmlClasses={[props.data.className, getViewModeClass(props.attrViewMode)]}
                        htmlTitle={title}
                        emphasized={true}
                        viewMode={props.attrViewMode} isKwic={false} supportsTokenConnect={props.supportsTokenConnect}
                        dehighlightHandler={props.dehighlightHandler}
                    />
                );

            } else {
                return (
                    <Token
                        corpname={props.corpname}
                        lineIdx={props.lineIdx}
                        tokenId={props.data.token.id}
                        data={props.data}
                        htmlClasses={[props.data.className, getViewModeClass(props.attrViewMode)]}
                        htmlTitle={title}
                        emphasized={false}
                        viewMode={props.attrViewMode}
                        isKwic={false}
                        supportsTokenConnect={props.supportsTokenConnect}
                        dehighlightHandler={props.dehighlightHandler}
                        />
                );
            }

        } else {
            return (
                <React.Fragment key={`${props.position}:${props.idx}`}>
                    <Token
                        corpname={props.corpname}
                        lineIdx={props.lineIdx}
                        tokenId={props.data.token.id}
                        data={props.data}
                        htmlClasses={[getViewModeClass(props.attrViewMode)]}
                        htmlTitle={title}
                        emphasized={false}
                        viewMode={props.attrViewMode}
                        isKwic={false}
                        supportsTokenConnect={props.supportsTokenConnect}
                        dehighlightHandler={props.dehighlightHandler}
                        />
                </React.Fragment>
            );
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
        dehighlightHandler:(corpname:string, lineIdx:number, tokenId:number)=>void;
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
                                    corpname={props.corpname}
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
                                corpname={props.corpname}
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
                            corpname={props.corpname}
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
    };

    // ----------------------- <LeftChunk /> -----------------------------------

    const LeftChunk:React.FC<{
        i:number;
        lineIdx:number;
        corpname:string;
        itemList:Array<TextChunk>;
        item:TextChunk;
        kwicTokenNum:number;
        supportsTokenConnect:boolean;
        attrViewMode:ViewOptions.AttrViewMode;
        dehighlightHandler:(corpname:string, lineIdx:number, tokenId:number) => void;

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
            <NonKwicText
                data={props.item} idx={props.i} position="l"
                corpname={props.corpname}
                lineIdx={props.lineIdx}
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
        corpname:string;
        kwicTokenNum:number;
        lineIdx:number;
        itemList:Array<TextChunk>;
        item:TextChunk;
        prevBlockClosed:TextChunk;
        hasKwic:boolean;
        attrViewMode:ViewOptions.AttrViewMode;
        supportsTokenConnect:boolean;
        dehighlightHandler:(corpname:string, lineIdx:number, tokenId:number) => void;

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
                    <Token
                        corpname={props.corpname}
                        lineIdx={props.lineIdx}
                        tokenId={props.kwicTokenNum + props.i}
                        isKwic={true}
                        data={props.item}
                        htmlClasses={[getViewModeClass(props.attrViewMode)]}
                        htmlTitle={getViewModeTitle(props.attrViewMode, true, props.supportsTokenConnect, props.item.displayPosAttrs)}
                        emphasized={false}
                        viewMode={props.attrViewMode}
                        supportsTokenConnect={props.supportsTokenConnect}
                        dehighlightHandler={props.dehighlightHandler}
                    />
                );

            } else if (!props.item.token) { // TODO test array length??
                return <span>&lt;--not translated--&gt;</span>

            } else {
                return <span data-tokenid={props.item.className === 'strc' ? null : (props.kwicTokenNum + props.i)} className={props.item.className === 'strc' ? 'strc' : null}>
                    {renderTokens(props.corpname, props.lineIdx, props.item.token, props.dehighlightHandler)}
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
        corpname:string;
        itemList:Array<TextChunk>;
        item:TextChunk;
        kwicTokenNum:number;
        prevBlockClosed:TextChunk;
        lineIdx:number;
        supportsTokenConnect:boolean;
        attrViewMode:ViewOptions.AttrViewMode;
        dehighlightHandler:(corpname:string, lineIdx:number, tokenId:number) => void;

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
            <NonKwicText
                corpname={props.corpname}
                lineIdx={props.lineIdx}
                data={props.item} idx={props.i} position="r"
                kwicTokenNum={props.kwicTokenNum} supportsTokenConnect={props.supportsTokenConnect}
                attrViewMode={props.attrViewMode} dehighlightHandler={props.dehighlightHandler}/>
            {props.item.closeLink ?
                <extras.AudioLink t="R" lineIdx={props.lineIdx} chunks={[props.item]} /> :
                null
            }
        </>;
    }

    // ------------------------- <TextParMode /> --------------------

    const TextParMode:React.FC<{
        corpname:string;
        lineIdx:number;
        mainCorp:string;
        corpusOutput:KWICSection;
        attrViewMode:ViewOptions.AttrViewMode;
        kwicLength:number;
        corpsWithKwic:Array<string>;
        supportsTokenConnect:boolean;
        detailClickHandler:detailClickHandler;
        tokensLinkingHandler:tokensLinkinkHandler;
        dehighlightClickHandler:dehighlightClickHandler;

    }> = (props) => {

        const hasKwic = props.corpsWithKwic.indexOf(props.corpname) > -1;

        const _exportTextElmClass = (corpname, ...customClasses) => {
            const ans = customClasses.slice();
            if (corpname === props.mainCorp) {
                ans.push('maincorp');
            }
            return ans.join(' ');
        };

        const _handleKwicClick = (corpusId, kwicTokenNumber, kwicLength, lineIdx, clickedTokenNumber) => {
            props.detailClickHandler(corpusId, kwicTokenNumber, kwicLength, lineIdx);
            if (props.tokensLinkingHandler) {
                props.tokensLinkingHandler(corpusId, clickedTokenNumber, lineIdx, 1);
            }
        };

        const _handleNonKwicTokenClick = (corpusId, lineIdx, tokenNumber) => {
            props.detailClickHandler(corpusId, tokenNumber, -1, lineIdx);
            if (props.tokensLinkingHandler) {
                props.tokensLinkingHandler(corpusId, tokenNumber, lineIdx, 1);
            }
        };

        const handleNonKwicTokenClick = (evt) => {
            const tokenid = parseInt(evt.target.getAttribute('data-tokenid'));
            if (!isNaN(tokenid)) {
                _handleNonKwicTokenClick(props.corpname, props.lineIdx, tokenid);
            }
        }
        const handleKwicTokenClick = (evt) => {
            const tokenid = parseInt(evt.target.getAttribute('data-tokenid'));
            if (!isNaN(tokenid)) {
                _handleKwicClick(props.corpname, props.corpusOutput.tokenNumber, props.kwicLength, props.lineIdx, tokenid);
            }
        }

        return (
            <td className={_exportTextElmClass(props.corpname, 'par')}>
                <span onClick={handleNonKwicTokenClick}>
                    {List.flatMap((item, i) => [
                        <LeftChunk key={`lc-${i}`} i={i} itemList={props.corpusOutput.left} item={item}
                                kwicTokenNum={props.corpusOutput.tokenNumber}
                                lineIdx={props.lineIdx} supportsTokenConnect={props.supportsTokenConnect}
                                attrViewMode={props.attrViewMode}
                                corpname={props.corpname}
                                dehighlightHandler={props.dehighlightClickHandler}
                        />,
                        ' '
                    ], props.corpusOutput.left)}
                </span>
                <span onClick={handleKwicTokenClick}>
                    {List.flatMap((item, i) => [
                        <KwicChunk key={`kc-${i}`} i={i} itemList={props.corpusOutput.kwic} item={item}
                                corpname={props.corpname}
                                prevBlockClosed={List.get(-1, props.corpusOutput.left)} hasKwic={hasKwic}
                                lineIdx={props.lineIdx}
                                attrViewMode={props.attrViewMode}
                                supportsTokenConnect={props.supportsTokenConnect}
                                kwicTokenNum={props.corpusOutput.tokenNumber}
                                dehighlightHandler={props.dehighlightClickHandler}
                        />,
                        ' '
                    ], props.corpusOutput.kwic)}
                </span>
                <span onClick={handleNonKwicTokenClick}>
                    {List.flatMap((item, i) => [
                        ' ',
                        <RightChunk key={`rc-${i}`} i={i} item={item} itemList={props.corpusOutput.right}
                                corpname={props.corpname}
                                kwicTokenNum={props.corpusOutput.tokenNumber} prevBlockClosed={List.get(-1, props.corpusOutput.kwic)}
                                lineIdx={props.lineIdx} supportsTokenConnect={props.supportsTokenConnect}
                                attrViewMode={props.attrViewMode}
                                dehighlightHandler={props.dehighlightClickHandler}
                        />
                    ], props.corpusOutput.right)}
                </span>
            </td>
        );
    }

    // ------------------------- <LineText /> -----------------------

    const _LineText:React.FC<{
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
        fixedAuxColums:boolean;
        supportsSyntaxView:boolean;
        numItemsInLockedGroups:number;
        emptyRefValPlaceholder:string;
        data:ConcLine;
        groupColor:string|undefined;
        groupTextColor:string|undefined;
        textDirectionRTL:boolean;
        tokensLinkingHandler?:tokensLinkinkHandler;
        refsDetailClickHandler:RefsClickHandler;
    }> = (props) => {

        const _handleDehighlightClick:dehighlightClickHandler = (corpusId, lineId, tokenId) => {
            dispatcher.dispatch(
                TokensLinkingActions.DehighlightLinksById,
                {corpusId, lineId, tokenId}
            );
        };

        const _detailClickHandler:detailClickHandler = (corpusId, tokenNumber, kwicLength, lineIdx) => {
            if (props.viewMode === 'speech') {
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
                if (kwicLength === -1 && props.supportsTokenConnect) { // non kwic search (e.g. aligned language)
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
        };

        const primaryLang = List.head(props.data.languages);
        const alignedCorpora = List.tail(props.data.languages);

        const _renderText = (corpusOutput:KWICSection, corpusIdx:number) => {
            const corpname = props.cols[corpusIdx].n;
            return props.viewMode === 'kwic' ?
                <TextKwicMode
                    corpname={corpname}
                    lineIdx={props.lineIdx}
                    isAlignedMainCorp={props.mainCorp === corpname && props.cols.length > 1}
                    corpsWithKwic={props.corpsWithKwic}
                    supportsTokenConnect={props.supportsTokenConnect}
                    output={corpusOutput}
                    kwicLength={props.data.kwicLength}
                    tokenConnectClickHandler={_detailClickHandler}
                    tokensLinkingClickHandler={props.tokensLinkingHandler}
                    attrViewMode={props.attrViewMode}
                    dehighlightHandler={_handleDehighlightClick}
                    textDirectionRTL={props.textDirectionRTL}
                /> :
                <TextParMode
                    corpname={corpname}
                    lineIdx={props.lineIdx}
                    mainCorp={props.mainCorp}
                    corpusOutput={corpusOutput}
                    attrViewMode={props.attrViewMode}
                    kwicLength={props.data.kwicLength}
                    corpsWithKwic={props.corpsWithKwic}
                    supportsTokenConnect={props.supportsTokenConnect}
                    detailClickHandler={_detailClickHandler}
                    tokensLinkingHandler={props.tokensLinkingHandler}
                    dehighlightClickHandler={_handleDehighlightClick}
                />;
        }

        const _renderTextSimple = (corpusOutput:KWICSection):string => {
            return pipe(
                [...corpusOutput.left, ...corpusOutput.kwic, ...corpusOutput.right],
                List.map(v => v.token.s),
                x => x.join(' ')
            );
        }

        return <>
            {List.head(props.cols).visible ?
                    _renderText(primaryLang, 0) :
                    <td title={_renderTextSimple(primaryLang)}>{'\u2026'}</td>
            }
            {List.map(
                (alCorp, i) => {
                    return props.cols[i + 1].visible ?
                            <React.Fragment key={`al-${i}`}>
                            <td className="ref">
                            <extras.RefInfo corpusId={props.cols[i + 1].n}
                                    tokenNumber={alCorp.tokenNumber}
                                    lineIdx={props.lineIdx}
                                    data={alCorp.ref}
                                    refMaxWidth={props.refMaxWidth}
                                    emptyRefValPlaceholder={props.emptyRefValPlaceholder}
                                    refsDetailClickHandler={props.refsDetailClickHandler} />
                            </td>
                            {alCorp.tokenNumber > -1 ? _renderText(alCorp, i + 1) :
                                <td className="note">{`// ${he.translate('concview__translat_not_avail')} //`}</td>
                            }
                        </React.Fragment> :
                        <React.Fragment key={`al-${i}`}>
                            <td className="ref" />
                            <td key="par" title={_renderTextSimple(alCorp)}>{'\u2026'}</td>
                        </React.Fragment>;
                },
                alignedCorpora
            )}
        </>;
    };

    const LineText = React.memo(_LineText);

    // ------------------------- <Line /> ---------------------------

    const _Line:React.FC<{
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
        fixedAuxColums:boolean;
        supportsSyntaxView:boolean;
        numItemsInLockedGroups:number;
        emptyRefValPlaceholder:string;
        data:ConcLine;
        groupColor:string|undefined;
        groupTextColor:string|undefined;
        tokensLinkingHandler?:tokensLinkinkHandler;
        textDirectionRTL:boolean;
    }> = (props) => {

        const _refsDetailClickHandler:RefsClickHandler = React.useCallback((corpusId, lineIdx, tokenNumber) => {
            dispatcher.dispatch<typeof Actions.ShowRefDetail>({
                name: Actions.ShowRefDetail.name,
                payload: {
                    corpusId: corpusId,
                    tokenNumber: tokenNumber,
                    lineIdx: lineIdx
                }
            });
        }, []);

        const primaryLang = List.head(props.data.languages);
        const htmlClasses = [];
        if (props.data.hasFocus) {
            htmlClasses.push('active');
        }
        const sentenceTokens:Array<SentenceToken> = pipe(
            props.data.languages,
            List.map(
                (x, i) => ({

                    corpus: props.cols[i].n,
                    tokenId: x.tokenNumber,
                    kwicLength: props.data.kwicLength // TODO we have no per-corpus info here
                })
            )
        );

        return (
            <S.LineTR className={htmlClasses.join(' ')}>
                <td className={`aux-columns ${props.fixedAuxColums ? 'sticky': ''} ${props.refMaxWidth > 0 ? '' : 'shrinked'}`}>
                    <div className="wrapper">
                        {props.refMaxWidth > 0 ?
                            <>
                                <span className="line-num">
                                    {props.showLineNumbers ? props.data.lineNumber + 1 : null}
                                </span>
                                <extras.TdLineSelection
                                    kwicLength={props.data.kwicLength}
                                    tokenNumber={primaryLang.tokenNumber}
                                    mode={props.lineSelMode}
                                    lockedGroupId={props.numItemsInLockedGroups > 0 ? props.data.lineGroup : null}
                                    isEditLocked={props.numItemsInLockedGroups > 0}
                                    groupId={props.data.lineGroup}
                                    groupColor={props.groupColor}
                                    groupTextColor={props.groupTextColor} />
                                <span className="syntax-tree">
                                    {props.supportsSyntaxView ?
                                        <extras.SyntaxTreeButton sentenceTokens={sentenceTokens} /> :
                                        null
                                    }
                                </span>
                                <span className="ref">
                                    {List.head(props.cols).visible ?
                                        <extras.RefInfo corpusId={List.head(props.cols).n}
                                                tokenNumber={primaryLang.tokenNumber}
                                                lineIdx={props.lineIdx}
                                                data={primaryLang.ref}
                                                refMaxWidth={props.refMaxWidth}
                                                refsDetailClickHandler={_refsDetailClickHandler}
                                                emptyRefValPlaceholder={props.emptyRefValPlaceholder} /> :
                                        null}

                                </span>
                            </> :
                            <span className="line-num">
                                {props.showLineNumbers ? props.data.lineNumber + 1 : null}
                            </span>
                            }
                    </div>
                </td>
                <LineText
                    lineIdx={props.lineIdx}
                    baseCorpname={props.baseCorpname}
                    mainCorp={props.mainCorp}
                    supportsTokenConnect={props.supportsTokenConnect}
                    corpsWithKwic={props.corpsWithKwic}
                    viewMode={props.viewMode}
                    refMaxWidth={props.refMaxWidth}
                    attrViewMode={props.attrViewMode}
                    lineSelMode={props.lineSelMode}
                    cols={props.cols}
                    showLineNumbers={props.showLineNumbers}
                    fixedAuxColums={props.fixedAuxColums}
                    supportsSyntaxView={props.supportsSyntaxView}
                    numItemsInLockedGroups={props.numItemsInLockedGroups}
                    emptyRefValPlaceholder={props.emptyRefValPlaceholder}
                    data={props.data}
                    groupColor={props.groupColor}
                    groupTextColor={props.groupTextColor}
                    textDirectionRTL={props.textDirectionRTL}
                    tokensLinkingHandler={props.tokensLinkingHandler}
                    refsDetailClickHandler={_refsDetailClickHandler}
                />
            </S.LineTR>
        );
    };

    const Line = React.memo(_Line);

    // --------------------------- <LinesWithSelection /> ------------------------------

    const LinesWithSelection:React.FC = (props) => {

        const state = useModel(lineModel);

        const lselState = useModel(lineSelectionModel);

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
                    payload.tokenRanges[state.corporaColumns[langId].n] = tuple(
                        tokenId - tokenIdx,
                        tokenId - tokenIdx + List.size(lang.left) + List.size(lang.kwic) + List.size(lang.right)
                    );
                },
                state.lines[lineId].languages
            );
            dispatcher.dispatch(
                TokensLinkingActions.FetchInfo,
                payload
            );
        };

        const findGroupColor = (id:number):[string, string]|[undefined, undefined] => {
            const groupId = List.find(v => v.id === id, state.lineGroupIds);
            return groupId ? [groupId.bgColor, groupId.fgColor] : [undefined, undefined];
        };

        if (state.forceScroll) {
            window.scrollTo(null, state.forceScroll);
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
                        cols={state.corporaColumns}
                        viewMode={state.viewMode}
                        refMaxWidth={state.refMaxWidth}
                        attrViewMode={state.attrViewMode}
                        baseCorpname={state.baseCorpname}
                        mainCorp={state.maincorp}
                        corpsWithKwic={state.kwicCorps}
                        showLineNumbers={state.showLineNumbers}
                        lineSelMode={LineSelectionModel.actualSelection(lselState).mode}
                        numItemsInLockedGroups={state.numItemsInLockedGroups}
                        emptyRefValPlaceholder={state.emptyRefValPlaceholder}
                        supportsSyntaxView={state.supportsSyntaxView}
                        supportsTokenConnect={state.supportsTokenConnect}
                        tokensLinkingHandler={state.supportsTokensLinking ? tokensLinkingHandler : null}
                        textDirectionRTL={state.textDirectionRTL}
                        fixedAuxColums={state.fixedAuxColums}
                    />
                },
                state.lines
            )}
        </>);
    }

    // ------------------------- <ConcLines /> ---------------------------

    const ConcLines:React.FC = () => {

        const state = useModel(lineModel);

        const numVisibleCols = List.reduce(
            (prev, c) => prev + (c.visible ? 1 : 0),
            0,
            state.corporaColumns
        );
        return (
            <S.ConcLines className={state.useSafeFont ? 'safe' : null}>
                <tbody>
                    {state.corporaColumns.length > 1 ?
                        <ConcColsHeading cols={state.corporaColumns}
                                corpsWithKwic={state.kwicCorps}
                                viewMode={state.viewMode} hideable={numVisibleCols > 1} />
                        : null
                    }
                    <LinesWithSelection />
                </tbody>
            </S.ConcLines>
        );
    }

    return {
        ConcLines
    };
}