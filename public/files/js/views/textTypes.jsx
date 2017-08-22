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

import * as React from 'vendor/react';


export function init(dispatcher, mixins, textTypesStore) {

    const he = mixins[0];
    const layoutViews = he.getLayoutViews();

    // ----------------------------- <RangeSelector /> --------------------------

    class RangeSelector extends React.Component {

        constructor(props) {
            super(props);
            this._confirmClickHandler = this._confirmClickHandler.bind(this);
            this._mkInputChangeHandler = this._mkInputChangeHandler.bind(this);
            this._keyboardHandler = this._keyboardHandler.bind(this);
            this._helpClickHandler = this._helpClickHandler.bind(this);
            this._helpCloseHandler = this._helpCloseHandler.bind(this);
            this.state = {
                fromValue: null,
                toValue: null,
                keepCurrent: false,
                intervalBehavior: 'strict',
                hasSelectedValues: textTypesStore.hasSelectedItems(this.props.attrName),
                showHelp: false
            };
        }

        _confirmClickHandler() {
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
        }

        _mkInputChangeHandler(name) {
            return (evt) => {
                let upd = {};
                if (name !== 'keepCurrent') {
                    upd[name] = {$set: evt.target.value};

                } else {
                    upd[name] = {$set: !this.state.keepCurrent};
                }
                this.setState(React.addons.update(this.state, upd));
            };
        }

        _keyboardHandler(evt) {
            if (evt.keyCode === 13) {
                this._confirmClickHandler(evt);
                evt.preventDefault();
            }
        }

        _helpClickHandler() {
            const newState = he.cloneState(this.state);
            newState.showHelp = true;
            this.setState(newState);
        }

        _helpCloseHandler() {
            const newState = he.cloneState(this.state);
            newState.showHelp = false;
            this.setState(newState);
        }

        render() {
            return (
                <div className="range-selector">
                    <h3>{he.translate('query__tt_define_range')}</h3>
                    <div>
                        <label className="date">
                            {he.translate('query__tt_from')}:{'\u00A0'}
                            <input onChange={this._mkInputChangeHandler('fromValue')}
                                    onKeyDown={this._keyboardHandler}
                                    className="from-value"
                                    type="text" style={{width: '5em'}} />
                        </label>
                        {'\u00A0'}
                        <label className="date">
                            {he.translate('query__tt_to')}:{'\u00A0'}
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
                                {he.translate('query__tt_keep_current_selection')}:{'\u00A0'}
                                <input type="checkbox" onChange={this._mkInputChangeHandler('keepCurrent')} />
                            </label>
                        )
                        : null
                    }
                    <div className="interval-switch">
                        <div>
                            <span className="label">
                                {he.translate('query__tt_interval_inclusion_policy')}:{'\u00A0'}
                            </span>
                            <select className="interval-behavior" defaultValue={this.state.intervalBehavior}
                                    onChange={this._mkInputChangeHandler('intervalBehavior')}>
                                <option value="relaxed">{he.translate('query__tt_partial_interval')}</option>
                                <option value="strict">{he.translate('query__tt_strict_interval')}</option>
                            </select>
                            <a className="context-help">
                                <layoutViews.ImgWithMouseover
                                     src={he.createStaticUrl('img/question-mark.svg')}
                                     htmlClass="over-img"
                                     clickHandler={this._helpClickHandler} />
                            </a>
                            {this.state.showHelp
                                ? <layoutViews.PopupBox onCloseClick={this._helpCloseHandler}
                                        status="info" autoSize={true}>
                                        <div>{he.translate('query__tt_range_help_text')}</div>
                                    </layoutViews.PopupBox>
                                : null}
                        </div>
                    </div>
                    <button type="button" className="default-button confirm-range"
                            onClick={this._confirmClickHandler}>{he.translate('query__tt_range_OK')}</button>
                </div>
            );
        }
    }


    // ----------------------------- <CheckboxItem /> --------------------------

    class CheckBoxItem extends React.Component {

        constructor(props) {
            super(props);
            this._clickHandler = this._clickHandler.bind(this);
        }

        _clickHandler() {
            dispatcher.dispatch({
                actionType: 'TT_VALUE_CHECKBOX_CLICKED',
                props: {
                    attrName: this.props.itemName,
                    itemIdx: this.props.itemIdx
                }
            });
        }

        shouldComponentUpdate(nextProps, nextState) {
            return this.props.itemValue !== nextProps.itemValue ||
                    this.props.itemIsSelected !== nextProps.itemIsSelected ||
                    this.props.itemIsLocked !== nextProps.itemIsLocked;
        }

        render() {
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
    }

    // ----------------------------- <ExtendedInfoBox /> --------------------------

    const ExtendedInfoBox = (props) => {

        const clickCloseHandler = () => {
            dispatcher.dispatch({
                actionType: 'TT_EXTENDED_INFORMATION_REMOVE_REQUEST',
                props: {
                    attrName: props.attrName,
                    ident: props.ident
                }
            });
        };

        const renderContent = () => {
            if (props.data.has('__message__')) {
                return <div className="message"><p>{props.data.get('__message__')}</p></div>;

            } else {
                return (
                    <ul>
                        {props.data.entrySeq().map((item) => {
                            return <li key={item[0]}><strong>{item[0]}:</strong>{'\u00A0'}{item[1]}</li>;
                        })}
                    </ul>
                );
            }
        };

        return (
            <layoutViews.PopupBox onCloseClick={clickCloseHandler}
                        customClass="metadata-detail"
                        customStyle={{marginLeft: '5em'}}>
                {renderContent()}
            </layoutViews.PopupBox>
        );
    };

    // ----------------------------- <ExtendedInfoButton /> ------------------------------

    class ExtendedInfoButton extends React.Component {

        constructor(props) {
            super(props);
            this._storeChangeHandler = this._storeChangeHandler.bind(this);
            this.state = {isWaiting: false};
        }

        _mkHandleClick(idx) {
            return (evt) => {
                this.setState({isWaiting: true});
                dispatcher.dispatch({
                    actionType: 'TT_EXTENDED_INFORMATION_REQUEST',
                    props: {
                        attrName: this.props.attrName,
                        ident: this.props.ident
                    }
                });
            }
        }

        _storeChangeHandler(store, action) {
            if (this.state.isWaiting && this.props.containsExtendedInfo) {
                this.setState({isWaiting: textTypesStore.isBusy()});
            }
        }

        componentDidMount() {
            textTypesStore.addChangeListener(this._storeChangeHandler);
        }

        componentWillUnmount() {
            textTypesStore.removeChangeListener(this._storeChangeHandler);
        }

        render() {
            if (this.state.isWaiting) {
                return <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={he.translate('global__loading')} />;

            } else if (this.props.numGrouped < 2) {
                return <a onClick={this._mkHandleClick(this.props.idx)} className="bib-info">i</a>;

            } else {
                return <a onClick={this._mkHandleClick(this.props.idx)} className="bib-warn">!</a>
            }

        }
    }

    // ----------------------------- <FullListContainer /> --------------------------

    const FullListContainer = (props) => {

        const renderListOfCheckBoxes = () => {
            return (
                <table>
                    <tbody>
                    {props.attrObj.getValues().map((item, i) => {
                        return (
                            <tr key={item.value + String(i)}>
                                <td><CheckBoxItem
                                        itemIdx={i}
                                        itemName={props.attrObj.name}
                                        itemValue={item.value}
                                        itemIsSelected={item.selected}
                                        itemIsLocked={item.locked}
                                            /></td>
                                <td className="num">{item.availItems ? he.formatNumber(item.availItems) : ''}</td>
                                <td className="extended-info">
                                {props.hasExtendedInfo ?
                                    <ExtendedInfoButton ident={item.ident} attrName={props.attrObj.name}
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
        };

        return (
            <div>
                {
                    props.rangeIsOn ? <RangeSelector attrName={props.attrObj.name} /> :
                        renderListOfCheckBoxes()
                }
            </div>
        );
    };

    // ----------------------------- <AutoCompleteBox /> --------------------------

    class AutoCompleteBox extends React.Component {

        constructor(props) {
            super(props);
            this._outsideClick = false;
            this._handleAutoCompleteHintClick = this._handleAutoCompleteHintClick.bind(this);
            this._handleDocumentClick = this._handleDocumentClick.bind(this);
            this._handleAutoCompleteAreaClick = this._handleAutoCompleteAreaClick.bind(this);
        }

        _handleAutoCompleteHintClick(item) {
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
        }

        _handleDocumentClick(event) {
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
        }

        _handleAutoCompleteAreaClick(event) {
            this._outsideClick = false;
        }

        componentDidMount() {
            window.document.addEventListener('click', this._handleDocumentClick, true);
            window.document.addEventListener('click', this._handleDocumentClick, false);
        }

        componentWillUnmount() {
            window.document.removeEventListener('click', this._handleDocumentClick, true);
            window.document.removeEventListener('click', this._handleDocumentClick, false);
        }

        render() {
            let data = this.props.attrObj.getAutoComplete();
            return (
                <ul className="auto-complete"
                    onClick={this._handleAutoCompleteAreaClick}>
                {data.map((item) => {
                    return (
                        <li key={item.ident}>
                            <a onClick={()=>this._handleAutoCompleteHintClick(item)}>
                                {item.label}
                            </a>
                        </li>
                    );
                })}
                </ul>
            );
        }
    }

    // ----------------------------- <RawInputContainer /> --------------------------

    class RawInputContainer extends React.Component {

        constructor(props) {
            super(props);
            this.throttlingTimer = null;
            this._throttlingIntervalMs = 300;
            this._inputChangeHandler = this._inputChangeHandler.bind(this);
        }

        _inputChangeHandler(evt) {
            const v = evt.target.value;

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
            }, this._throttlingIntervalMs);
        }

        _renderAutoComplete() {
            if (this.props.attrObj.getAutoComplete().size > 0) {
                return <AutoCompleteBox attrObj={this.props.attrObj}
                                customAutoCompleteHintClickHandler={this.props.customAutoCompleteHintClickHandler} />;

            } else {
                return null;
            }
        }

        render() {
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
    }

    // ----------------------------- <RawInputMultiValueContainer /> --------------------------

    const RawInputMultiValueContainer = (props) => {

        const handleAutoCompleteHintClick = (item) => { // typeof item = TextTypes.AutoCompleteItem
            dispatcher.dispatch({
                actionType: 'TT_ATTRIBUTE_AUTO_COMPLETE_HINT_CLICKED',
                props: {
                    attrName: props.attrObj.name,
                    ident: item.ident,
                    label: item.label,
                    append: true
                }
            });
        };

        const renderCheckboxes = () => {
            const values = props.attrObj.getValues();
            return values.map((item, i) => {
                return (
                    <tr key={item.value + String(i)}>
                        <td>
                            <CheckBoxItem
                                    itemIdx={i}
                                    itemName={props.attrObj.name}
                                    itemValue={item.value}
                                    itemIsSelected={item.selected}
                                    itemIsLocked={item.locked}
                                        />
                        </td>
                        <td>
                            {props.hasExtendedInfo
                                ? <ExtendedInfoButton ident={item.ident} attrName={props.attrObj.name}
                                        numGrouped={item.numGrouped}
                                        containsExtendedInfo={!!item.extendedInfo} />
                                : null }
                        </td>
                    </tr>
                );
            });
        };

        return (
            <div>
                <table>
                    <tbody>
                        {renderCheckboxes()}
                    </tbody>
                </table>
                <RawInputContainer attrObj={props.attrObj}
                                    isLocked={props.isLocked}
                                    inputTextOnChange={props.inputTextOnChange}
                                    customInputName={null}
                                    customAutoCompleteHintClickHandler={handleAutoCompleteHintClick} />
            </div>
        );
    };

    // ----------------------------- <ValueSelector /> --------------------------

    const ValueSelector = (props) => {

        return (
            <div className="scrollable">
            {props.attrObj.containsFullList() || props.rangeIsOn
                ? <FullListContainer attrObj={props.attrObj} rangeIsOn={props.rangeIsOn}
                        isLocked={props.isLocked}
                        hasExtendedInfo={props.hasExtendedInfo} />
                : <RawInputMultiValueContainer
                        attrObj={props.attrObj}
                        isLocked={props.isLocked}
                        inputTextOnChange={props.inputTextOnChange}
                        hasExtendedInfo={props.hasExtendedInfo} />
            }
            </div>
        );
    };

    // ----------------------------- <TableTextTypeAttribute /> --------------------------

    class TableTextTypeAttribute extends React.Component {

        constructor(props) {
            super(props);
            this._selectAllHandler = this._selectAllHandler.bind(this);
            this._intervalModeSwitchHandler = this._intervalModeSwitchHandler.bind(this);
            this._metaInfoHelpClickHandler = this._metaInfoHelpClickHandler.bind(this);
            this._helpCloseHandler = this._helpCloseHandler.bind(this);
            this.state = {
                metaInfoHelpVisible: false,
                hasExtendedInfo: textTypesStore.hasDefinedExtendedInfo(this.props.attrObj.name),
                metaInfo: textTypesStore.getAttrSummary().get(this.props.attrObj.name)
            };
        }

        _renderModeSwitch(obj) {
            if (this.props.attrObj.isInterval) {
                const label = this.props.rangeIsOn
                    ? he.translate('query__tt_select_individual')
                    : he.translate('query__tt_select_range');
                return (
                    <td>
                        <a className="util-button" onClick={this._intervalModeSwitchHandler}>{label}</a>
                    </td>
                );
            }
            return null;
        }

        _selectAllHandler() {
            dispatcher.dispatch({
                actionType: 'TT_SELECT_ALL_CHECKBOX_CLICKED',
                props: {
                    attrName: this.props.attrObj.name
                }
            });
        }

        _intervalModeSwitchHandler() {
            dispatcher.dispatch({
                actionType: 'TT_TOGGLE_RANGE_MODE',
                props: {
                    attrName: this.props.attrObj.name
                }
            });
        }

        _renderFooter() {
            if (this.props.attrObj.containsFullList() && !this.props.attrObj.isLocked()) {
                return (
                    <label className="select-all" style={{display: 'inline-block'}}>
                        <input type="checkbox" className="select-all" onClick={this._selectAllHandler} />
                        {he.translate('global__select_all')}
                        </label>
                );

            } else {
                return null;
            }
        }

        _metaInfoHelpClickHandler() {
            const newState = he.cloneState(this.state);
            newState.metaInfoHelpVisible = true;
            this.setState(newState);
        }

        _helpCloseHandler() {
            const newState = he.cloneState(this.state);
            newState.metaInfoHelpVisible = false;
            this.setState(newState);
        }

        _renderMetaInfo() {
            if (this.state.metaInfo) {
                return (
                    <span>
                        {this.state.metaInfo.text}
                        {'\u00A0'}
                        <a className="context-help" onClick={this._metaInfoHelpClickHandler}>
                            <layoutViews.ImgWithMouseover
                                src={he.createStaticUrl('img/question-mark.svg')}
                                htmlClass="over-img"
                                src={he.translate('global__alt_hint')} />
                        </a>
                        {this.state.metaInfoHelpVisible
                            ? (<layoutViews.PopupBox onCloseClick={this._helpCloseHandler} status="info" autoSize={true}>
                                {this.state.metaInfo.help}
                                </layoutViews.PopupBox>)
                            : null}
                    </span>
                );

            } else {
                return null;
            }
        }

        shouldComponentUpdate(nextProps, nextState) {
            return this.props.attrObj !== nextProps.attrObj
                    || this.props.rangeIsOn !== nextProps.rangeIsOn
                    || this.state.metaInfoHelpVisible !== nextState.metaInfoHelpVisible;
        }

        _renderExtendedInfo() {
            const srch = this.props.attrObj.getValues().findEntry(item => !!item.extendedInfo);
            if (srch) {
                const [srchIdx, item] = srch;
                return <ExtendedInfoBox data={item.extendedInfo} ident={item.ident}
                                attrName={this.props.attrObj.name} />;

            } else {
                return null;
            }
        }

        _renderAttrInfo() {
            if (this.props.attrObj.attrInfo.doc) {
                return (
                    <span className="info-link">{'\u00a0'}(
                        <a target="_blank" href={this.props.attrObj.attrInfo.doc}
                                title={he.translate('query__tt_click_to_see_attr_info')}>
                            {this.props.attrObj.attrInfo.docLabel}
                        </a>)
                    </span>
                );
            }
            return null;
        }

        render() {
            const classes = ['envelope'];
            if (this.props.attrObj.isLocked()) {
                classes.push('locked');
            }
            return (
                <table className={classes.join(' ')}>
                    <tbody>
                        <tr className="attrib-name">
                            <th>
                                {this.props.attrObj.name}
                                {this._renderAttrInfo()}
                            </th>
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
                                        isLocked={this.props.attrObj.isLocked()}
                                        hasExtendedInfo={this.state.hasExtendedInfo}  />
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
    }

    // ----------------------------- <TextTypesPanel /> --------------------------

    class TextTypesPanel extends React.Component {

        constructor(props) {
            super(props);
            this._storeChangeHandler = this._storeChangeHandler.bind(this);
            this.state = this._fetchStoreState();
        }

        _fetchStoreState() {
            return {
                attributes: textTypesStore.getAttributes(),
                rangeModes: textTypesStore.getRangeModes()
            };
        }

        _storeChangeHandler(store, action) {
            this.setState(this._fetchStoreState());
        }

        componentDidMount() {
            textTypesStore.addChangeListener(this._storeChangeHandler);
            if (typeof this.props.onReady === 'function') {
                this.props.onReady();
            }
        }

        componentWillUnmount() {
            textTypesStore.removeChangeListener(this._storeChangeHandler);
        }

        render() {
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
                            ? <this.props.liveAttrsCustomTT />
                            : null}
                        {this.state.attributes.map((attrObj) => {
                            return <TableTextTypeAttribute key={attrObj.name + ':list:' + attrObj.containsFullList()}
                                        attrObj={attrObj} rangeIsOn={this.state.rangeModes.get(attrObj.name)} />;
                        })}
                    </div>
                </div>
            );
        }
    }

    return {
        TextTypesPanel: TextTypesPanel
    };

}