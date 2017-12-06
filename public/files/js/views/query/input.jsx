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

/// <reference path="../../vendor.d.ts/react.d.ts" />

import * as React from 'vendor/react';
import {init as keyboardInit} from './keyboard';


export function init(dispatcher, he, queryStore, queryHintStore, withinBuilderStore, virtualKeyboardStore) {

    const keyboardViews = keyboardInit(dispatcher, he, queryStore, virtualKeyboardStore);
    const layoutViews = he.getLayoutViews();


    // -------------- <QueryHints /> --------------------------------------------

    class QueryHints extends React.Component {

        constructor(props) {
            super(props);
            this._changeListener = this._changeListener.bind(this);
            this._clickHandler = this._clickHandler.bind(this);
            this.state = {hintText: queryHintStore.getHint()};
        }

        _changeListener() {
            this.setState({hintText: queryHintStore.getHint()});
        }

        _clickHandler() {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'NEXT_QUERY_HINT',
                props: {}
            });
        }

        componentDidMount() {
            queryHintStore.addChangeListener(this._changeListener);
        }

        componentWillUnmount() {
            queryHintStore.removeChangeListener(this._changeListener);
        }

        render() {
            return (
                <div>
                    <span className="hint">{this.state.hintText}</span>
                    <span className="next-hint">
                        (<a onClick={this._clickHandler}>{he.translate('global__next_tip')}</a>)
                    </span>
                </div>
            );
        }
    }

    // ------------------- <QueryTypeHints /> -----------------------------

    class QueryTypeHints extends React.Component {

        constructor(props) {
            super(props);
            this.state = {visible: false};
            this._handleHintClick = this._handleHintClick.bind(this);
        }

        _handleHintClick() {
            this.setState({visible: !this.state.visible});
        }

        _getHintText() {
            switch (this.props.queryType) {
                case 'iquery':
                return [he.translate('query__qt_basic'), he.translate('query__type_hint_basic')];
                case 'lemma':
                return [he.translate('query__qt_lemma'), he.translate('query__type_hint_lemma')];
                case 'phrase':
                return [he.translate('query__qt_phrase'), he.translate('query__type_hint_phrase')];
                case 'word':
                return [he.translate('query__qt_word_form'), he.translate('query__type_hint_word')];
                case 'char':
                return [he.translate('query__qt_word_part'), he.translate('query__type_hint_char')];
                case 'cql':
                return [he.translate('query__qt_cql'), he.translate('query__type_hint_cql')];
            }
        }

        render() {
            const [heading, text] = this._getHintText();
            return (
                <span>
                    <sup className="hint" onClick={this._handleHintClick}>
                        <a>
                            <img src={he.createStaticUrl('img/question-mark.svg')}
                                alt={he.translate('global__info_icon')} />
                        </a>
                    </sup>
                    {this.state.visible ?
                        <layoutViews.PopupBox onCloseClick={this._handleHintClick} takeFocus={true} customClass="hint">
                            <div>
                                <h3>{he.translate('query__select_type')} <span className="type">"{heading}"</span></h3>
                                <p>{text}</p>
                            </div>
                        </layoutViews.PopupBox> :
                        null
                    }
                </span>
            );
        }
    }


    // ------------------- <TRQueryTypeField /> -----------------------------

    const TRQueryTypeField = (props) => {
        const handleSelection = (evt) => {
            dispatcher.dispatch({
                actionType: props.actionPrefix + 'QUERY_INPUT_SELECT_TYPE',
                props: {
                    sourceId: props.sourceId,
                    queryType: evt.target.value
                }
            });
        };

        return (
            <tr className="TRQueryTypeField">
                <th>{he.translate('query__select_type')}:</th>
                <td>
                    <select value={props.queryType} onChange={handleSelection}>
                        <option value="iquery">{he.translate('query__qt_basic')}</option>
                        {props.hasLemmaAttr ? <option value="lemma">{he.translate('query__qt_lemma')}</option> : null}
                        <option value="phrase">{he.translate('query__qt_phrase')}</option>
                        <option value="word">{he.translate('query__qt_word_form')}</option>
                        <option value="char">{he.translate('query__qt_word_part')}</option>
                        <option value="cql">{he.translate('query__qt_cql')}</option>
                    </select>
                    <QueryTypeHints queryType={props.queryType} />
                </td>
            </tr>
        );
    };

    // ------------------- <TRPcqPosNegField /> -----------------------------

    const TRPcqPosNegField = (props) => {

        const handleSelectChange = (evt) => {
            dispatcher.dispatch({
                actionType: props.actionPrefix + 'QUERY_INPUT_SET_PCQ_POS_NEG',
                props: {
                    corpname: props.sourceId,
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th />
                <td>
                    <select value={props.value} onChange={handleSelectChange}>
                        <option value="pos">{he.translate('query__align_contains')}</option>
                        <option value="neg">{he.translate('query__align_not_contains')}</option>
                    </select>
                </td>
            </tr>
        );
    };

    // ------------------- <TagWidget /> --------------------------------

    const TagWidget = (props) => {

        return (
            <layoutViews.PopupBox
                    onCloseClick={props.closeClickHandler}
                    customClass="tag-builder-widget"
                    customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}>
                <props.tagHelperView
                        sourceId={props.sourceId}
                        onInsert={props.closeClickHandler}
                        onEscKey={props.closeClickHandler}
                        actionPrefix={props.actionPrefix} />
            </layoutViews.PopupBox>
        );
    };

    // ------------------- <WithinWidget /> --------------------------------

    class WithinWidget extends React.Component {

        constructor(props) {
            super(props);
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._handleInputChange = this._handleInputChange.bind(this);
            this._handleKeyDown = this._handleKeyDown.bind(this);
            this._handleAttrChange = this._handleAttrChange.bind(this);
            this._handleInsert = this._handleInsert.bind(this);
            this.state = {
                data: withinBuilderStore.getData(),
                query: withinBuilderStore.getQuery(),
                attr: withinBuilderStore.getCurrAttrIdx(),
                exportedQuery: withinBuilderStore.exportQuery()
            };
        }

        _handleStoreChange() {
            this.setState({
                data: withinBuilderStore.getData(),
                query: withinBuilderStore.getQuery(),
                attr: withinBuilderStore.getCurrAttrIdx(),
                exportedQuery: withinBuilderStore.exportQuery()
            });
        }

        _handleInputChange(evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_WITHIN_VALUE',
                props: {
                    value: evt.target.value
                }
            });
        }

        _handleKeyDown(evt) {
            if (evt.keyCode === 27) {
                evt.stopPropagation();
                evt.preventDefault();
                this.props.closeClickHandler();
            }
        }

        _handleAttrChange(evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_WITHIN_ATTR',
                props: {
                    idx: evt.target.value
                }
            });
        }

        _handleInsert() {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'QUERY_INPUT_APPEND_QUERY',
                props: {
                    sourceId: this.props.sourceId,
                    query: this.state.exportedQuery,
                    prependSpace: true,
                    closeWhenDone: true
                }
            });
        }

        componentDidMount() {
            withinBuilderStore.addChangeListener(this._handleStoreChange);
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_LOAD_WITHIN_BUILDER_DATA',
                props: {
                    sourceId: this.props.sourceId
                }
            });
        }

        componentWillUnmount() {
            withinBuilderStore.removeChangeListener(this._handleStoreChange);
        }

        render() {
            return (
                <layoutViews.PopupBox
                        onCloseClick={this.props.closeClickHandler}
                        customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}>
                    <div onKeyDown={this._handleKeyDown}>
                        <h3>{he.translate('query__create_within')}</h3>
                        <div className="within-widget">
                            <select onChange={this._handleAttrChange} value={this.state.attr}>
                                {this.state.data.map((item, i) => {
                                    return <option key={item} value={i}>{`${item[0]}.${item[1]}`}</option>;
                                })}
                            </select>
                            {'\u00a0'}={'\u00a0'}
                            <input type="text" value={this.state.query} onChange={this._handleInputChange}
                                    ref={item => item ? item.focus() : null} />
                            {'\u00a0'}
                        </div>
                        <p>
                            <button type="button" className="util-button"
                                    onClick={this._handleInsert}>
                                {he.translate('query__insert_within')}
                            </button>
                        </p>
                    </div>
                </layoutViews.PopupBox>
            );
        }
    }

    // ------------------- <HistoryWidget /> -----------------------------

    const HistoryWidget = (props) => {

        return (
            <div className="history-widget">
                <props.queryStorageView
                        sourceId={props.sourceId}
                        onCloseTrigger={props.onCloseTrigger}
                        actionPrefix={props.actionPrefix} />
            </div>
        );
    };

    // ------------------- <KeyboardWidget /> --------------------------------

    const KeyboardWidget = (props) => {

        const keyHandler = (evt) => {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_HIT_VIRTUAL_KEYBOARD_KEY',
                props: {
                    keyCode: evt.keyCode
                }
            });
        };

        return (
            <layoutViews.PopupBox
                    onCloseClick={props.closeClickHandler}
                    customStyle={{marginTop: '3.5em'}}
                    takeFocus={true}
                    keyPressHandler={keyHandler}>
                <keyboardViews.Keyboard sourceId={props.sourceId}
                        inputLanguage={props.inputLanguage}
                        actionPrefix={props.actionPrefix} />
            </layoutViews.PopupBox>
        );
    };

    // ------------------- <QueryToolbox /> -----------------------------

    class QueryToolbox extends React.Component {

        constructor(props) {
            super(props);
            this._handleWidgetTrigger = this._handleWidgetTrigger.bind(this);
            this._handleHistoryWidget = this._handleHistoryWidget.bind(this);
            this._handleCloseWidget = this._handleCloseWidget.bind(this);
            this._handleQueryStoreChange = this._handleQueryStoreChange.bind(this);
            this.state = {activeWidget: queryStore.getActiveWidget(this.props.sourceId)};
        }

        _renderButtons() {
            const ans = [];

            if (this.props.widgets.indexOf('tag') > -1) {
                ans.push(<a onClick={this._handleWidgetTrigger.bind(this, 'tag')}>{he.translate('query__insert_tag_btn_link')}</a>);
            }
            if (this.props.widgets.indexOf('within') > -1) {
                ans.push(<a onClick={this._handleWidgetTrigger.bind(this, 'within')}>{he.translate('query__insert_within_link')}</a>);
            }
            if (this.props.widgets.indexOf('keyboard') > -1) {
                ans.push(<a onClick={this._handleWidgetTrigger.bind(this, 'keyboard')}>{he.translate('query__keyboard_link')}</a>);
            }
            if (this.props.widgets.indexOf('history') > -1) {
                ans.push(<a onClick={this._handleHistoryWidget}>{he.translate('query__recent_queries_link')}</a>);
            }
            return ans;
        }

        _handleWidgetTrigger(name) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_ACTIVE_WIDGET',
                props: {
                    sourceId: this.props.sourceId,
                    value: name
                }
            });
        }

        _handleHistoryWidget() {
            this.setState({activeWidget: null});
            this.props.toggleHistoryWidget();
        }

        _handleCloseWidget() {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_ACTIVE_WIDGET',
                props: {
                    sourceId: this.props.sourceId,
                    value: null
                }
            });
        }

        _renderWidget() {
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
        }

        _handleQueryStoreChange() {
            this.setState({activeWidget: queryStore.getActiveWidget(this.props.sourceId)});
        }

        componentDidMount() {
            queryStore.addChangeListener(this._handleQueryStoreChange);
        }

        componentWillUnmount() {
            queryStore.removeChangeListener(this._handleQueryStoreChange);
        }

        render() {
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
    }

    // ------------------- <LposSelector /> -----------------------------

    const LposSelector = (props) => {

        const handleLposChange = (evt) => {
            dispatcher.dispatch({
                actionType: props.actionPrefix + 'QUERY_INPUT_SET_LPOS',
                props: {
                    sourceId: props.sourceId,
                    lpos: evt.target.value
                }
            });
        };

        return (
            <span>
                {he.translate('query__pos')}:{'\u00a0'}
                <select onChange={handleLposChange} value={props.lposValue}>
                    <option value="">{he.translate('query__not_specified')}</option>
                    {props.wPoSList.map(item => {
                        return <option key={item.v} value={item.v}>{item.n}</option>;
                    })}
                </select>
            </span>
        );
    };

    // ------------------- <MatchCaseSelector /> -----------------------------

    const MatchCaseSelector = (props) => {

        const handleCheckbox = (evt) => {
            dispatcher.dispatch({
                actionType: props.actionPrefix + 'QUERY_INPUT_SET_MATCH_CASE',
                props: {
                    sourceId: props.sourceId,
                    value: !props.matchCaseValue
                }
            });
        };

        return (
            <label>
                {he.translate('query__match_case')}:{'\u00a0'}
                <input type="checkbox" name="qmcase" value="1" checked={props.matchCaseValue}
                    onChange={handleCheckbox} />
            </label>
        );
    };

    // ------------------- <DefaultAttrSelector /> -----------------------------

    const DefaultAttrSelector = (props) => {

        const handleSelectChange = (evt) => {
            dispatcher.dispatch({
                actionType: props.actionPrefix + 'QUERY_INPUT_SET_DEFAULT_ATTR',
                props: {
                    sourceId: props.sourceId,
                    value: evt.target.value
                }
            });
        };

        if (props.forcedAttr) {
            return (
                <select disabled="disabled" title={he.translate('query__implicit_attr_cannot_be_changed')}>
                    <option>{props.forcedAttr}</option>
                </select>
            );

        } else {
            return (
                <select value={props.defaultAttr} onChange={handleSelectChange}>
                    {props.attrList.map(item => {
                        return <option key={item.n} value={item.n}>{item.label}</option>;
                    })}
                </select>
            );
        }
    };

    // ------------------- <TRQueryInputField /> -----------------------------

    class TRQueryInputField extends React.Component {

        constructor(props) {
            super(props);
            this._queryInputElement = null;
            this._handleInputChange = this._handleInputChange.bind(this);
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._inputKeyHandler = this._inputKeyHandler.bind(this);
            this._toggleHistoryWidget = this._toggleHistoryWidget.bind(this);
            this.state = {
                query: queryStore.getQuery(this.props.sourceId),
                historyVisible: false
            };
        }

        _handleInputChange(evt) {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'QUERY_INPUT_SET_QUERY',
                props: {
                    sourceId: this.props.sourceId,
                    query: evt.target.value
                }
            });
        }

        _handleStoreChange(store, action) {
            this.setState({
                query: queryStore.getQuery(this.props.sourceId),
                historyVisible: false
            });
        }

        _inputKeyHandler(evt) {
            if (this.props.widgets.indexOf('history') > -1 &&
                    evt.keyCode === 40 && !this.state.historyVisible) {
                this._toggleHistoryWidget();
                evt.stopPropagation();

            } else if (evt.keyCode === 13 && !evt.shiftKey) {
                this.props.onEnterKey();
                evt.stopPropagation();
                evt.preventDefault();
            }
        }

        _toggleHistoryWidget() {
            this.setState({
                query: this.state.query,
                historyVisible: !this.state.historyVisible
            });
        }

        componentDidMount() {
            queryStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            queryStore.removeChangeListener(this._handleStoreChange);
        }

        componentDidUpdate(prevProps, prevState) {
            if (this._queryInputElement
                    && prevState.historyVisible && !this.state.historyVisible) {
                this._queryInputElement.focus();
            }
        }

        _renderInput() {
            switch (this.props.queryType) {
                case 'iquery':
                case 'lemma':
                case 'phrase':
                case 'word':
                case 'char':
                    return <input className="simple-input" type="text"
                                ref={item => this._queryInputElement = item}
                                onChange={this._handleInputChange} value={this.state.query}
                                onKeyDown={this._inputKeyHandler} />;
                case 'cql':
                    return <textarea className="cql-input" rows="2" cols="60" name="cql"
                                ref={item => this._queryInputElement = item}
                                onChange={this._handleInputChange} value={this.state.query}
                                onKeyDown={this._inputKeyHandler} />;
            }
        }

        _renderInputOptions() {
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
                            {he.translate('query__default_attr') + ':\u00a0'}
                            <DefaultAttrSelector defaultAttr={this.props.defaultAttr}
                                    forcedAttr={this.props.forcedAttr}
                                    attrList={this.props.attrList}
                                    sourceId={this.props.sourceId}
                                    actionPrefix={this.props.actionPrefix} />{'\u00a0'}
                            {this.props.tagsetDocUrl ?
                                (<span className="tagset-summary">(
                                    <a className="external" target="_blank" href={this.props.tagsetDocUrl}>
                                    {he.translate('query__tagset_summary')}</a>)</span>)
                                : null}
                        </span>
                    );
            }
        }

        render() {
            return (
                <tr>
                    <th>{he.translate('query__query_th')}:</th>
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
    }


    return {
        TRQueryInputField: TRQueryInputField,
        TRQueryTypeField: TRQueryTypeField,
        TRPcqPosNegField: TRPcqPosNegField
    };

}