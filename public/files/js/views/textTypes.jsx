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


export function init(dispatcher, mixins, textTypesStore) {

    // ----------------------------- <RangeSelector /> --------------------------

    const RangeSelector = React.createClass({

        mixins : mixins,

        _confirmClickHandler : function () {
            dispatcher.dispatch({
                actionType: 'TT_RANGE_BUTTON_CLICKED',
                props: {
                    attrName: this.props.attrName,
                    fromVal: this.state.fromValue ? parseFloat(this.state.fromValue) : null,
                    toVal: this.state.toValue ? parseFloat(this.state.toValue) : null,
                    keepCurrent: this.state.keepCurrent,
                    strictInterval: this.state.intervalBehavior === 'strict'
                }
            });
        },

        _mkInputChangeHandler : function (name) {
            return (evt) => {
                let upd = {};
                if (name !== 'keepCurrent') {
                    upd[name] = {$set: evt.target.value};

                } else {
                    upd[name] = {$set: !this.state.keepCurrent};
                }
                this.setState(React.addons.update(this.state, upd));
            };
        },

        _keyboardHandler : function (evt) {
            if (evt.keyCode === 13) {
                this._confirmClickHandler(evt);
                evt.preventDefault();
            }
        },

        _helpClickHandler : function () {
            this.setState(React.addons.update(this.state, {showHelp: {$set: true}}));
        },

        _helpCloseHandler : function () {
            this.setState(React.addons.update(this.state, {showHelp: {$set: false}}));
        },

        getInitialState : function () {
            return {
                fromValue: null,
                toValue: null,
                keepCurrent: false,
                intervalBehavior: 'strict',
                hasSelectedValues: textTypesStore.hasSelectedItems(this.props.attrName),
                showHelp: false
            };
        },

        render : function () {
            let layoutViews = this.getLayoutViews();
            return (
                <div className="range-selector">
                    <h3>{this.translate('query__tt_define_range')}</h3>
                    <div>
                        <label className="date">
                            {this.translate('query__tt_from')}:{'\u00A0'}
                            <input onChange={this._mkInputChangeHandler('fromValue')}
                                    onKeyDown={this._keyboardHandler}
                                    className="from-value"
                                    type="text" style={{width: '5em'}} />
                        </label>
                        {'\u00A0'}
                        <label className="date">
                            {this.translate('query__tt_to')}:{'\u00A0'}
                            <input onChange={this._mkInputChangeHandler('toValue')}
                                    onKeyDown={this._keyboardHandler}
                                    className="to-value"
                                    type="text" style={{width: '5em'}} />
                        </label>
                    </div>
                    {
                        this.state.hasSelectedValues
                        ? (
                            <label className="keep-current">
                                {this.translate('query__tt_keep_current_selection')}:{'\u00A0'}
                                <input type="checkbox" onChange={this._mkInputChangeHandler('keepCurrent')} />
                            </label>
                        )
                        : null
                    }
                    <div className="interval-switch">
                        <div>
                            <span className="label">
                                {this.translate('query__tt_interval_inclusion_policy')}:{'\u00A0'}
                            </span>
                            <select className="interval-behavior" defaultValue={this.state.intervalBehavior}
                                    onChange={this._mkInputChangeHandler('intervalBehavior')}>
                                <option value="relaxed">{this.translate('query__tt_partial_interval')}</option>
                                <option value="strict">{this.translate('query__tt_strict_interval')}</option>
                            </select>
                            <a className="context-help">
                                <img data-alt-img="../files/img/question-mark_s.svg"
                                    src="../files/img/question-mark.svg"
                                    className="over-img"
                                    onClick={this._helpClickHandler} />
                            </a>
                            {this.state.showHelp
                                ? <layoutViews.PopupBox onCloseClick={this._helpCloseHandler}
                                        status="info" autoSize={true}>
                                        <div>{this.translate('query__tt_range_help_text')}</div>
                                    </layoutViews.PopupBox>
                                : null}
                        </div>
                    </div>
                    <button type="button" className="default-button confirm-range"
                            onClick={this._confirmClickHandler}>{this.translate('query__tt_range_OK')}</button>
                </div>
            );
        }
    });


    // ----------------------------- <CheckboxItem /> --------------------------

    const CheckBoxItem = React.createClass({

        _clickHandler : function () {
            dispatcher.dispatch({
                actionType: 'TT_VALUE_CHECKBOX_CLICKED',
                props: {
                    attrName: this.props.itemName,
                    itemIdx: this.props.itemIdx
                }
            });
        },
        shouldComponentUpdate: function(nextProps, nextState) {
            return this.props.itemValue !== nextProps.itemValue
                    || this.props.itemIsSelected !== nextProps.itemIsSelected
                    || this.props.itemIsLocked !== nextProps.itemIsLocked;
        },
        render : function () {
            const itemName = 'sca_' + this.props.itemName;
            return (
                <label className={this.props.itemIsLocked ? 'locked' : null}>
                    <input
                        type="checkbox"
                        name={itemName}
                        value={this.props.itemValue}
                        className="attr-selector user-selected"
                        checked={this.props.itemIsSelected}
                        onChange={this._clickHandler}
                        disabled={this.props.itemIsLocked}
                    />
                    {this.props.itemIsLocked ?
                        <input type="hidden" name={itemName} value={this.props.itemValue} /> : null }
                    {this.props.itemValue}
                </label>
            );
        }
    });

    // ----------------------------- <ExtendedInfoBox /> --------------------------

    const ExtendedInfoBox = React.createClass({

        mixins : mixins,

        _clickCloseHandler : function () {
            dispatcher.dispatch({
                actionType: 'TT_EXTENDED_INFORMATION_REMOVE_REQUEST',
                props: {
                    attrName: this.props.attrName,
                    idx: this.props.itemIdx
                }
            });
        },

        _renderContent : function () {
            if (this.props.data.has('__message__')) {
                return <div className="message"><p>{this.props.data.get('__message__')}</p></div>;

            } else {
                return (
                    <ul>
                        {this.props.data.entrySeq().map((item) => {
                            return <li key={item[0]}><strong>{item[0]}:</strong>{'\u00A0'}{item[1]}</li>;
                        })}
                    </ul>
                );
            }
        },

        render : function () {
            let layoutViews = this.getLayoutViews();
            return (
                <layoutViews.PopupBox onCloseClick={this._clickCloseHandler}
                            customClass="metadata-detail"
                            customStyle={{marginLeft: '5em'}}>
                    {this._renderContent()}
                </layoutViews.PopupBox>
            );
        }
    });

    // ----------------------------- <ExtendedInfoButton /> ------------------------------

    const ExtendedInfoButton = React.createClass({

        mixins : mixins,

        _mkHandleClick : function (idx) {
            return (evt) => {
                this.setState({isWaiting: true});
                dispatcher.dispatch({
                    actionType: 'TT_EXTENDED_INFORMATION_REQUEST',
                    props: {
                        attrName: this.props.attrName,
                        idx: idx
                    }
                });
            }
        },

        getInitialState : function () {
            return {isWaiting: false};
        },

        _storeChangeHandler : function (store, action) {
            if (this.state.isWaiting && this.props.containsExtendedInfo) {
                this.setState({isWaiting: false});
            }
        },

        componentDidMount : function () {
            textTypesStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            textTypesStore.removeChangeListener(this._storeChangeHandler);
        },

        render : function () {
            if (this.state.isWaiting) {
                return <img src={this.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={this.translate('global__loading')} />;

            } else if (this.props.numGrouped < 2) {
                return <a onClick={this._mkHandleClick(this.props.idx)} className="bib-info">i</a>;

            } else {
                return <a onClick={this._mkHandleClick(this.props.idx)} className="bib-warn">!</a>
            }

        }
    })

    // ----------------------------- <FullListContainer /> --------------------------

    const FullListContainer = React.createClass({

        mixins : mixins,

        _renderListOfCheckBoxes : function () {
            let hasExtendedInfo = textTypesStore.hasDefinedExtendedInfo(this.props.attrObj.name);
            return (
                <table>
                    <tbody>
                    {this.props.attrObj.getValues().map((item, i) => {
                        return (
                            <tr key={item.value + String(i)}>
                                <td><CheckBoxItem
                                        itemIdx={i}
                                        itemName={this.props.attrObj.name}
                                        itemValue={item.value}
                                        itemIsSelected={item.selected}
                                        itemIsLocked={item.locked}
                                            /></td>
                                <td className="num">{item.availItems ? this.formatNumber(item.availItems) : ''}</td>
                                <td className="extended-info">
                                {hasExtendedInfo ?
                                    <ExtendedInfoButton idx={i} attrName={this.props.attrObj.name}
                                            numGrouped={item.numGrouped} containsExtendedInfo={!!item.extendedInfo} />
                                    : null
                                }
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            );
        },

        render : function () {
            return (
                <div>
                    {
                        this.props.rangeIsOn
                        ? <RangeSelector attrName={this.props.attrObj.name} />
                        : this._renderListOfCheckBoxes()
                    }
                </div>
            );
        }
    });

    // ----------------------------- <AutoCompleteBox /> --------------------------

    const AutoCompleteBox = React.createClass({

        _outsideClick : false,

        _handleAutoCompleteHintClick : function (item) {
            if (typeof this.props.customAutoCompleteHintClickHandler === 'function') {
                this.props.customAutoCompleteHintClickHandler(item);

            } else {
                dispatcher.dispatch({
                    actionType: 'TT_ATTRIBUTE_AUTO_COMPLETE_HINT_CLICKED',
                    props: {
                        attrName: this.props.attrObj.name,
                        ident: item.ident,
                        label: item.label,
                        append: false
                    }
                });
            }
        },

        _handleDocumentClick : function (event) {
            if (event.eventPhase === Event.CAPTURING_PHASE) {
                this._outsideClick = true;

            } else if (event.eventPhase === Event.BUBBLING_PHASE) {
                if (this._outsideClick) {
                    dispatcher.dispatch({
                        actionType: 'TT_ATTRIBUTE_AUTO_COMPLETE_RESET',
                        props: {
                            attrName: this.props.attrObj.name
                        }
                    });
                    this._outsideClick = false;
                }
            }
        },

        _handleAutoCompleteAreaClick : function (event) {
            this._outsideClick = false;
        },

        componentDidMount : function () {
            window.document.addEventListener('click', this._handleDocumentClick, true);
            window.document.addEventListener('click', this._handleDocumentClick, false);
        },

        componentWillUnmount : function () {
            window.document.removeEventListener('click', this._handleDocumentClick, true);
            window.document.removeEventListener('click', this._handleDocumentClick, false);
        },

        render : function () {
            let data = this.props.attrObj.getAutoComplete();
            return (
                <ul className="auto-complete"
                    onClick={this._handleAutoCompleteAreaClick}>
                {data.map((item) => {
                    return (
                        <li key={item.ident}>
                            <a onClick={this._handleAutoCompleteHintClick.bind(this, item)}>
                                {item.label}
                            </a>
                        </li>
                    );
                })}
                </ul>
            );
        }
    });

    // ----------------------------- <RawInputContainer /> --------------------------

    const RawInputContainer = React.createClass({

        throttlingTimer : null,

        _inputChangeHandler : function (evt) {
            let v = evt.target.value;

            dispatcher.dispatch({
                actionType: 'TT_ATTRIBUTE_TEXT_INPUT_CHANGED',
                props: {
                    attrName: this.props.attrObj.name,
                    value: v
                }
            });

            if (this.throttlingTimer) {
                window.clearTimeout(this.throttlingTimer);
            }
            this.throttlingTimer = window.setTimeout(() => {
                dispatcher.dispatch({
                    actionType: 'TT_ATTRIBUTE_TEXT_INPUT_AUTOCOMPLETE_REQUEST',
                    props: {
                        attrName: this.props.attrObj.name,
                        value: v
                    }
                });
            }, 300);
        },

        _renderAutoComplete : function () {
            if (this.props.attrObj.getAutoComplete().size > 0) {
                return <AutoCompleteBox attrObj={this.props.attrObj}
                                customAutoCompleteHintClickHandler={this.props.customAutoCompleteHintClickHandler} />;

            } else {
                return null;
            }
        },

        render : function () {
            return (
                <table>
                    <tbody>
                        <tr>
                            <td>
                                <input type="text"
                                    name={this.props.customInputName
                                            ? this.props.customInputName
                                            : 'sca_' + this.props.attrObj.name}
                                    onChange={this._inputChangeHandler}
                                    value={this.props.attrObj.getTextFieldValue()}
                                    placeholder={textTypesStore.getTextInputPlaceholder()}
                                    autoComplete="off" />
                                {this._renderAutoComplete()}
                            </td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    });

    // ----------------------------- <RawInputMultiValueContainer /> --------------------------

    const RawInputMultiValueContainer = React.createClass({

        _handleAutoCompleteHintClick : function (item) { // typeof item = TextTypes.AutoCompleteItem
            dispatcher.dispatch({
                actionType: 'TT_ATTRIBUTE_AUTO_COMPLETE_HINT_CLICKED',
                props: {
                    attrName: this.props.attrObj.name,
                    ident: item.ident,
                    label: item.label,
                    append: true
                }
            });
        },

        _renderCheckboxes : function () {
            let values = this.props.attrObj.getValues();
            let hasExtendedInfo = textTypesStore.hasDefinedExtendedInfo(this.props.attrObj.name);
            return values.map((item, i) => {
                return (
                    <tr key={item.value + String(i)}>
                        <td>
                            <CheckBoxItem
                                    itemIdx={i}
                                    itemName={this.props.attrObj.name}
                                    itemValue={item.value}
                                    itemIsSelected={item.selected}
                                    itemIsLocked={item.locked}
                                        />
                        </td>
                        <td>
                            {hasExtendedInfo
                                ? <ExtendedInfoButton idx={i} attrName={this.props.attrObj.name}
                                        numGrouped={item.numGrouped}
                                        containsExtendedInfo={!!item.extendedInfo} />
                                : null }
                        </td>
                    </tr>
                );
            });
        },

        render : function () {
            return (
                <div>
                    <table>
                        <tbody>
                            {this._renderCheckboxes()}
                        </tbody>
                    </table>
                    <RawInputContainer attrObj={this.props.attrObj}
                                        isLocked={this.props.isLocked}
                                        inputTextOnChange={this.props.inputTextOnChange}
                                        customInputName={null}
                                        customAutoCompleteHintClickHandler={this._handleAutoCompleteHintClick} />
                </div>
            );
        }
    });

    // ----------------------------- <ValueSelector /> --------------------------

    const ValueSelector = React.createClass({

        render : function () {
            return (
                <div className="scrollable">
                {this.props.attrObj.containsFullList() || this.props.rangeIsOn
                    ? <FullListContainer attrObj={this.props.attrObj} rangeIsOn={this.props.rangeIsOn}
                            isLocked={this.props.isLocked} />
                    : <RawInputMultiValueContainer
                            attrObj={this.props.attrObj}
                            isLocked={this.props.isLocked}
                            inputTextOnChange={this.props.inputTextOnChange} />
                }
                </div>
            );
        }
    });

    // ----------------------------- <TableTextTypeAttribute /> --------------------------

    const TableTextTypeAttribute = React.createClass({

        mixins : mixins,

        _renderModeSwitch : function (obj) {
            if (this.props.attrObj.isInterval) {
                let label = this.props.rangeIsOn
                    ? this.translate('query__tt_select_individual')
                    : this.translate('query__tt_select_range');
                return (
                    <td>
                        <a className="util-button" onClick={this._intervalModeSwitchHandler}>{label}</a>
                    </td>
                );
            }
            return null;
        },

        _selectAllHandler : function () {
            dispatcher.dispatch({
                actionType: 'TT_SELECT_ALL_CHECKBOX_CLICKED',
                props: {
                    attrName: this.props.attrObj.name
                }
            });
        },

        _intervalModeSwitchHandler : function () {
            dispatcher.dispatch({
                actionType: 'TT_TOGGLE_RANGE_MODE',
                props: {
                    attrName: this.props.attrObj.name
                }
            });
        },

        _renderFooter : function () {
            if (this.props.attrObj.containsFullList() && !this.props.attrObj.isLocked()) {
                return (
                    <label className="select-all" style={{display: 'inline-block'}}>
                        <input type="checkbox" className="select-all" onClick={this._selectAllHandler} />
                        {this.translate('global__select_all')}
                        </label>
                );

            } else {
                return null;
            }
        },

        _metaInfoHelpClickHandler : function () {
            this.setState({metaInfoHelpVisible: true});
        },

        _helpCloseHandler : function () {
            this.setState({metaInfoHelpVisible: false});
        },

        _renderMetaInfo : function () {
            let layoutViews = this.getLayoutViews();
            let metaInfo = textTypesStore.getAttrSummary().get(this.props.attrObj.name);
            if (metaInfo) {
                return (
                    <span>
                        {metaInfo.text}
                        {'\u00A0'}
                        <a className="context-help" onClick={this._metaInfoHelpClickHandler}>
                            <img src={this.createStaticUrl('img/question-mark.svg')} className="over-img" />
                        </a>
                        {this.state.metaInfoHelpVisible
                            ? (<layoutViews.PopupBox onCloseClick={this._helpCloseHandler} status="info" autoSize={true}>
                                {metaInfo.help}
                                </layoutViews.PopupBox>)
                            : null}
                    </span>
                );

            } else {
                return null;
            }
        },

        getInitialState : function () {
            return {
                metaInfoHelpVisible: false
            };
        },

        shouldComponentUpdate : function (nextProps, nextState) {
            return this.props.attrObj !== nextProps.attrObj
                    || this.props.rangeIsOn !== nextProps.rangeIsOn
                    || this.state.metaInfoHelpVisible !== nextState.metaInfoHelpVisible;
        },

        _renderExtendedInfo : function () {
            const srch = this.props.attrObj.getValues().findEntry(item => !!item.extendedInfo);
            if (srch) {
                const [srchIdx, item] = srch;
                return <ExtendedInfoBox data={item.extendedInfo} itemIdx={srchIdx}
                                attrName={this.props.attrObj.name} />;

            } else {
                return null;
            }
        },

        render : function () {
            let classes = ['envelope'];
            if (this.props.attrObj.isLocked()) {
                classes.push('locked');
            }
            return (
                <table className={classes.join(' ')}>
                    <tbody>
                        <tr className="attrib-name">
                            <th>{this.props.attrObj.name}</th>
                        </tr>
                        <tr>
                            <td>
                                {this._renderExtendedInfo()}
                            </td>
                        </tr>
                        <tr className={this.props.rangeIsOn ? 'range' : 'data-rows'}>
                            <td>
                                <ValueSelector attrObj={this.props.attrObj}
                                        rangeIsOn={this.props.rangeIsOn}
                                        isLocked={this.props.attrObj.isLocked()}  />
                            </td>
                        </tr>
                        <tr className="metadata">
                            <td>
                                {this._renderMetaInfo()}
                            </td>
                        </tr>
                        <tr className="define-range">
                            {!this.props.attrObj.isLocked() ? this._renderModeSwitch() : null}
                        </tr>
                        <tr className="last-line">
                            <td>
                                {this._renderFooter()}
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    });

    // ----------------------------- <TextTypesPanel /> --------------------------

    const TextTypesPanel = React.createClass({
        mixins: mixins,

        _storeChangeHandler : function (store, action) {
            this.setState({
                attributes: textTypesStore.getAttributes(),
                rangeModes: textTypesStore.getRangeModes()
            });
        },

        componentDidMount: function () {
            textTypesStore.addChangeListener(this._storeChangeHandler);
            if (typeof this.props.onReady === 'function') {
                this.props.onReady();
            }
        },

        componentWillUnmount: function () {
            textTypesStore.removeChangeListener(this._storeChangeHandler);
        },

        getInitialState : function () {
            return {
                attributes: textTypesStore.getAttributes(),
                rangeModes: textTypesStore.getRangeModes()
            };
        },

        render : function () {
            return (
                <div>
                    <div className="plugin-controls">
                    {this.props.liveAttrsView
                        ? <this.props.liveAttrsView />
                        : null}
                    </div>
                    <div className="text-type-top-bar">
                    </div>
                    <div className="text-types-selection">
                        {this.props.liveAttrsCustomTT
                            ? <this.props.liveAttrsCustomTT alignedCorpora={this.props.alignedCorpora} />
                            : null}
                        {this.state.attributes.map((attrObj) => {
                            return <TableTextTypeAttribute key={attrObj.name + ':list:' + attrObj.containsFullList()}
                                        attrObj={attrObj} rangeIsOn={this.state.rangeModes.get(attrObj.name)} />;
                        })}
                    </div>
                </div>
            );
        }
    });

    return {
        TextTypesPanel: TextTypesPanel
    };

}