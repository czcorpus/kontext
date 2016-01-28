/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

define(['vendor/react', 'jquery'], function (React, $) {
    'use strict';

    let lib = {};

    lib.init = function (dispatcher, mixins, lineSelectionStore, userInfoStore) {

        let SimpleSelectionModeSwitch = React.createClass({
            mixins: mixins,

            _changeHandler : function (evt) {
                dispatcher.dispatch({
                    actionType: 'LINE_SELECTION_MODE_CHANGED',
                    props: {
                        mode: evt.target.value
                    }
                });
            },

            render : function () {
                return (
                    <select name="actions" defaultValue={this.props.initialAction}
                            onChange={this.props.switchHandler}>
                        <option value="-">--</option>
                        <option value="remove">{this.translate('global__remove_selected_lines')}</option>
                        <option value="remove_inverted">{this.translate('global__remove_all_but_selected_lines')}</option>
                        <option value="clear">{this.translate('global__clear_the_selection')}</option>
                        <option value="save">{this.translate('global__get_line_selection_persitent_link')}</option>
                    </select>
                );
            }
        });

        let GroupsSelectionModelSwitch = React.createClass({
            mixins : mixins,

            _changeHandler : function (evt) {
                dispatcher.dispatch({
                    actionType: 'LINE_SELECTION_MODE_CHANGED',
                    props: {
                        mode: evt.target.value
                    }
                });
            },

            render : function () {
                return (
                    <select name="actions" defaultValue={this.props.initialAction}
                            onChange={this.props.switchHandler}>
                        <option value="-">--</option>
                        <option value="apply">{this.translate('global__apply_marked_lines')}</option>
                        <option value="apply_remove_rest">{this.translate('global__apply_marked_lines_remove_rest')}</option>
                        <option value="clear">{this.translate('global__clear_the_selection')}</option>
                        <option value="save">{this.translate('global__get_line_selection_persitent_link')}</option>
                    </select>
                );
            }
        });

        // ----------------------------- Save dialog ------------------------

        let SaveDialog = React.createClass({

            mixins : mixins,

            _emailCheckboxChangeHandler : function (evt) {
                this.props.sendByEmailChange(evt);

                if (!this.state.predefinedMail) {
                    dispatcher.dispatch({
                        actionType: 'USER_INFO_REQUESTED',
                        props: {}
                    });

                } else {
                    this.setState(React.addons.update(this.state, {enterMail: {$set: !this.state.enterMail}}));
                }
            },

            _storeChangeListener : function (store, status) {
                if (status === 'USER_INFO_REFRESHED') {
                    this.setState(React.addons.update(this.state,
                        {
                            predefinedMail: {$set: userInfoStore.getCredentials()['email']},
                            enterMail: {$set: true}
                        }
                    ));
                }
            },

            componentDidMount : function () {
                userInfoStore.addChangeListener(this._storeChangeListener);
            },

            componentWillUnmount : function () {
                userInfoStore.removeChangeListener(this._storeChangeListener);
            },

            getInitialState : function () {
                return {enterMail: false, predefinedMail: null};
            },

            render : function () {
                return (
                    <div>
                        <div className="form-item">
                            <label>
                                <input type="checkbox" value="1" onChange={this._emailCheckboxChangeHandler} />
                                {this.translate('global__send_the_link_to_mail')}
                            </label>
                        </div>
                        <div className="form-item">
                        {this.state.enterMail ?
                            <input type="text" style={{width: '15em'}} defaultValue={this.state.predefinedMail} /> : null
                        }
                        </div>
                        <div className="form-item">
                            <button type="button" value="ok" onClick={this.props.buttonHandler}>{this.translate('global__ok')}</button>
                            <button type="button" value="cancel" onClick={this.props.buttonHandler}>{this.translate('global__cancel')}</button>
                        </div>

                        {this.props.checkpointUrl ?
                            (<div className="generated-link">
                                <input className="conc-link" type="text" readOnly="true"
                                    value={this.props.checkpointUrl} style={{width: '30em'}} />
                            </div>)
                            : null
                        }
                    </div>
                );
            }
        });

        // ----------------------------- Line selection menu --------------------------

        let LineSelectionMenu = React.createClass({

            mixins: mixins,

            _changeHandler : function (store, status) {
                if (status === 'STATUS_UPDATED') {
                    this.setState(React.addons.update(this.state,
                            {mode: {$set: lineSelectionStore.getMode()}}));

                } else if (status === 'STATUS_UPDATED_LINES_SAVED') {
                    this.setState(React.addons.update(this.state,
                            {
                                checkpointUrl: {$set: lineSelectionStore.getLastCheckpoint()},
                                saveDialog: {$set: true}
                            }
                    ));
                }
            },

            _handleSaveDialogButton : function (evt) {
                if (evt.target.value === 'cancel') {
                    this.setState(React.addons.update(this.state, {saveDialog: {$set: false}}));

                } else if (evt.target.value === 'ok') {
                    dispatcher.dispatch({
                        actionType: 'LINE_SELECTION_SAVE_UNFINISHED',
                        props: {sendByMail: this.state.sendByMail}
                    });
                }
            },

            _actionChangeHandler : function (evt) {
                let actionMap = {
                    clear: 'LINE_SELECTION_RESET',
                    remove: 'LINE_SELECTION_REMOVE_LINES',
                    remove_inverted: 'LINE_SELECTION_REMOVE_OTHER_LINES',
                    apply: 'LINE_SELECTION_MARK_LINES',
                    apply_remove_rest: 'LINE_SELECTION_MARK_LINES_REMOVE_OTHERS'
                };
                let eventId = actionMap[evt.target.value] || null;

                if (eventId) {
                    dispatcher.dispatch({
                        actionType: eventId,
                        props: {}
                    });

                } else if (evt.target.value === 'save') {
                    this.setState(React.addons.update(this.state, {saveDialog: {$set: true}}));
                }
            },

            _handleSendByEmailChange : function (e) {
                this.setState(React.addons.update(this.state, {sendByMail: {$set: e.target.value}}));
            },

            getInitialState : function () {
                return {mode: 'simple', saveDialog: false, sendByMail: null};
            },

            componentDidMount : function () {
                lineSelectionStore.addChangeListener(this._changeHandler);
                dispatcher.dispatch({
                    actionType: 'LINE_SELECTION_STATUS_REQUEST',
                    props: {}
                });
            },

            componentWillUnmount : function () {
                lineSelectionStore.removeChangeListener(this._changeHandler);
            },

            componentDidUpdate : function () {
                // we must inform non-react environment (here popupbox.js) we are ready here
                if (typeof this.props.doneCallback === 'function') {
                    this.props.doneCallback();
                }
            },

            render : function () {
                let switchComponent = null;

                if (this.state.mode === 'simple') {
                    switchComponent = <SimpleSelectionModeSwitch initialAction="-"
                                        switchHandler={this._actionChangeHandler} />;

                } else if (this.state.mode === 'groups') {
                    switchComponent = <GroupsSelectionModelSwitch initialAction="-"
                                        switchHandler={this._actionChangeHandler} />;
                }

                if (this.state.saveDialog) {
                    return (
                        <div id="selection-actions">
                            <h3>...{this.translate('global__save_selection_heading')}</h3>
                            <SaveDialog buttonHandler={this._handleSaveDialogButton}
                                sendByEmailChange={this._handleSendByEmailChange}
                                checkpointUrl={this.state.checkpointUrl} />
                        </div>
                    );

                } else {
                    return (
                        <div id="selection-actions">
                            <h3>{this.translate('global__selection_actions')}</h3>
                            <form action="delete_lines" method="POST">{switchComponent}</form>
                        </div>
                    );
                }
            }
        });

        return {
            LineSelectionMenu: LineSelectionMenu
        };
    };

    return lib;

});