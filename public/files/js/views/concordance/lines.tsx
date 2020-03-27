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
import {IActionDispatcher} from 'kombo';
import {Kontext} from '../../types/common';
import {calcTextColorFromBg, color2str, importColor} from '../../util';
import {init as lineExtrasViewsInit} from './lineExtras';
import { ConcLineModel, CorpColumn } from '../../models/concordance/lines';
import { LineSelectionModel } from '../../models/concordance/lineSelection';
import { ConcDetailModel } from '../../models/concordance/detail';
import {LineSelValue} from '../../models/concordance/lineSelection';
import {KWICSection } from '../../models/concordance/line';
import {Line, TextChunk} from '../../types/concordance';
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
    supportsTokenConnect:boolean;
    showLineNumbers:boolean;
}


export interface LinesViews {
    ConcLines:React.ComponentClass<ConcLinesProps>;
}


export function init({dispatcher, he, lineModel, lineSelectionModel,
                concDetailModel}:LinesModuleArgs):LinesViews {

    const extras = lineExtrasViewsInit(dispatcher, he, lineModel);

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

    // ------------------------- <NonKwicText /> ---------------------------

    const NonKwicText:React.SFC<{
        position:string;
        kwicTokenNum:number;
        chunkOffset:number;
        idx:number;
        supportsTokenConnect:boolean;
        data: {
            className:string;
            mouseover:Array<string>;
            text:Array<string>;
        }

    }> = (props) => {

        const hasClass = (cls) => {
            return props.data.className.indexOf(cls) > -1;
        };

        const mkKey = () => {
            return `${props.position}:${props.idx}`;
        };

        const mkTokenId = (i) => {
            return props.kwicTokenNum + props.chunkOffset + i;
        };

        const splitTokens = () => {
            const ans = [];
            props.data.text.forEach((s, i) => {
                ans.push(' ');
                ans.push(<mark className={props.supportsTokenConnect ? 'active' : null}
                               key={`${props.position}:${props.idx}:${i}`} data-tokenid={mkTokenId(i)}>{s}</mark>);
            });
            ans.push(' ');
            return ans;
        };

        const tokenConnectInfo1 = props.supportsTokenConnect ?
                he.translate('concview__click_to_see_external_token_info') : '';
        const tokenConnectInfo2 = props.supportsTokenConnect ?
                `(${he.translate('concview__click_to_see_external_token_info')})` : '';
        const metadata = (props.data.mouseover || []);
        const title = metadata.length > 0 ? `${metadata.join(', ')} ${tokenConnectInfo2}` : tokenConnectInfo1;

        if (props.data.className && props.data.text) {
            if (hasClass('coll') && !hasClass('col0')) {
                return(
                    <em key={mkKey()} className={props.data.className} title={title}>
                        {props.data.text.join(' ')}
                    </em>
                );

            } else {
                const s = props.data.text.join(' ');
                return (
                    <span key={mkKey()} className={s !== '' ? props.data.className : null} title={title}>
                        {s || ' '}
                    </span>
                );
            }

        } else {
            return (
                <span key={mkKey()} title={title}>
                    {splitTokens()}
                </span>
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
                        props.corpname, props.lineIdx, Number(evt.target.getAttribute('data-tokenid')));
                }
            }
        };

        const handleKwicClick = (corpusId, tokenNumber, lineIdx) => {
            props.tokenConnectClickHandler(corpusId, tokenNumber, props.kwicLength, lineIdx);
        };

        return <>
            <td className={exportTextElmClass(props.corpname, 'lc')}
                    onClick={handleTokenClick}>
                {props.output.left.map((item, i, itemList) =>
                        <LeftChunk key={`lc-${i}`} i={i} itemList={itemList} item={item} chunkOffsets={props.output.leftOffsets}
                                    kwicTokenNum={props.output.tokenNumber} lineIdx={props.lineIdx}
                                    supportsTokenConnect={props.supportsTokenConnect} />)}
            </td>
            <td className={exportTextElmClass(props.corpname, 'kw')}
                    onClick={handleKwicClick.bind(null, props.corpname,
                        props.output.tokenNumber, props.lineIdx)}>
                <>
                {props.output.kwic.map((item, i, itemList) =>
                        <KwicChunk key={`kc-${i}`} i={i} item={item} itemList={itemList} prevBlockClosed={props.output.left.get(-1)}
                                hasKwic={hasKwic} lineIdx={props.lineIdx} />)
                }
                </>
            </td>
            <td className={exportTextElmClass(props.corpname, 'rc')} onClick={handleTokenClick}>
                <>
                {props.output.right.map((item, i, itemList) =>
                    <RightChunk key={`rc-${i}`} item={item} i={i} itemList={itemList} chunkOffsets={props.output.rightOffsets}
                            kwicTokenNum={props.output.tokenNumber} prevBlockClosed={props.output.kwic.get(-1)}
                            lineIdx={props.lineIdx} supportsTokenConnect={props.supportsTokenConnect} />)}
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
                            kwicTokenNum={props.kwicTokenNum} supportsTokenConnect={props.supportsTokenConnect} />
            {props.item.closeLink ?
                <extras.AudioLink t="R" lineIdx={props.lineIdx} chunks={[props.item]} /> :
                null
            }
        </>;
    };

    // -------------------------- <KwicChunk /> --------------------

    const KwicChunk:React.SFC<{
        i:number;
        lineIdx:number;
        itemList:Immutable.Iterable<number, TextChunk>;
        item:TextChunk;
        prevBlockClosed:TextChunk;
        hasKwic:boolean;

    }> = (props) => {
        const mouseover = (props.item.mouseover || []).join(', ');
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
                return <strong className={props.item.className} title={mouseover}>
                    {props.item.text.join(' ')} </strong>;

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
                        kwicTokenNum={props.kwicTokenNum} supportsTokenConnect={props.supportsTokenConnect} />
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
                        {corpusOutput.left.map((item, i, itemList) =>
                                <LeftChunk key={`lc-${i}`} i={i} itemList={itemList} item={item}
                                        chunkOffsets={corpusOutput.leftOffsets} kwicTokenNum={corpusOutput.tokenNumber}
                                        lineIdx={this.props.lineIdx} supportsTokenConnect={this.props.supportsTokenConnect} />)}
                    </span>
                    <span onClick={this._handleKwicClick.bind(this, corpname,
                                    corpusOutput.tokenNumber, this.props.lineIdx)}>
                        {corpusOutput.kwic.map((item, i, itemList) =>
                                <KwicChunk key={`kc-${i}`} i={i} itemList={itemList} item={item}
                                        prevBlockClosed={corpusOutput.left.get(-1)} hasKwic={hasKwic}
                                        lineIdx={this.props.lineIdx} />)
                        }
                    </span>
                    <span onClick={handleTokenClick}>
                        {corpusOutput.right.map((item, i, itemList) =>
                            <RightChunk key={`rc-${i}`} i={i} item={item} itemList={itemList} chunkOffsets={corpusOutput.rightOffsets}
                                    kwicTokenNum={corpusOutput.tokenNumber} prevBlockClosed={corpusOutput.kwic.get(-1)}
                                    lineIdx={this.props.lineIdx} supportsTokenConnect={this.props.supportsTokenConnect} />)}
                    </span>
                </td>
            );
        }

        _renderText(corpusOutput, corpusIdx) {
            const corpname = this.props.cols.get(corpusIdx).n;
            if (this.props.viewMode === 'kwic') {
                return <TextKwicMode corpname={corpname}
                            mainCorp={this.props.mainCorp}
                            corpsWithKwic={this.props.corpsWithKwic}
                            supportsTokenConnect={this.props.supportsTokenConnect}
                            lineIdx={this.props.lineIdx}
                            output={corpusOutput}
                            kwicLength={this.props.data.kwicLength}
                            tokenConnectClickHandler={this.props.tokenConnectClickHandler} />;

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