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

define(['vendor/react'], function (React) {
    'use strict';

    let lib = {};

    lib.init = function (dispatcher, mixins, textTypesStore) {

        // ----------------------------- <RangeSelector /> --------------------------

        let RangeSelector = React.createClass({

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

        let CheckBoxItem = React.createClass({

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
                return (
                    <label className={this.props.itemIsLocked ? 'locked' : null}>
                        <input
                            type="checkbox"
                            name={'sca_' + this.props.itemName}
                            value={this.props.itemValue}
                            className="attr-selector user-selected"
                            checked={this.props.itemIsSelected}
                            onChange={this._clickHandler}
                            disabled={this.props.itemIsLocked}
                        />
                        {this.props.itemValue}
                    </label>
                );
            }
        });

        // ----------------------------- <FullListContainer /> --------------------------

        let ExtendedInfoBox = React.createClass({

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

            render : function () {
                let layoutViews = this.getLayoutViews();
                return (
                    <layoutViews.PopupBox onCloseClick={this._clickCloseHandler}
                                customClass="metadata-detail"
                                customStyle={{marginLeft: '-5em'}}>
                        <ul>
                            {this.props.data.entrySeq().map((item) => {
                                return <li key={item[0]}><strong>{item[0]}:</strong>{'\u00A0'}{item[1]}</li>;
                            })}
                        </ul>
                    </layoutViews.PopupBox>
                );
            }
        });

        // ----------------------------- <FullListContainer /> --------------------------

        let FullListContainer = React.createClass({

            mixins : mixins,

            _mkExtendedInfoClickHandler : function (idx) {
                return (evt) => {
                    dispatcher.dispatch({
                        actionType: 'TT_EXTENDED_INFORMATION_REQUEST',
                        props: {
                            attrName: this.props.data.name,
                            idx: idx
                        }
                    });
                }
            },

            _renderListOfCheckBoxes : function () {
                return (
                    <table>
                        <tbody>
                        {this.props.data.values.map((item, i) => {
                            return (
                                <tr key={item.value + String(i)}>
                                    <td><CheckBoxItem
                                            itemIdx={i}
                                            itemName={this.props.data.name}
                                            itemValue={item.value}
                                            itemIsSelected={item.selected}
                                            itemIsLocked={item.locked}
                                             /></td>
                                    <td className="num">{item.availItems}</td>
                                    <td>
                                    {this.props.hasDefinedExtendedInfo
                                        ? (<a onClick={this._mkExtendedInfoClickHandler(i)}
                                            className="bib-info">i</a>) : null}

                                    {item.extendedInfo
                                        ? <ExtendedInfoBox data={item.extendedInfo} itemIdx={i} attrName={this.props.data.name} /> : null}
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
                            ? <RangeSelector attrName={this.props.data.name} />
                            : this._renderListOfCheckBoxes()
                        }
                    </div>
                );
            }
        });

        // ----------------------------- <RawInputContainer /> --------------------------

        let RawInputContainer = React.createClass({

            throttlingTimer : null,

            _inputChangeHandler : function (evt) {
                let v = evt.target.value;

                dispatcher.dispatch({
                    actionType: 'TT_ATTRIBUTE_TEXT_INPUT_CHANGED',
                    props: {
                        attrName: this.props.attrName,
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
                            attrName: this.props.attrName,
                            value: v
                        }
                    });
                }, 200);
            },

            _handleAutoCompleteHintClick : function (value) {
                dispatcher.dispatch({
                    actionType: 'TT_ATTRIBUTE_TEXT_INPUT_SILENTLY_CHANGED',
                    props: {
                        attrName: this.props.attrName,
                        value: value
                    }
                })
            },

            _renderAutoComplete : function (data) {
                return (
                    <ul className="auto-complete">
                    {data.map((item) => {
                        return (
                            <li key={item}>
                                <a onClick={this._handleAutoCompleteHintClick.bind(this, item)}>
                                    {item}
                                </a>
                            </li>
                        );
                    })}
                    </ul>
                );
            },

            _changeHandler : function (store, action) {
                if (action === '$TT_RAW_INPUT_VALUE_UPDATED') {
                    let attr = store.getAttribute(this.props.attrName);
                    if (attr) {
                        this.setState({
                            inputValue: attr.getValue(),
                            attrObj: textTypesStore.getAttribute(this.props.attrName)
                        });

                    } else {
                        throw new Error('Attribute not found: ', this.props.attrName);
                    }
                }
            },

            componentDidMount : function () {
                textTypesStore.addChangeListener(this._changeHandler);
            },

            componentWillUnmount : function () {
                textTypesStore.removeChangeListener(this._changeHandler);
            },

            getInitialState : function () {
                return {
                    inputValue: '',
                    attrObj: textTypesStore.getAttribute(this.props.attrName)
                };
            },

            render : function () {
                let autoComplete = this.state.attrObj.getAutoComplete();
                return (
                    <table>
                        <tbody>
                            <tr>
                                <td>
                                    <input type="text"
                                        name={'sca_' + this.props.attrName}
                                        onChange={this._inputChangeHandler}
                                        value={this.state.attrObj.getValue()}
                                        autoComplete="off" />
                                    {autoComplete.size > 0 ? this._renderAutoComplete(autoComplete) : null}
                                </td>
                                <td></td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                );
            }
        });

        // ----------------------------- <ValueSelector /> --------------------------

        let ValueSelector = React.createClass({

            render : function () {
                return (
                    <div className="scrollable">
                    {this.props.data.containsFullList() || this.props.rangeIsOn
                        ? <FullListContainer data={this.props.data} rangeIsOn={this.props.rangeIsOn}
                                isLocked={this.props.isLocked} hasDefinedExtendedInfo={this.props.hasDefinedExtendedInfo} />
                        : <RawInputContainer attrName={this.props.data.name}
                                isLocked={this.props.isLocked} inputTextOnChange={this.props.inputTextOnChange} />
                    }
                    </div>
                );
            }
        });

        // ----------------------------- <TableTextTypeAttribute /> --------------------------

        let TableTextTypeAttribute = React.createClass({

            mixins : mixins,

            _renderModeSwitch : function (obj) {
                if (this.props.attrObj.isInterval) {
                    let label = this.state.rangeIsOn
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

            _changeHandler : function (store, action) {
                if (action === '$TT_RANGE_APPLIED' &&
                        textTypesStore.getLastActiveRangeAttr() === this.props.attrObj.name) {
                    this.setState({
                        rangeIsOn: false, // <- switch back to a list mode to allow user to view the result,
                        hasDefinedExtendedInfo: textTypesStore.hasDefinedExtendedInfo(this.props.attrObj.name)
                    });

                } else {
                    this.setState(React.addons.update(this.state,
                        {hasDefinedExtendedInfo: {$set: textTypesStore.hasDefinedExtendedInfo(this.props.attrObj.name)}}
                    ));
                }
            },

            componentDidMount: function () {
                textTypesStore.addChangeListener(this._changeHandler);
            },

            componentWillUnmount: function () {
                textTypesStore.removeChangeListener(this._changeHandler);
            },

            getInitialState : function () {
                return {
                    rangeIsOn : this.props.attrObj.isInterval,
                    metaInfoHelpVisible: false,
                    hasDefinedExtendedInfo: textTypesStore.hasDefinedExtendedInfo(this.props.attrObj.name)
                };
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
                this.setState({
                    rangeIsOn: !this.state.rangeIsOn
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
                this.setState(React.addons.update(this.state, {metaInfoHelpVisible: {$set: !this.state.metaHelp}}));
            },

            _helpCloseHandler : function () {
                this.setState(React.addons.update(this.state, {metaInfoHelpVisible: {$set: false}}));
            },

            _renderMetaInfo : function () {
                let layoutViews = this.getLayoutViews();
                if (this.props.metaInfo) {
                    return (
                        <span>
                            {this.props.metaInfo.text}
                            {'\u00A0'}
                            <a className="context-help" onClick={this._metaInfoHelpClickHandler}>
                                <img src={this.createStaticUrl('img/question-mark.svg')} className="over-img" />
                            </a>
                            {this.state.metaInfoHelpVisible
                                ? (<layoutViews.PopupBox onCloseClick={this._helpCloseHandler} status="info" autoSize={true}>
                                    {this.props.metaInfo.help}
                                   </layoutViews.PopupBox>)
                                : null}
                        </span>
                    );

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
                    <table key={this.props.attrObj.name} border="0" className={classes.join(' ')}>
                        <tbody>
                            <tr className="attrib-name">
                                <th>{this.props.attrObj.name}</th>
                            </tr>
                            <tr className={this.state.rangeIsOn ? 'range' : 'data-rows'}>
                                <td>
                                    <ValueSelector data={this.props.attrObj}
                                            rangeIsOn={this.state.rangeIsOn}
                                            isLocked={this.props.attrObj.isLocked()}
                                            hasDefinedExtendedInfo={this.state.hasDefinedExtendedInfo} />
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

        let TextTypesPanel = React.createClass({
            mixins: mixins,

            _changeHandler : function (store, action) {
                this.setState(React.addons.update(this.state,
                    {
                        attributes: {$set: store.getAttributes()},
                        metaInfo: {$set: store.getAttrSummary()}
                    }
                ));
            },

            componentDidMount: function () {
                textTypesStore.addChangeListener(this._changeHandler);
                if (typeof this.props.onReady === 'function') {
                    this.props.onReady();
                }
            },

            componentWillUnmount: function () {
                textTypesStore.removeChangeListener(this._changeHandler);
            },

            getInitialState : function () {
                return {
                    attributes: textTypesStore.getAttributes(),
                    metaInfo: textTypesStore.getAttrSummary(),
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
                                return <TableTextTypeAttribute key={attrObj.name}
                                          attrObj={attrObj} metaInfo={this.state.metaInfo.get(attrObj.name)} />;
                            })}
                        </div>
                    </div>
                );
            }
        });

        return {
            TextTypesPanel: TextTypesPanel
        };

    };

    return lib;

});