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
import * as Immutable from 'immutable';
import { IActionDispatcher } from 'kombo';
import { Kontext, ViewOptions } from '../../types/common';
import { calcTextColorFromBg, color2str, importColor } from '../../multidict';
import { init as lineExtrasViewsInit } from './lineExtras';
import { ConcLineModel, CorpColumn } from '../../models/concordance/lines';
import { LineSelectionModel } from '../../models/concordance/lineSelection';
import { ConcDetailModel } from '../../models/concordance/detail';
import { LineSelValue } from '../../models/concordance/lineSelection';
import { KWICSection } from '../../models/concordance/line';
import { Line, TextChunk, ConcToken } from '../../types/concordance';
import { Subscription } from 'rxjs';


export interface LinesModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    lineModel:ConcLineModel;
    lineSelectionModel:LineSelectionModel;
    concDetailModel:ConcDetailModel;
}


export interface ConcLinesProps {
    baseCorpname:string;
    mainCorp:string;
    supportsSyntaxView:boolean;
    catColors:Array<string>;
    KWICCorps:Array<string>;
    tokenConnectClickHandler:(corpusId:string, tokenNumber:number, kwicLength:number, lineIdx:number)=>void;
    onSyntaxViewClick:(tokenNum:number, kwicLength:number)=>void;
    refsDetailClickHandler:(corpusId:string, tokenNumber:number, lineIdx:number)=>void;
    onReady:()=>void;
}


interface ConcLinesState {
    lines:Immutable.List<Line>;
    lineSelData:Immutable.Map<string, LineSelValue>;
    lineSelMode:string;
    numItemsInLockedGroups:number;
    useSafeFont:boolean;
    emptyRefValPlaceholder:string;
    corporaColumns:Immutable.List<CorpColumn>;
    viewMode:string;
    attrViewMode:ViewOptions.AttrViewMode;
    supportsTokenConnect:boolean;
    showLineNumbers:boolean;
}


export interface LinesViews {
    ConcLines:React.ComponentClass<ConcLinesProps>;
}

const ATTR_SEPARATOR = '/';


