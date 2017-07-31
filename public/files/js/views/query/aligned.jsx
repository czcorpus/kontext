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


import React from 'vendor/react';
import {init as inputInit} from './input';


export function init(dispatcher, mixins, layoutViews, queryStore, queryHintStore, withinBuilderStore, virtualKeyboardStore) {

    const inputViews = inputInit(dispatcher, mixins, layoutViews, queryStore, queryHintStore, withinBuilderStore, virtualKeyboardStore);

    // ------------------ <AlignedCorpBlock /> -----------------------------

    const AlignedCorpBlock = React.createClass({

        mixins : mixins,

        _handleCloseClick : function () {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_REMOVE_ALIGNED_CORPUS',
                props: {
                    corpname: this.props.corpname
                }
            });
        },

        _handleMakeMainClick : function () {
            dispatcher.dispatch({
                actionType: 'QUERY_MAKE_CORPUS_PRIMARY',
                 props: {
                    corpname: this.props.corpname
                }
            });
        },

        render : function () {
            return (
                <div className="parallel-corp-lang">
                    <div className="heading">
                        <a className="make-primary" title={this.translate('query__make_corpus_primary')}
                                onClick={this._handleMakeMainClick}>
                            <img src={this.createStaticUrl('img/make-main.svg')}
                                alt={this.translate('query__make_corpus_primary')} />
                        </a>
                        <h3>{this.props.label}</h3>
                        <a className="close-button" title={this.translate('query__remove_corpus')}
                                onClick={this._handleCloseClick}>
                            <img src={this.createStaticUrl('img/close-icon.svg')}
                                    alt={this.translate('query__close_icon')} />
                        </a>
                    </div>
                    <table className="form">
                        <tbody>
                            <inputViews.TRPcqPosNegField sourceId={this.props.corpname}
                                    value={this.props.pcqPosNegValue} actionPrefix="" />
                            <inputViews.TRQueryTypeField queryType={this.props.queryType}
                                    sourceId={this.props.corpname}
                                    actionPrefix=""
                                    hasLemmaAttr={this.props.hasLemmaAttr} />
                            <inputViews.TRQueryInputField
                                sourceId={this.props.corpname}
                                queryType={this.props.queryType}
                                widgets={this.props.widgets}
                                wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValue}
                                matchCaseValue={this.props.matchCaseValue}
                                forcedAttr={this.props.forcedAttr}
                                defaultAttr={this.props.defaultAttr}
                                attrList={this.props.attrList}
                                tagsetDocUrl={this.props.tagsetDocUrl}
                                inputLanguage={this.props.inputLanguage}
                                queryStorageView={this.props.queryStorageView}
                                actionPrefix="" />
                        </tbody>
                    </table>
                </div>
            );
        }

    });

    // ------------------ <AlignedCorpora /> -----------------------------

    const AlignedCorpora = React.createClass({

        mixins : mixins,

        _handleAddAlignedCorpus : function (evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_ADD_ALIGNED_CORPUS',
                props: {
                    corpname: evt.target.value
                }
            });
        },

        _findCorpusLabel : function (corpname) {
            const ans = this.props.availableCorpora.find(x => x.n === corpname);
            return ans ? ans.label : corpname;
        },

        _corpIsUnused : function (corpname) {
            return !this.props.alignedCorpora.contains(corpname);
        },

        render : function () {
            return (
                <fieldset className="parallel">
                    <legend>
                        {this.translate('query__aligned_corpora_hd')}
                    </legend>
                    <div id="add-searched-lang-widget">
                        <select onChange={this._handleAddAlignedCorpus} value="">
                            <option value="" disabled="disabled">
                                {`-- ${this.translate('query__add_a_corpus')} --`}</option>
                            {this.props.availableCorpora
                                .filter(item => this._corpIsUnused(item.n))
                                .map(item => {
                                    return <option key={item.n} value={item.n}>{item.label}</option>;
                                })}
                        </select>
                    </div>
                    {this.props.alignedCorpora.map(item => {
                        return <AlignedCorpBlock
                                key={item}
                                label={this._findCorpusLabel(item)}
                                corpname={item}
                                queryType={this.props.queryTypes.get(item)}
                                widgets={this.props.supportedWidgets.get(item)}
                                wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValues.get(item)}
                                matchCaseValue={this.props.matchCaseValues.get(item)}
                                forcedAttr={this.props.forcedAttr}
                                defaultAttr={this.props.defaultAttrValues.get(item)}
                                attrList={this.props.attrList}
                                tagsetDocUrl={this.props.tagsetDocUrl}
                                pcqPosNegValue={this.props.pcqPosNegValues.get(item)}
                                inputLanguage={this.props.inputLanguages.get(item)}
                                queryStorageView={this.props.queryStorageView}
                                hasLemmaAttr={this.props.hasLemmaAttr} />;
                    })}
                </fieldset>
            );
        }
    });


    return {
        AlignedCorpora: AlignedCorpora
    };

}