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


    // ------------------------- <Line /> ---------------------------

    let Line = React.createClass({

        mixins : mixins,

        _renderKwicChunk : function (item, i, hasKwic) {
            if (hasKwic) {
                return <strong key={'k:' + String(i)} className={item.className}>{item.text}</strong>;

            } else if (!item.text) {
                return '<--not translated-->';

            } else {
                return item.text;
            }
        },

        _renderLeftChunk : function (item, i) {
            if (item.className) {
                return <span key={'l:' + String(i)} className={item.className}>{item.text}</span>;

            } else {
                return item.text;
            }
        },

        _renderRightChunk : function (item, i) {
            if (item.className) {
                return <span key={'r:' + String(i)} className={item.className}>{item.text}</span>;

            } else {
                return item.text;
            }
        },

        _exportTextElmClass : function (corpname, ...customClasses) {
            let ans = customClasses.slice();
            if (corpname === this.props.mainCorp) {
                ans.push('maincorp');
            }
            return ans.join(' ');
        },

        _renderTextKwicMode : function (corpname, corpusOutput, kwicActionArgs) {
            return [
                <td key="lc" className={this._exportTextElmClass(corpname, 'lc')}>
                    {corpusOutput.left.map(this._renderLeftChunk)}
                </td>,
                <td key="kw" className={this._exportTextElmClass(corpname, 'kw')}
                        data-action={this.createActionLink('widectx')} data-params={kwicActionArgs}>
                    {corpusOutput.kwic.map((item, i) => {
                        return <strong key={'k:' + String(i)} className={item.className}>{item.text}</strong>;
                    })}
                </td>,
                <td key="rc" className={this._exportTextElmClass(corpname, 'rc')}>
                    {corpusOutput.right.map(this._renderRightChunk)}
                </td>
            ];
        },

        _renderTextParMode : function (corpname, corpusOutput, kwicActionArgs) {
            return [
                <td key="par" className={this._exportTextElmClass(corpname, 'par')}
                        data-action={this.createActionLink('widectx')} data-params={kwicActionArgs}>
                    {corpusOutput.left.map(this._renderLeftChunk)}
                    {corpusOutput.kwic.map((item, i) => this._renderKwicChunk(item, i, hasKwic))}
                    {corpusOutput.right.map(this._renderRightChunk)}
                </td>
            ]
        },

        _renderText : function (corpusOutput, corpusIdx) {
            let corpname = this.props.cols[corpusIdx].n;
            let hasKwic = this.props.corpsWithKwic.indexOf(corpname) > -1;
            let refActionLink = this.createActionLink('fullref') + '?pos=' + corpusOutput.tokenNumber +
                    '&corpname=' + this.props.baseCorpname;
            let wideCtxGlobals = this.props.wideCtxGlobals || [];
            let kwicActionArgs = 'pos=' + corpusOutput.tokenNumber +
                    '&hitlen=' + // TODO !!
                    '&corpname=' + this.props.baseCorpname +
                    '&' + wideCtxGlobals.map(item => item[0] + '=' + encodeURIComponent(item[1])).join('&');

            let ans = [
                <td key="ref" className="ref" title="click to see details" data-action={refActionLink}>
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

        render : function () {
            let primaryLang = this.props.data.languages.first();
            let alignedCorpora = this.props.data.languages.rest();
            return (
                <tr data-toknum={primaryLang.tokenNumber} data-linegroup={this.props.data.lineGroup}>
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

        getInitialState : function () {
            return {lines: lineStore.getLines()};
        },

        componentDidMount : function () {
            if (typeof this.props.onReady === 'function') { // <-- a glue with legacy dode
                this.props.onReady();
            }
        },

        _renderLine : function (item, i) {
            return <Line key={String(i) + ':' + item.toknum}
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
                        {this.state.lines.map((item, i) => this._renderLine(item, i))}
                    </tbody>
                </table>
            );
        }
    });


    return {
        ConcLines: ConcLines
    }
}