export function init({dispatcher, he, lineModel, lineSelectionModel,
                concDetailModel}:LinesModuleArgs):LinesViews {

    const extras = lineExtrasViewsInit(dispatcher, he, lineModel);

    function getViewModeClass(mode:ViewOptions.AttrViewMode):string {
        switch (mode) {
            case ViewOptions.AttrViewMode.VISIBLE_MULTILINE:
                return 'ml';
            default:
                return '';
        }
    }

    function getViewModeTitle(mode:ViewOptions.AttrViewMode, isKwic:boolean, supportsTokenConnect:boolean, tailAttrs:Array<string>):string {
        const tokenConnectInfo1 = supportsTokenConnect ?
            he.translate('concview__click_to_see_external_token_info') : '';
        const tokenConnectInfo2 = supportsTokenConnect ?
            `(${he.translate('concview__click_to_see_external_token_info')})` : '';

        if (mode === ViewOptions.AttrViewMode.MOUSEOVER ||
                mode === ViewOptions.AttrViewMode.VISIBLE_KWIC && !isKwic) {
            return tailAttrs.length > 0 ? `${tailAttrs.join(ATTR_SEPARATOR)} ${tokenConnectInfo2}` : tokenConnectInfo1;
        }
        return tokenConnectInfo1;
    }

    // ------------------------- <ConcColHideSwitch /> ---------------------------

    const ConcColHideSwitch:React.SFC<{
        corpusId:string;
        isVisible:boolean;

    }> = (props) => {

        const handleChange = (_) => {
            dispatcher.dispatch({
                name: 'CONCORDANCE_CHANGE_LANG_VISIBILITY',
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

    const ConcColsHeading:React.SFC<{
        corpsWithKwic:Array<string>;
        viewMode:string; // TODO enum
        hideable:boolean;
        cols:Immutable.List<{n:string; label:string; visible:boolean}>;

    }> = (props) => {

        const handleSetMainCorpClick = (corpusId) => {
            if (props.corpsWithKwic.indexOf(corpusId) > -1) {
                dispatcher.dispatch({
                    name: 'CONCORDANCE_CHANGE_MAIN_CORPUS',
                    payload: {
                        maincorp: corpusId
                    }
                });

            } else {
                dispatcher.dispatch({
                    name: 'MAIN_MENU_SHOW_FILTER',
                    payload: {
                        within: 1,
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

    const Token:React.SFC<{
        tokenId:number;
        data:ConcToken;
        viewMode:ViewOptions.AttrViewMode;
        isKwic:boolean;
        supportsTokenConnect:boolean;

    }> = (props) => {

        const mkClass = () => `${props.supportsTokenConnect ? 'active' : ''} ${props.data.className}`;

        if (props.data.className === 'strc') {
            return <span className="strc">{props.data.text.join(' ')}</span>

        } else if (props.viewMode === ViewOptions.AttrViewMode.MOUSEOVER ||
                props.viewMode === ViewOptions.AttrViewMode.VISIBLE_KWIC && !props.isKwic) {
            const title = props.data.tailPosAttrs.length > 0 ? props.data.tailPosAttrs.join(ATTR_SEPARATOR) : null;
            return <mark data-tokenid={props.tokenId} className={mkClass()} title={title}>{props.data.text.join(' ')}</mark>;

        } else {
            return (
                <>
                    <mark data-tokenid={props.tokenId} className={mkClass()}>
                        {props.data.text.join(' ')}
                    </mark>
                    {props.data.tailPosAttrs.length > 0 ?
                        <span className="tail attr" style={props.viewMode === ViewOptions.AttrViewMode.VISIBLE_MULTILINE && props.data.tailPosAttrs.length === 0 ? {display: 'none'} : null}>
                            {props.viewMode !== ViewOptions.AttrViewMode.VISIBLE_MULTILINE ? ATTR_SEPARATOR : ''}
                            {props.data.tailPosAttrs.join(ATTR_SEPARATOR) || '\u00a0'}
                        </span> :
                        null
                    }
                </>
            );
        }
    }


    // ------------------------- <NonKwicText /> ---------------------------

    const NonKwicText:React.SFC<{
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

        const title = getViewModeTitle(props.attrViewMode, false, props.supportsTokenConnect, props.data.tailPosAttrs || []);

        if (props.data.tailPosAttrs.length > 0) {
            if (hasClass('coll') && !hasClass('col0')) {
                return(
                    <em className={`${props.data.className} ${getViewModeClass(props.attrViewMode)}`} title={title}>
                        <Token tokenId={props.kwicTokenNum + props.chunkOffset} data={props.data}
                                viewMode={props.attrViewMode} isKwic={false} supportsTokenConnect={props.supportsTokenConnect} />
                    </em>
                );

            } else {
                return (
                    <span className={`${props.data.className} ${getViewModeClass(props.attrViewMode)}`} title={title}>
                        <Token tokenId={props.kwicTokenNum + props.chunkOffset} data={props.data}
                                viewMode={props.attrViewMode} isKwic={false} supportsTokenConnect={props.supportsTokenConnect} />
                    </span>
                );
            }

        } else {
            return (
            <>
                {props.data.text.map((s) => ({text: [s], className: props.data.className, tailPosAttrs: []})).map((data, i) => (
                    <React.Fragment key={`${props.position}:${props.idx}:${i}`}>
                        {i > 0 ? ' ' : ''}
                        <span className={getViewModeClass(props.attrViewMode)}>
                            <Token tokenId={mkTokenId(i)} data={data} viewMode={props.attrViewMode} isKwic={false}
                                    supportsTokenConnect={props.supportsTokenConnect} />
                        </span>
                    </React.Fragment>
                ))}
            </>
            );
        }
    };

    // ------------------------- <TextKwicMode /> ---------------------------

    const TextKwicMode:React.SFC<{
        corpname:string;
        mainCorp:string;
        corpsWithKwic:Array<string>;
        supportsTokenConnect:boolean;
        lineIdx:number;
        output:KWICSection;
        kwicLength:number;
        attrViewMode:ViewOptions.AttrViewMode;
        tokenConnectClickHandler:(corpusId:string, tokenNumber:number, kwicLength:number, lineIdx:number)=>void;

    }> = (props) => {

        const hasKwic = props.corpsWithKwic.indexOf(props.corpname) > -1;

        const exportTextElmClass = (corpname:string, ...customClasses:Array<string>) => {
            const ans = customClasses.slice();
            if (corpname === props.mainCorp) {
                ans.push('maincorp');
            }
            return ans.join(' ');
        };

        const handleNonKwicTokenClick = (corpusId, lineIdx, tokenNumber) => {
            props.tokenConnectClickHandler(corpusId, tokenNumber, -1, lineIdx);
        };

        const handleTokenClick = (evt) => {
            if (props.supportsTokenConnect) {
                const tokenId = evt.target.getAttribute('data-tokenid');
                if (tokenId !== null) {
                    handleNonKwicTokenClick(
                        props.corpname, props.lineIdx, parseInt(evt.target.getAttribute('data-tokenid')));
                }
            }
        };

        const handleKwicClick = (corpusId, tokenNumber, lineIdx) => {
            props.tokenConnectClickHandler(corpusId, tokenNumber, props.kwicLength, lineIdx);
        };

        return <>
            <td className={exportTextElmClass(props.corpname, 'lc')}
                    onClick={handleTokenClick}>
                {props.output.left.flatMap((item, i, itemList) => [
                        <LeftChunk key={`lc-${i}`} i={i} itemList={itemList} item={item} chunkOffsets={props.output.leftOffsets}
                                    kwicTokenNum={props.output.tokenNumber} lineIdx={props.lineIdx}
                                    supportsTokenConnect={props.supportsTokenConnect}
                                    attrViewMode={props.attrViewMode} />,
                        ' '
                ])}
            </td>
            <td className={exportTextElmClass(props.corpname, 'kw')}
                    onClick={handleKwicClick.bind(null, props.corpname,
                        props.output.tokenNumber, props.lineIdx)}>
                <>
                {props.output.kwic.map((item, i, itemList) =>
                        <KwicChunk key={`kc-${i}`} i={i} item={item} itemList={itemList} prevBlockClosed={props.output.left.get(-1)}
                                hasKwic={hasKwic} lineIdx={props.lineIdx} attrViewMode={props.attrViewMode}
                                supportsTokenConnect={props.supportsTokenConnect}
                                kwicTokenNum={props.output.tokenNumber}  />)
                }
                </>
            </td>
            <td className={exportTextElmClass(props.corpname, 'rc')} onClick={handleTokenClick}>
                <>
                {props.output.right.flatMap((item, i, itemList) => [
                    ' ',
                    <RightChunk key={`rc-${i}`} item={item} i={i} itemList={itemList} chunkOffsets={props.output.rightOffsets}
                            kwicTokenNum={props.output.tokenNumber} prevBlockClosed={props.output.kwic.get(-1)}
                            lineIdx={props.lineIdx} supportsTokenConnect={props.supportsTokenConnect}
                            attrViewMode={props.attrViewMode} />
                ])}
                </>
            </td>
        </>
    }

    // ----------------------- <LeftChunk /> -----------------------------------

    const LeftChunk:React.SFC<{
        i:number;
        lineIdx:number;
        itemList:Immutable.Iterable<number, TextChunk>;
        item:TextChunk;
        chunkOffsets:Immutable.List<number>;
        kwicTokenNum:number;
        supportsTokenConnect:boolean;
        attrViewMode:ViewOptions.AttrViewMode;

    }> = (props) => {
        return <>
            {props.i > 0 && props.itemList.get(props.i - 1).closeLink ?
                <extras.AudioLink t="+" lineIdx={props.lineIdx}
                                chunks={[props.itemList.get(props.i - 1), props.item]} /> :
                null
            }
            {props.item.openLink ?
                <extras.AudioLink t="L" lineIdx={props.lineIdx} chunks={[props.item]} /> :
                null
            }
            <NonKwicText data={props.item} idx={props.i} position="l" chunkOffset={-1 * props.chunkOffsets.get(props.i)}
                            kwicTokenNum={props.kwicTokenNum} supportsTokenConnect={props.supportsTokenConnect}
                            attrViewMode={props.attrViewMode} />
            {props.item.closeLink ?
                <extras.AudioLink t="R" lineIdx={props.lineIdx} chunks={[props.item]} /> :
                null
            }
        </>;
    };

    // -------------------------- <KwicChunk /> --------------------

    const KwicChunk:React.SFC<{
        i:number;
        kwicTokenNum:number;
        lineIdx:number;
        itemList:Immutable.Iterable<number, TextChunk>;
        item:TextChunk;
        prevBlockClosed:TextChunk;
        hasKwic:boolean;
        attrViewMode:ViewOptions.AttrViewMode;
        supportsTokenConnect:boolean;

    }> = (props) => {
        const prevClosed = props.i > 0 ? props.itemList.get(props.i - 1) : props.prevBlockClosed;

        const renderFirst = () => {
            if (prevClosed && props.item.openLink) {
                return <extras.AudioLink t="+" lineIdx={props.lineIdx}
                                    chunks={[prevClosed, props.item]} />;

            } else if (props.i > 0 && props.itemList.get(props.i - 1).closeLink) {
                return <extras.AudioLink t="+" lineIdx={props.lineIdx}
                                    chunks={[props.itemList.get(props.i - 1), props.item]} />;
            }
            return null;
        }

        const renderSecond = () => {
            if (props.hasKwic) {
                return (
                    <strong className={getViewModeClass(props.attrViewMode)}
                            title={getViewModeTitle(props.attrViewMode, true, props.supportsTokenConnect, props.item.tailPosAttrs)}>
                        <Token tokenId={props.kwicTokenNum} isKwic={true} data={props.item} viewMode={props.attrViewMode}
                                supportsTokenConnect={props.supportsTokenConnect} />
                    </strong>
                );

            } else if (!props.item.text) { // TODO test array length??
                return <span>&lt;--not translated--&gt;</span>

            } else {
                return <span className={props.item.className === 'strc' ? 'strc' : null}>{props.item.text.join(' ')} </span>;
            }
        }

        return <>
            {renderFirst()}
            {renderSecond()}
        </>;
    };

    // -------------------------- <RightChunk /> ---------------------

    const RightChunk:React.SFC<{
        i:number;
        itemList:Immutable.Iterable<number, TextChunk>;
        item:TextChunk;
        chunkOffsets:Immutable.List<number>;
        kwicTokenNum:number;
        prevBlockClosed:TextChunk;
        lineIdx:number;
        supportsTokenConnect:boolean;
        attrViewMode:ViewOptions.AttrViewMode;

    }> = (props) => {

        const prevClosed = props.i > 0 ? props.itemList.get(props.i - 1) : props.prevBlockClosed;

        const renderFirst = () => {
            if (prevClosed && props.item.openLink) {
                return <extras.AudioLink t="+" lineIdx={props.lineIdx}
                            chunks={[prevClosed, props.item]} />;

            } else if (props.i > 0 && props.itemList.get(props.i - 1).closeLink) {
                return <extras.AudioLink t="+" lineIdx={props.lineIdx}
                            chunks={[props.itemList.get(props.i - 1), props.item]} />;
            }
            return null;
        };

        return <>
            {renderFirst()}
            {props.item.openLink ?
                <extras.AudioLink t="L" lineIdx={props.lineIdx} chunks={[props.item]} /> :
                null
            }
            <NonKwicText data={props.item} idx={props.i} position="r" chunkOffset={props.chunkOffsets.get(props.i)}
                        kwicTokenNum={props.kwicTokenNum} supportsTokenConnect={props.supportsTokenConnect}
                        attrViewMode={props.attrViewMode} />
            {props.item.closeLink ?
                <extras.AudioLink t="R" lineIdx={props.lineIdx} chunks={[props.item]} /> :
                null
            }
        </>;
    }

    // ------------------------- <Line /> ---------------------------

    class Line extends React.Component<{
        lineIdx:number;
        baseCorpname:string;
        mainCorp:string;
        supportsTokenConnect:boolean;
        corpsWithKwic:Array<string>;
        viewMode:string; // TODO enum
        attrViewMode:ViewOptions.AttrViewMode;
        lineSelMode:string; // TODO enum
        cols:Immutable.List<{n:string; visible:boolean;}>;
        catTextColor:string;
        catBgColor:string;
        showLineNumbers:boolean;
        supportsSyntaxView:boolean;
        numItemsInLockedGroups:number;
        emptyRefValPlaceholder:string;
        data: {
            kwicLength:number;
            hasFocus:boolean;
            lineNumber:number;
            languages:Immutable.List<KWICSection>;
            lineGroup:number;
        };
        tokenConnectClickHandler:(corpusId:string, tokenNumber:number, kwicLength:number, lineIdx:number)=>void;
        onSyntaxViewClick:(tokenNum:number, kwicLength:number)=>void;
        refsDetailClickHandler:(corpusId:string, tokenNumber:number, lineIdx:number)=>void;
    },
    {
        selectionValue:LineSelValue;
    }> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._handleModelChange = this._handleModelChange.bind(this);
        }

        _fetchModelState() {
            return {
                selectionValue: lineSelectionModel.getLine(this.props.data.languages.first().tokenNumber)
            };
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
                        {corpusOutput.left.flatMap((item, i, itemList) => [
                                <LeftChunk key={`lc-${i}`} i={i} itemList={itemList} item={item}
                                        chunkOffsets={corpusOutput.leftOffsets} kwicTokenNum={corpusOutput.tokenNumber}
                                        lineIdx={this.props.lineIdx} supportsTokenConnect={this.props.supportsTokenConnect}
                                        attrViewMode={this.props.attrViewMode} />,
                                        ' '
                                ])}
                    </span>
                    <span onClick={this._handleKwicClick.bind(this, corpname,
                                    corpusOutput.tokenNumber, this.props.lineIdx)}>
                        {corpusOutput.kwic.map((item, i, itemList) =>
                                <KwicChunk key={`kc-${i}`} i={i} itemList={itemList} item={item}
                                        prevBlockClosed={corpusOutput.left.get(-1)} hasKwic={hasKwic}
                                        lineIdx={this.props.lineIdx}
                                        attrViewMode={this.props.attrViewMode}
                                        supportsTokenConnect={this.props.supportsTokenConnect}
                                        kwicTokenNum={corpusOutput.tokenNumber} />)
                        }
                    </span>
                    <span onClick={handleTokenClick}>
                        {corpusOutput.right.flatMap((item, i, itemList) => [
                            ' ',
                            <RightChunk key={`rc-${i}`} i={i} item={item} itemList={itemList} chunkOffsets={corpusOutput.rightOffsets}
                                    kwicTokenNum={corpusOutput.tokenNumber} prevBlockClosed={corpusOutput.kwic.get(-1)}
                                    lineIdx={this.props.lineIdx} supportsTokenConnect={this.props.supportsTokenConnect}
                                    attrViewMode={this.props.attrViewMode} />
                        ])}
                    </span>
                </td>
            );
        }

        _renderText(corpusOutput, corpusIdx) {
            const corpname = this.props.cols.get(corpusIdx).n;
            if (this.props.viewMode === 'kwic') {
                return <TextKwicMode
                            corpname={corpname}
                            mainCorp={this.props.mainCorp}
                            corpsWithKwic={this.props.corpsWithKwic}
                            supportsTokenConnect={this.props.supportsTokenConnect}
                            lineIdx={this.props.lineIdx}
                            output={corpusOutput}
                            kwicLength={this.props.data.kwicLength}
                            tokenConnectClickHandler={this.props.tokenConnectClickHandler}
                            attrViewMode={this.props.attrViewMode} />;

            } else {
                return this._renderTextParMode(corpname, corpusOutput);
            }
        }

        _renderTextSimple(corpusOutput, corpusIdx) {
            const mp  = v => v.text.join(' ');
            return corpusOutput.left.map(mp)
                    .concat(corpusOutput.kwic.map(mp))
                    .concat(corpusOutput.right.map(mp))
                    .join(' ');
        }

        _handleKwicClick(corpusId, tokenNumber, lineIdx) {
            this.props.tokenConnectClickHandler(corpusId, tokenNumber, this.props.data.kwicLength, lineIdx);
        }

        _handleNonKwicTokenClick(corpusId, lineIdx, tokenNumber) {
            this.props.tokenConnectClickHandler(corpusId, tokenNumber, -1, lineIdx);
        }

        _handleModelChange() {
            this.setState(this._fetchModelState());
        }

        shouldComponentUpdate(nextProps, nextState) {
            return this.state.selectionValue !== nextState.selectionValue ||
                    this.props.data !== nextProps.data ||
                    this.props.lineSelMode !== nextProps.lineSelMode ||
                    this.props.catBgColor != nextProps.catBgColor ||
                    this.props.cols !== nextProps.cols ||
                    this.props.viewMode !== nextProps.viewMode;
        }

        componentDidMount() {
            this.modelSubscription = lineSelectionModel.addListener(this._handleModelChange);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        render() {
            const primaryLang = this.props.data.languages.first();
            const alignedCorpora = this.props.data.languages.rest();
            const htmlClasses = [];
            if (this.props.data.hasFocus) {
                htmlClasses.push('active');
            }
            return (
                <tr className={htmlClasses.join(' ')}>
                    <td className="line-num">{this.props.showLineNumbers ? this.props.data.lineNumber + 1 : null}</td>
                    <extras.TdLineSelection
                        kwicLength={this.props.data.kwicLength}
                        tokenNumber={primaryLang.tokenNumber}
                        lineNumber={this.props.data.lineNumber}
                        mode={this.props.lineSelMode}
                        lockedGroupId={this.props.numItemsInLockedGroups > 0 ? this.props.data.lineGroup : null}
                        catBgColor={this.props.catBgColor}
                        catTextColor={this.props.catTextColor}
                        selectionValue={this.state.selectionValue} />
                    <td className="syntax-tree">
                        {this.props.supportsSyntaxView ?
                            <extras.SyntaxTreeButton
                                    onSyntaxViewClick={()=>this.props.onSyntaxViewClick(primaryLang.tokenNumber, this.props.data.kwicLength)}
                                     /> :
                            null
                        }
                    </td>
                    <td className="ref">
                        {this.props.cols.get(0).visible ?
                            <extras.RefInfo corpusId={this.props.cols.get(0).n}
                                    tokenNumber={primaryLang.tokenNumber}
                                    lineIdx={this.props.lineIdx}
                                    data={primaryLang.ref}
                                    refsDetailClickHandler={this.props.refsDetailClickHandler}
                                    emptyRefValPlaceholder={this.props.emptyRefValPlaceholder} /> :
                            null}

                    </td>
                    {this.props.cols.get(0).visible ?
                            this._renderText(primaryLang, 0) :
                            <td title={this._renderTextSimple(primaryLang, 0)}>{'\u2026'}</td>
                    }
                    {alignedCorpora.map((alCorp, i) => {
                        if (this.props.cols.get(i + 1).visible) {
                            return <React.Fragment key={`al-${i}`}>
                                <td className="ref">
                                <extras.RefInfo corpusId={this.props.cols.get(i + 1).n}
                                        tokenNumber={alCorp.tokenNumber}
                                        lineIdx={this.props.lineIdx}
                                        data={alCorp.ref}
                                        emptyRefValPlaceholder={this.props.emptyRefValPlaceholder}
                                        refsDetailClickHandler={this.props.refsDetailClickHandler} />
                                </td>
                                {alCorp.tokenNumber > -1 ? this._renderText(alCorp, i + 1) :
                                    <td className="note">{`// ${he.translate('concview__translat_not_avail')} //`}</td>
                                }
                            </React.Fragment>;

                        } else {
                            return <React.Fragment key={`al-${i}`}>
                                <td className="ref" />
                                <td key="par" title={this._renderTextSimple(alCorp, i + 1)}>{'\u2026'}</td>
                            </React.Fragment>;
                        }
                    })}
                </tr>
            );
        }
    }

    // ------------------------- <ConcLines /> ---------------------------

    class ConcLines extends React.Component<ConcLinesProps, ConcLinesState> {

        private lmSubscription:Subscription;
        private lsmSubscription:Subscription;
        private cdmSubscription:Subscription;

        constructor(props) {
            super(props);
            this._modelChangeListener = this._modelChangeListener.bind(this);
            this.state = this._fetchModelState();
        }

        _getLineSelMode() {
            if (lineModel.getNumItemsInLockedGroups() > 0) {
                return 'groups';

            } else {
                return lineSelectionModel.getMode();
            }
        }

        _fetchModelState() {
            return {
                lines: lineModel.getLines(),
                lineSelData: lineSelectionModel.asMap(),
                lineSelMode: this._getLineSelMode(),
                numItemsInLockedGroups: lineModel.getNumItemsInLockedGroups(),
                useSafeFont: lineModel.getUseSafeFont(),
                emptyRefValPlaceholder: lineModel.getEmptyRefValPlaceholder(),
                corporaColumns: lineModel.getCorporaColumns(),
                viewMode: lineModel.getViewMode(),
                attrViewMode: lineModel.getViewAttrsVmode(),
                supportsTokenConnect: concDetailModel.supportsTokenConnect(),
                showLineNumbers: lineModel.getShowLineNumbers()
            };
        }

        _modelChangeListener() {
            this.setState(this._fetchModelState());
        }

        componentDidMount() {
            this.lmSubscription = lineModel.addListener(this._modelChangeListener);
            this.lsmSubscription = lineSelectionModel.addListener(this._modelChangeListener);
            this.cdmSubscription = concDetailModel.addListener(this._modelChangeListener);
            if (typeof this.props.onReady === 'function') { // <-- a glue with legacy code
                this.props.onReady();
            }
        }

        componentWillUnmount() {
            this.lmSubscription.unsubscribe();
            this.lsmSubscription.unsubscribe();
            this.cdmSubscription.unsubscribe();
        }

        _getCatColors(dataItem) {
            const tmp = this.state.lineSelData.get(dataItem.languages.first().tokenNumber);
            const cat = tmp ? tmp[1] : dataItem.lineGroup;
            if (cat >= 1) {
                const bgColor = this.props.catColors[cat % this.props.catColors.length];
                const fgColor = color2str(calcTextColorFromBg(importColor(bgColor, 0)));
                return [color2str(importColor(bgColor, 0.9)), fgColor];
            }
            return [null, null];
        }

        _renderLine(item, i) {
            const catColor = this._getCatColors(item);
            return <Line key={String(i) + ':' + item.languages.first().tokenNumber}
                         lineIdx={i}
                         data={item}
                         cols={this.state.corporaColumns}
                         viewMode={this.state.viewMode}
                         attrViewMode={this.state.attrViewMode}
                         baseCorpname={this.props.baseCorpname}
                         mainCorp={this.props.mainCorp}
                         corpsWithKwic={this.props.KWICCorps}
                         showLineNumbers={this.state.showLineNumbers}
                         lineSelMode={this.state.lineSelMode}
                         numItemsInLockedGroups={this.state.numItemsInLockedGroups}
                         tokenConnectClickHandler={this.props.tokenConnectClickHandler}
                         refsDetailClickHandler={this.props.refsDetailClickHandler}
                         emptyRefValPlaceholder={this.state.emptyRefValPlaceholder}
                         catBgColor={catColor[0]}
                         catTextColor={catColor[1]}
                         supportsSyntaxView={this.props.supportsSyntaxView}
                         onSyntaxViewClick={this.props.onSyntaxViewClick}
                         supportsTokenConnect={this.state.supportsTokenConnect} />;
        }

        render() {
            const numVisibleCols = this.state.corporaColumns.reduce((prev, c) => prev + (c.visible ? 1 : 0), 0);
            return (
                <table id="conclines" className={this.state.useSafeFont ? 'safe' : null}>
                    <tbody>
                        {this.state.corporaColumns.size > 1 ?
                            <ConcColsHeading cols={this.state.corporaColumns} corpsWithKwic={this.props.KWICCorps}
                                    viewMode={this.state.viewMode} hideable={numVisibleCols > 1} />
                            : null
                        }
                        {this.state.lines.map(this._renderLine.bind(this))}
                    </tbody>
                </table>
            );
        }
    }

    return {
        ConcLines: ConcLines
    };
}