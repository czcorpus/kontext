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

/// <reference path="../../../ts/declarations/react.d.ts" />

import React from 'vendor/react';


export function init(dispatcher, mixins, lineStore) {

    // ------------------------- <ConcColsHeading /> ---------------------------

    let AudioPlayer = React.createClass({

        _handleControlClick : function (action) {
            dispatcher.dispatch({
                actionType: 'AUDIO_PLAYER_CLICK_CONTROL',
                props: {
                    action: action
                }
            });
        },

        render : function () {
            return (
                <div id="audio-wrapper">
                    <div className="audio-controls">
                        <a onClick={this._handleControlClick.bind(this, 'play')} className="img-button-play"></a>
                        <a onClick={this._handleControlClick.bind(this, 'pause')} className="img-button-pause-b"></a>
                        <a onClick={this._handleControlClick.bind(this, 'stop')} className="img-button-stop"></a>
                    </div>
                </div>
            );
        }
    });

    // ------------------------- <ConcColsHeading /> ---------------------------

    let ConcColsHeading = React.createClass({

        _handleSetMainCorpClick : function (corpusId) {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_CHANGE_MAIN_CORPUS',
                props: {
                    maincorp: corpusId
                }
            });
        },

        _renderCol : function (corpInfo) {
            let colSpan = this.props.viewMode === 'kwic' ? 3 : 1;

            return [
                <td key={'ref:' + corpInfo.n}>{/* matches reference column */}</td>,
                <td key={corpInfo.n} className="concordance-col-heading" colSpan={colSpan} align="center">
                    <a className="select-primary-lang" onClick={this._handleSetMainCorpClick.bind(this, corpInfo.n)}>{corpInfo.label}</a>
                </td>
            ];
        },

        render : function () {
            return (
                <tr>
                    <td>{/* matches line number column */}</td>
                    <td>{/* matches selection checkbox column */}</td>
                    <td>{/* matches syntax tree column */}</td>
                    {this.props.cols.map(item => this._renderCol(item))}
                </tr>
            );
        }

    });

    // ------------------------- <AudioLink /> ---------------------------

    let AudioLink = React.createClass({

        _getChar : function () {
            return {'L': '\u00A0[\u00A0', '+': '\u00A0+\u00A0', 'R': '\u00A0]\u00A0'}[this.props.t];
        },

        _handleClick : function () {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_PLAY_AUDIO_SEGMENT',
                props: {
                    chunks: this.props.chunks,
                    lineIdx: this.props.lineIdx
                }
            });
        },

        render : function () {
            if (this.props.chunks.length === 1
                    && this.props.chunks[this.props.chunks.length - 1].showAudioPlayer) {
                return (
                    <span>
                        <a className="speech-link" onClick={this._handleClick}>{this._getChar()}</a>
                        <AudioPlayer />
                    </span>
                );

            } else {
                return <a className="speech-link" onClick={this._handleClick}>{this._getChar()}</a>;
            }
        }
    });


    // ------------------------- <Line /> ---------------------------

    let Line = React.createClass({

        mixins : mixins,


        _renderLeftChunk : function (item, i, itemList) {
            let ans = [];

            if (i > 0 && itemList.get(i - 1).closeLink) {
                ans.push(<AudioLink t="+" lineIdx={this.props.lineIdx} corpname={this.props.baseCorpname} chunks={[itemList.get(i - 1), item]} />);
            }
            if (item.openLink) {
                ans.push(<AudioLink t="L" lineIdx={this.props.lineIdx} corpname={this.props.baseCorpname} chunks={[item]} />);
            }
            if (item.className) {
                ans.push(<span key={'l:' + String(i)} className={item.className}>{item.text}</span>);

            } else {
                ans.push(item.text);
            }
            if (item.closeLink) {
                ans.push(<AudioLink t="R" lineIdx={this.props.lineIdx} corpname={this.props.baseCorpname} chunks={[item]} />);
            }
            return ans;
        },

        _renderKwicChunk : function (prevClosed, hasKwic, item, i, itemList) {
            let ans = [];
            if (prevClosed && item.openLink) {
                ans.push(<AudioLink t="+" lineIdx={this.props.lineIdx} corpname={this.props.baseCorpname} chunks={[prevClosed, item]} />);

            } else if (i > 0 && itemList.get(i - 1).closeLink) {
                ans.push(<AudioLink t="+" lineIdx={this.props.lineIdx} corpname={this.props.baseCorpname} chunks={[itemList.get(i - 1), item]} />);
            }
            if (hasKwic) {
                ans.push(<strong key={'k:' + String(i)} className={item.className}>{item.text}</strong>);

            } else if (!item.text) {
                ans.push('<--not translated-->');

            } else {
                ans.push(item.text);
            }
            return ans;
        },

        _renderRightChunk : function (prevClosed, item, i, itemList) {
            let ans = [];
            if (prevClosed && item.openLink) {
                ans.push(<AudioLink t="+" lineIdx={this.props.lineIdx} corpname={this.props.baseCorpname} chunks={[prevClosed, item]} />);

            } else if (i > 0 && itemList.get(i - 1).closeLink) {
                ans.push(<AudioLink t="+" lineIdx={this.props.lineIdx} corpname={this.props.baseCorpname} chunks={[itemList.get(i - 1), item]} />);
            }
            if (item.openLink) {
                ans.push(<AudioLink t="L" lineIdx={this.props.lineIdx} corpname={this.props.baseCorpname} chunks={[item]} />);
            }
            if (item.className) {
                ans.push(<span key={'r:' + String(i)} className={item.className}>{item.text}</span>);

            } else {
                ans.push(item.text);
            }
            if (item.closeLink) {
                ans.push(<AudioLink t="R" lineIdx={this.props.lineIdx} corpname={this.props.baseCorpname} chunks={[item]} />);
            }
            return ans;
        },

        _exportTextElmClass : function (corpname, ...customClasses) {
            let ans = customClasses.slice();
            if (corpname === this.props.mainCorp) {
                ans.push('maincorp');
            }
            return ans.join(' ');
        },

        _renderTextKwicMode : function (corpname, corpusOutput, kwicActionArgs) {
            let hasKwic = this.props.corpsWithKwic.indexOf(corpname) > -1;
            return [
                <td key="lc" className={this._exportTextElmClass(corpname, 'lc')}>
                    {corpusOutput.left.map(this._renderLeftChunk)}
                </td>,
                <td key="kw" className={this._exportTextElmClass(corpname, 'kw')}
                        data-action={this.createActionLink('widectx')} data-params={kwicActionArgs}>
                    {corpusOutput.kwic.map(this._renderKwicChunk.bind(this, corpusOutput.left.get(-1), hasKwic))}
                </td>,
                <td key="rc" className={this._exportTextElmClass(corpname, 'rc')}>
                    {corpusOutput.right.map(this._renderRightChunk.bind(this, corpusOutput.kwic.get(-1)))}
                </td>
            ];
        },

        _renderTextParMode : function (corpname, corpusOutput, kwicActionArgs) {
            let hasKwic = this.props.corpsWithKwic.indexOf(corpname) > -1;
            return [
                <td key="par" className={this._exportTextElmClass(corpname, 'par')}
                        data-action={this.createActionLink('widectx')} data-params={kwicActionArgs}>
                    {corpusOutput.left.map(this._renderLeftChunk)}
                    {corpusOutput.kwic.map(this._renderKwicChunk.bind(this, corpusOutput.left.get(-1), hasKwic))}
                    {corpusOutput.right.map(this._renderRightChunk.bind(this, corpusOutput.kwic.get(-1)))}
                </td>
            ]
        },

        _createKwicActionArgs : function (corpusOutput) {
            let wideCtxGlobals = this.props.wideCtxGlobals || [];
            return 'pos=' + corpusOutput.tokenNumber + '&hitlen=' + // TODO !!
                        '&corpname=' + this.props.baseCorpname +
                        '&' + wideCtxGlobals.map(item => item[0] + '=' + encodeURIComponent(item[1])).join('&');
        },

        _createRefActionLink : function (corpusOutput) {
            return this.createActionLink('fullref') + '?pos=' + corpusOutput.tokenNumber +
                    '&corpname=' + this.props.baseCorpname;
        },

        _renderText : function (corpusOutput, corpusIdx) {
            let corpname = this.props.cols[corpusIdx].n;
            let refActionLink = this._createRefActionLink(corpusOutput);
            let kwicActionArgs = this._createKwicActionArgs(corpusOutput);

            let ans = [
                <td key="ref" className="ref" title="click to see details"
                        onClick={this._handleRefsClick.bind(this, this.props.baseCorpname,
                                 corpusOutput.tokenNumber, this.props.lineIdx)}>
                    {corpusOutput.ref}
                </td>
            ];
            if (this.props.viewMode === 'kwic') {
                ans = ans.concat(this._renderTextKwicMode(corpname, corpusOutput, kwicActionArgs));

            } else {
                ans = ans.concat(this._renderTextParMode(corpname, corpusOutput, kwicActionArgs));
            }
            return ans;
        },

        _handleRefsClick : function (corpusId, tokenNumber, lineIdx) {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_SHOW_REF_DETAIL',
                props: {
                    corpusId: corpusId,
                    tokenNumber: tokenNumber,
                    lineIdx: lineIdx
                }
            });
        },

        _handleKwicClick : function () {

        },

        render : function () {
            let primaryLang = this.props.data.languages.first();
            let alignedCorpora = this.props.data.languages.rest();
            let htmlClasses = [];
            if (this.props.data.hasFocus) {
                htmlClasses.push('active');
            }
            return (
                <tr className={htmlClasses.join(' ')} data-toknum={primaryLang.tokenNumber} data-linegroup={this.props.data.lineGroup}>
                    <td className="line-num">{this.props.showLineNumbers ? this.props.data.lineNumber + 1 : null}</td>
                    <td className="manual-selection">
                        <input type="text" data-kwiclen={this.props.data.kwicLength}
                            data-position={primaryLang.tokenNumber}
                            data-linenum="0" inputMode="numeric" style={{width: '1.4em'}} />
                    </td>
                    <td className="syntax-tree" style={{display: 'table-cell'}}>
                    </td>
                    {this._renderText(primaryLang, 0)}
                    {alignedCorpora.map((alCorp, i) => this._renderText(alCorp, i + 1))}
                </tr>
            );
        }
    });

    // ------------------------- <ConcLines /> ---------------------------

    let ConcLines = React.createClass({

        mixins : mixins,

        _storeChangeListener : function () {
            this.setState({lines: lineStore.getLines()});
        },

        getInitialState : function () {
            return {lines: lineStore.getLines()};
        },

        componentDidMount : function () {
            lineStore.addChangeListener(this._storeChangeListener);
            if (typeof this.props.onReady === 'function') { // <-- a glue with legacy dode
                this.props.onReady();
            }
        },

        componentWillUnmount : function () {
            lineStore.removeChangeListener(this._storeChangeListener);
        },

        _renderLine : function (item, i) {
            return <Line key={String(i) + ':' + item.languages.first().tokenNumber}
                         lineIdx={i}
                         data={item}
                         cols={this.props.CorporaColumns}
                         viewMode={this.props.ViewMode}
                         baseCorpname={this.props.baseCorpname}
                         mainCorp={this.props.mainCorp}
                         corpsWithKwic={this.props.KWICCorps}
                         wideCtxGlobals={this.props.WideCtxGlobals}
                         showLineNumbers={this.props.ShowLineNumbers} />;
        },

        render : function () {
            return (
                <table id="conclines">
                    <tbody>
                        {this.props.CorporaColumns.length > 1 ?
                            <ConcColsHeading cols={this.props.CorporaColumns} corpsWithKwic={this.props.KWICCorps}
                                    viewMode={this.props.ViewMode} />
                            : null
                        }
                        {this.state.lines.map(this._renderLine)}
                    </tbody>
                </table>
            );
        }
    });


    return {
        ConcLines: ConcLines
    };
}