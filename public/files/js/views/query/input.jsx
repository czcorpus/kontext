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
import {init as keyboardInit} from './keyboard';


export function init(dispatcher, mixins, layoutViews, queryStore, queryHintStore,
        withinBuilderStore, virtualKeyboardStore) {

    const keyboardViews = keyboardInit(dispatcher, mixins[0], queryStore, virtualKeyboardStore);

    // -------------- <QueryHints /> --------------------------------------------

    const QueryHints = React.createClass({

        mixins: mixins,

        _changeListener : function () {
            this.setState({hintText: queryHintStore.getHint()});
        },

        getInitialState : function () {
            return {hintText: queryHintStore.getHint()};
        },

        componentDidMount : function () {
            queryHintStore.addChangeListener(this._changeListener);
        },

        componentWillUnmount : function () {
            queryHintStore.removeChangeListener(this._changeListener);
        },

        _clickHandler : function () {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'NEXT_QUERY_HINT',
                props: {}
            });
        },

        render: function () {
            return (
                <div>
                    <span className="hint">{this.state.hintText}</span>
                    <span className="next-hint">
                        (<a onClick={this._clickHandler}>{this.translate('global__next_tip')}</a>)
                    </span>
                </div>
            );
        }
    });


    // ------------------- <TRQueryTypeField /> -----------------------------

    const TRQueryTypeField = React.createClass({

        mixins : mixins,

        _handleSelection : function (evt) {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'QUERY_INPUT_SELECT_TYPE',
                props: {
                    sourceId: this.props.sourceId,
                    queryType: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <tr>
                    <th>{this.translate('query__select_type')}:</th>
                    <td>
                        <select value={this.props.queryType} onChange={this._handleSelection}>
                            <option value="iquery">{this.translate('query__qt_basic')}</option>
                            {this.props.hasLemmaAttr ? <option value="lemma">{this.translate('query__qt_lemma')}</option> : null}
                            <option value="phrase">{this.translate('query__qt_phrase')}</option>
                            <option value="word">{this.translate('query__qt_word_form')}</option>
                            <option value="char">{this.translate('query__qt_word_part')}</option>
                            <option value="cql">{this.translate('query__qt_cql')}</option>
                        </select>
                    </td>
                </tr>
            );
        }
    });

    // ------------------- <TRPcqPosNegField /> -----------------------------

    const TRPcqPosNegField = React.createClass({

        mixins : mixins,

        _handleSelectChange : function (evt) {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'QUERY_INPUT_SET_PCQ_POS_NEG',
                props: {
                    corpname: this.props.sourceId,
                    value: evt.target.value
                }
            })
        },

        render : function () {
            return (
                <tr>
                    <th />
                    <td>
                        <select value={this.props.value} onChange={this._handleSelectChange}>
                            <option value="pos">{this.translate('query__align_contains')}</option>
                            <option value="neg">{this.translate('query__align_not_contains')}</option>
                        </select>
                    </td>
                </tr>
            )
        }
    });

    // ------------------- <TagWidget /> --------------------------------

    const TagWidget = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <layoutViews.PopupBox
                        onCloseClick={this.props.closeClickHandler}
                        customClass="tag-builder-widget"
                        customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}>
                    <this.props.tagHelperView
                            sourceId={this.props.sourceId}
                            onInsert={this.props.closeClickHandler}
                            onEscKey={this.props.closeClickHandler}
                            actionPrefix={this.props.actionPrefix} />
                </layoutViews.PopupBox>
            );
        }
    });

    // ------------------- <WithinWidget /> --------------------------------

    const WithinWidget = React.createClass({

        mixins : mixins,

        componentDidMount : function () {
            withinBuilderStore.addChangeListener(this._handleStoreChange);
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_LOAD_WITHIN_BUILDER_DATA',
                props: {
                    sourceId: this.props.sourceId
                }
            });
        },

        componentWillUnmount : function () {
            withinBuilderStore.removeChangeListener(this._handleStoreChange);
        },

        _handleStoreChange : function () {
            this.setState({
                data: withinBuilderStore.getData(),
                query: withinBuilderStore.getQuery(),
                attr: withinBuilderStore.getCurrAttrIdx(),
                exportedQuery: withinBuilderStore.exportQuery()
            });
        },

        getInitialState : function () {
            return {
                data: withinBuilderStore.getData(),
                query: withinBuilderStore.getQuery(),
                attr: withinBuilderStore.getCurrAttrIdx(),
                exportedQuery: withinBuilderStore.exportQuery()
            }
        },

        _handleInputChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_WITHIN_VALUE',
                props: {
                    value: evt.target.value
                }
            });
        },

        _handleAttrChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_WITHIN_ATTR',
                props: {
                    idx: evt.target.value
                }
            });
        },

        _handleInsert : function () {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'QUERY_INPUT_APPEND_QUERY',
                props: {
                    sourceId: this.props.sourceId,
                    query: this.state.exportedQuery,
                    prependSpace: true,
                    closeWhenDone: true
                }
            });
        },

        render : function () {
            return (
                <layoutViews.PopupBox
                        onCloseClick={this.props.closeClickHandler}
                        customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}>
                    <h3>{this.translate('query__create_within')}</h3>
                    <div className="within-widget">
                        <select onChange={this._handleAttrChange} value={this.state.attr}>
                            {this.state.data.map((item, i) => {
                                return <option key={item} value={i}>{`${item[0]}.${item[1]}`}</option>;
                            })}
                        </select>
                        {'\u00a0'}={'\u00a0'}
                        <input type="text" value={this.state.query} onChange={this._handleInputChange} />
                        {'\u00a0'}
                    </div>
                    <p>
                        <button type="button" className="util-button"
                                onClick={this._handleInsert}>
                            {this.translate('query__insert_within')}
                        </button>
                    </p>
                </layoutViews.PopupBox>
            );
        }
    });

    // ------------------- <HistoryWidget /> -----------------------------

    const HistoryWidget = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <div className="history-widget">
                    <this.props.queryStorageView
                            sourceId={this.props.sourceId}
                            onCloseTrigger={this.props.onCloseTrigger}
                            actionPrefix={this.props.actionPrefix} />
                </div>
            );
        }
    });

    // ------------------- <KeyboardWidget /> --------------------------------

    const KeyboardWidget = React.createClass({

        _keyHandler : function (evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_HIT_VIRTUAL_KEYBOARD_KEY',
                props: {
                    keyCode: evt.keyCode
                }
            });
        },

        render : function () {
            return (
                <layoutViews.PopupBox
                        onCloseClick={this.props.closeClickHandler}
                        customStyle={{marginTop: '3.5em'}}
                        takeFocus={true}
                        keyPressHandler={this._keyHandler}>
                    <keyboardViews.Keyboard sourceId={this.props.sourceId}
                            inputLanguage={this.props.inputLanguage}
                            actionPrefix={this.props.actionPrefix} />
                </layoutViews.PopupBox>
            );
        }
    });

    // ------------------- <QueryToolbox /> -----------------------------

    const QueryToolbox = React.createClass({

        mixins : mixins,

        _renderButtons : function () {
            const ans = [];

            if (this.props.widgets.indexOf('tag') > -1) {
                ans.push(<a onClick={this._handleWidgetTrigger.bind(this, 'tag')}>{this.translate('query__insert_tag_btn_link')}</a>);
            }
            if (this.props.widgets.indexOf('within') > -1) {
                ans.push(<a onClick={this._handleWidgetTrigger.bind(this, 'within')}>{this.translate('query__insert_within_link')}</a>);
            }
            if (this.props.widgets.indexOf('keyboard') > -1) {
                ans.push(<a onClick={this._handleWidgetTrigger.bind(this, 'keyboard')}>{this.translate('query__keyboard_link')}</a>);
            }
            if (this.props.widgets.indexOf('history') > -1) {
                ans.push(<a onClick={this._handleHistoryWidget}>{this.translate('query__recent_queries_link')}</a>);
            }
            return ans;
        },

        _handleWidgetTrigger : function (name) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_ACTIVE_WIDGET',
                props: {
                    sourceId: this.props.sourceId,
                    value: name
                }
            });
        },

        _handleHistoryWidget : function () {
            this.setState({activeWidget: null});
            this.props.toggleHistoryWidget();
        },

        _handleCloseWidget : function () {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_ACTIVE_WIDGET',
                props: {
                    sourceId: this.props.sourceId,
                    value: null
                }
            });
        },

        _renderWidget : function () {
            switch (this.state.activeWidget) {
                case 'tag':
                    return <TagWidget closeClickHandler={this._handleCloseWidget}
                                tagHelperView={this.props.tagHelperView}
                                sourceId={this.props.sourceId}
                                actionPrefix={this.props.actionPrefix} />;
                case 'within':
                    return <WithinWidget closeClickHandler={this._handleCloseWidget}
                                sourceId={this.props.sourceId} actionPrefix={this.props.actionPrefix} />;
                case 'keyboard':
                    return <KeyboardWidget closeClickHandler={this._handleCloseWidget}
                                sourceId={this.props.sourceId} inputLanguage={this.props.inputLanguage}
                                actionPrefix={this.props.actionPrefix} />;
                default:
                    return null;
            }
        },

        getInitialState : function () {
            return {activeWidget: queryStore.getActiveWidget(this.props.sourceId)};
        },

        _handleQueryStoreChange : function () {
            this.setState({activeWidget: queryStore.getActiveWidget(this.props.sourceId)});
        },

        componentDidMount : function () {
            queryStore.addChangeListener(this._handleQueryStoreChange);
        },

        componentWillUnmount : function () {
            queryStore.removeChangeListener(this._handleQueryStoreChange);
        },

        render : function () {
            return (
                <div className="query-toolbox">
                    {this._renderWidget()}
                    <ul>
                        {this._renderButtons().map((item, i) => {
                            return <li key={i}>{item}</li>
                        })}
                    </ul>
                </div>
            );
        }
    });

    // ------------------- <LposSelector /> -----------------------------

    const LposSelector = React.createClass({

        mixins : mixins,

        _handleLposChange : function (evt) {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'QUERY_INPUT_SET_LPOS',
                props: {
                    sourceId: this.props.sourceId,
                    lpos: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <span>
                    {this.translate('query__pos')}:{'\u00a0'}
                    <select onChange={this._handleLposChange} value={this.props.lposValue}>
                        <option value="">{this.translate('query__not_specified')}</option>
                        {this.props.wPoSList.map(item => {
                            return <option key={item.v} value={item.v}>{item.n}</option>;
                        })}
                    </select>
                </span>
            );
        }
    });

    // ------------------- <MatchCaseSelector /> -----------------------------

    const MatchCaseSelector = React.createClass({

        mixins : mixins,

        _handleCheckbox : function (evt) {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'QUERY_INPUT_SET_MATCH_CASE',
                props: {
                    sourceId: this.props.sourceId,
                    value: !this.props.matchCaseValue
                }
            });
        },

        render : function () {
            return (
                <label>
                    {this.translate('query__match_case')}:{'\u00a0'}
                    <input type="checkbox" name="qmcase" value="1" checked={this.props.matchCaseValue}
                        onChange={this._handleCheckbox} />
                </label>
            );
        }
    });

    // ------------------- <DefaultAttrSelector /> -----------------------------

    const DefaultAttrSelector = React.createClass({

        mixins : mixins,

        _handleSelectChange : function (evt) {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'QUERY_INPUT_SET_DEFAULT_ATTR',
                props: {
                    sourceId: this.props.sourceId,
                    value: evt.target.value
                }
            });
        },

        render : function () {
            if (this.props.forcedAttr) {
                return (
                    <select disabled="disabled" title={this.translate('query__implicit_attr_cannot_be_changed')}>
                        <option>{this.props.forcedAttr}</option>
                    </select>
                );

            } else {
                return (
                    <select value={this.props.defaultAttr} onChange={this._handleSelectChange}>
                        {this.props.attrList.map(item => {
                            return <option key={item.n} value={item.n}>{item.label}</option>;
                        })}
                    </select>
                );
            }
        }
    });

    // ------------------- <TRQueryInputField /> -----------------------------

    const TRQueryInputField = React.createClass({

        mixins : mixins,

        _queryInputElement : null,

        getInitialState : function () {
            return {
                query: queryStore.getQuery(this.props.sourceId),
                historyVisible: false
            };
        },

        _handleInputChange : function (evt) {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'QUERY_INPUT_SET_QUERY',
                props: {
                    sourceId: this.props.sourceId,
                    query: evt.target.value
                }
            });
        },

        _handleStoreChange : function (store, action) {
            this.setState({
                query: queryStore.getQuery(this.props.sourceId),
                historyVisible: false
            });
        },

        componentDidMount : function () {
            queryStore.addChangeListener(this._handleStoreChange);
        },

        componentWillUnmount : function () {
            queryStore.removeChangeListener(this._handleStoreChange);
        },

        componentDidUpdate : function (prevProps, prevState) {
            if (this._queryInputElement
                    && prevState.historyVisible && !this.state.historyVisible) {
                this._queryInputElement.focus();
            }
        },

        _inputArrowKeyHandler : function (evt) {
            if (this.props.widgets.indexOf('history') > -1 &&
                    evt.keyCode === 40 && !this.state.historyVisible) {
                this._toggleHistoryWidget();
                evt.stopPropagation();
            }
        },

        _renderInput : function () {
            switch (this.props.queryType) {
                case 'iquery':
                case 'lemma':
                case 'phrase':
                case 'word':
                case 'char':
                    return <input className="simple-input" type="text"
                                ref={item => this._queryInputElement = item}
                                onChange={this._handleInputChange} value={this.state.query}
                                onKeyDown={this._inputArrowKeyHandler} />;
                case 'cql':
                    return <textarea className="cql-input" rows="2" cols="60" name="cql"
                                ref={item => this._queryInputElement = item}
                                onChange={this._handleInputChange} value={this.state.query}
                                onKeyDown={this._inputArrowKeyHandler} />;
            }
        },

        _renderInputOptions : function () {
            switch (this.props.queryType) {
                case 'iquery':
                case 'char':
                    return null;
                case 'lemma':
                    return <LposSelector wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValue}
                                sourceId={this.props.sourceId}
                                actionPrefix={this.props.actionPrefix}  />;
                case 'phrase':
                    return <MatchCaseSelector matchCaseValue={this.props.matchCaseValue}
                                sourceId={this.props.sourceId}
                                actionPrefix={this.props.actionPrefix} />;
                case 'word':
                    return (
                        <span>
                            <LposSelector wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValue}
                                sourceId={this.props.sourceId}
                                actionPrefix={this.props.actionPrefix}  />
                            {'\u00a0'}
                            <MatchCaseSelector matchCaseValue={this.props.matchCaseValue}
                                sourceId={this.props.sourceId}
                                actionPrefix={this.props.actionPrefix} />
                        </span>
                    );
                case 'cql':
                    return (
                        <span className="default-attr-selection">
                            {this.translate('query__default_attr') + ':\u00a0'}
                            <DefaultAttrSelector defaultAttr={this.props.defaultAttr}
                                    forcedAttr={this.props.forcedAttr}
                                    attrList={this.props.attrList}
                                    sourceId={this.props.sourceId}
                                    actionPrefix={this.props.actionPrefix} />{'\u00a0'}
                            {this.props.tagsetDocUrl ?
                                (<span className="tagset-summary">(
                                    <a className="external" target="_blank" href={this.props.tagsetDocUrl}>
                                    {this.translate('query__tagset_summary')}</a>)</span>)
                                : null}
                        </span>
                    );
            }
        },

        _toggleHistoryWidget : function () {
            this.setState({
                query: this.state.query,
                historyVisible: !this.state.historyVisible
            });
        },

        render : function () {
            return (
                <tr>
                    <th>{this.translate('query__query_th')}:</th>
                    <td>
                        <div className="query-area">
                            <QueryToolbox widgets={this.props.widgets}
                                tagHelperView={this.props.tagHelperView}
                                queryStorageView={this.props.queryStorageView}
                                sourceId={this.props.sourceId}
                                toggleHistoryWidget={this._toggleHistoryWidget}
                                inputLanguage={this.props.inputLanguage}
                                actionPrefix={this.props.actionPrefix} />
                            {this._renderInput()}
                            {this.state.historyVisible ?
                                <HistoryWidget
                                        queryStorageView={this.props.queryStorageView}
                                        sourceId={this.props.sourceId}
                                        onCloseTrigger={this._toggleHistoryWidget}
                                        actionPrefix={this.props.actionPrefix}/>
                                : null
                            }
                            <div className="query-hints">
                                <QueryHints actionPrefix={this.props.actionPrefix} />
                            </div>
                        </div>
                        <div className="query-options">
                            {this._renderInputOptions()}
                        </div>
                    </td>
                </tr>
            );
        }

    });


    return {
        TRQueryInputField: TRQueryInputField,
        TRQueryTypeField: TRQueryTypeField,
        TRPcqPosNegField: TRPcqPosNegField
    };

}