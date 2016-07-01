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
import $ from 'jquery';


export function init(dispatcher, mixins, lineSelectionStore, userInfoStore) {

    // ----------------------------- <SimpleSelectionModeSwitch /> --------------------------

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
                    <option value="remove">{this.translate('linesel__remove_selected_lines')}</option>
                    <option value="remove_inverted">{this.translate('linesel__remove_all_but_selected_lines')}</option>
                    <option value="clear">{this.translate('linesel__clear_the_selection')}</option>
                </select>
            );
        }
    });

    // ----------------------------- <GroupsSelectionModelSwitch /> --------------------------

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
                    <option value="apply">{this.translate('linesel__apply_marked_lines')}</option>
                    <option value="clear">{this.translate('linesel__clear_the_selection')}</option>
                </select>
            );
        }
    });

    // ----------------------------- <LineSelectionMenu /> --------------------------

    let LineSelectionMenu = React.createClass({

        mixins: mixins,

        _changeHandler : function (store, status) {
            if (status === 'STATUS_UPDATED') {
                this.setState(React.addons.update(this.state,
                        {mode: {$set: lineSelectionStore.getMode()}}));

            } else if (status === 'STATUS_UPDATED_LINES_SAVED') {
                this.setState(React.addons.update(this.state,
                        {
                            checkpointUrl: {$set: lineSelectionStore.getLastCheckpoint()}
                        }
                ));
            }
        },

        _actionChangeHandler : function (evt) {
            let actionMap = {
                clear: 'LINE_SELECTION_RESET',
                remove: 'LINE_SELECTION_REMOVE_LINES',
                remove_inverted: 'LINE_SELECTION_REMOVE_OTHER_LINES',
                apply: 'LINE_SELECTION_MARK_LINES'
            };
            let eventId = actionMap[evt.target.value] || null;

            if (eventId) {
                dispatcher.dispatch({
                    actionType: eventId,
                    props: {}
                });
            }
        },

        getInitialState : function () {
            return {mode: 'simple'};
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

            let heading;
            if (this.state.mode === 'simple') {
                heading = this.translate('linesel__unsaved_line_selection_heading');

            } else if (this.state.mode === 'groups') {
                heading = this.translate('linesel__unsaved_line_groups_heading');
            }

            return (
                <div id="selection-actions">
                    <h3>{heading}</h3>
                    {this.translate('global__actions')}:{'\u00A0'}
                    <form action="delete_lines" method="POST">{switchComponent}</form>
                </div>
            );
        }
    });

    // --------------------------- <EmailDialog /> ----------------------------

    let EmailDialog = React.createClass({

        mixins: mixins,

        render: function () {
            return (
                <div>
                    <input className="email" type="text" style={{width: '20em'}}
                            defaultValue={this.props.defaultEmail}
                            onChange={this.props.emailChangeHandler} />
                    <button className="ok" type="button" value="send" onClick={this.props.handleEmailDialogButton}>{this.translate('global__send')}</button>
                    <button type="button" value="cancel" onClick={this.props.handleEmailDialogButton}>{this.translate('global__cancel')}</button>
                </div>
            );
        }
    });


    // ----------------------------- <RenameLabelPanel /> ------------------------------


    let RenameLabelPanel = React.createClass({

        mixins : mixins,

        _handleConfirmClick : function () {
            dispatcher.dispatch({
                actionType: 'LINE_SELECTION_GROUP_RENAME',
                props: {
                    srcGroupNum: this.state.srcGroupNum,
                    dstGroupNum: this.state.dstGroupNum
                }
            });
        },

        getInitialState : function () {
            return {srcGroupNum: null, dstGroupNum: null};
        },

        _handleSrcInputChange : function (evt) {
            let val = evt.target.value ? Number(evt.target.value) : null;
            this.setState(React.addons.update(this.state, {srcGroupNum: {$set: val}}));
        },

        _handleDstInputChange : function (evt) {
            let val = evt.target.value ? Number(evt.target.value) : null;
            this.setState(React.addons.update(this.state, {dstGroupNum: {$set: val}}));
        },

        render : function () {
            return (
                <fieldset>
                    <legend>{this.translate('linesel__rename_drop_heading')}</legend>
                    <label>{this.translate('linesel__old_label_name')}:</label>
                    {'\u00A0'}#<input type="text" style={{width: '2em'}} onChange={this._handleSrcInputChange} />
                    <span className="arrow">{'\u00A0\u21E8\u00A0'}</span>
                    <label>{this.translate('linesel__new_label_name')}:</label>
                    {'\u00A0'}#<input type="text" style={{width: '2em'}} onChange={this._handleDstInputChange} />
                    <ul clasName="note">
                        <li>{this.translate('linesel__if_empty_lab_then_remove')}</li>
                        <li>{this.translate('linesel__if_existing_lab_then_merge')}</li>
                    </ul>
                    <button className="ok" type="button" onClick={this._handleConfirmClick}>{this.translate('global__ok')}</button>
                    <button type="button" onClick={this.props.handleCancel}>{this.translate('global__cancel')}</button>
                </fieldset>
            );
        }
    });

    // ----------------------------- <LockedLineGroupsMenu /> ------------------------------

    let LockedLineGroupsMenu = React.createClass({

        mixins: mixins,

        _changeHandler : function (store, status) {
            if (status === 'STATUS_UPDATED') {
                this.setState(React.addons.update(this.state,
                        {hasData: {$set: true}})); /// TODO set once d3.js stuff is ready etc.
                if (typeof this.props.chartCallback === 'function') {
                    this.props.chartCallback();
                }

            } else if (status === 'USER_INFO_REFRESHED') {
                this.setState(React.addons.update(this.state,
                    {
                        email: {$set: userInfoStore.getCredentials()['email']},
                        emailDialog: {$set: true}
                    }
                ));

            } else if (status === 'LINE_SELECTION_URL_SENT_TO_EMAIL') {
                this.setState(React.addons.update(this.state,
                    {
                        email: {$set: null},
                        emailDialog: {$set: false}
                    }
                ));
            }
        },

        _actionSwitchHandler : function (evt) {
            switch (evt.target.value) {
                case 'edit-groups':
                    dispatcher.dispatch({
                        actionType: 'LINE_SELECTION_REENABLE_EDIT',
                        props: {}
                    });
                    break;
                case 'sort-groups':
                    dispatcher.dispatch({
                        actionType: 'LINE_SELECTION_SORT_LINES',
                        props: {}
                    });
                    break;
                case 'clear-groups':
                    dispatcher.dispatch({
                        actionType: 'LINE_SELECTION_RESET_ON_SERVER',
                        props: {}
                    });
                    break;
                case 'remove-other-lines':
                    dispatcher.dispatch({
                        actionType: 'LINE_SELECTION_REMOVE_NON_GROUP_LINES',
                        props: {}
                    });
                    break;
                case 'rename-group-label':
                    this.setState(React.addons.update(this.state, {renameLabelDialog: {$set: true}}));
                    break;

            }
        },

        _openEmailDialogButtonHandler : function () {
            dispatcher.dispatch({
                actionType: 'USER_INFO_REQUESTED',
                props: {}
            });
        },

        _handleEmailDialogButton : function (evt) {
            if (evt.target.value === 'cancel') {
                this.setState(React.addons.update(this.state, {emailDialog: {$set: false}}));

            } else if (evt.target.value === 'send') {
                dispatcher.dispatch({
                    actionType: 'LINE_SELECTION_SEND_URL_TO_EMAIL',
                    props: {
                        email: this.state.email
                    }
                })
            }
        },

        _emailChangeHandler : function (evt) {
            this.setState(React.addons.update(this.state, {email: {$set: evt.target.value}}));
        },

        componentDidMount : function () {
            lineSelectionStore.addChangeListener(this._changeHandler);
            userInfoStore.addChangeListener(this._changeHandler);
            dispatcher.dispatch({
                actionType: 'LINE_SELECTION_STATUS_REQUEST',
                props: {
                    email: this.state.email
                }
            });
        },

        componentWillUnmount : function () {
            lineSelectionStore.removeChangeListener(this._changeHandler);
            userInfoStore.removeChangeListener(this._changeHandler);
        },

        componentDidUpdate : function () {
            // we must inform non-react environment (here popupbox.js) we are ready here
            if (typeof this.props.doneCallback === 'function') {
                this.props.doneCallback();
            }
        },

        getInitialState : function () {
            return {
                hasData: false,
                emailDialog: false,
                renameLabelDialog: false,
                email: null
            };
        },

        _handleRenameCancel : function () {
            this.setState(React.addons.update(this.state, {renameLabelDialog: {$set: false}}));
        },

        _renderActionArea : function () {
            if (this.state.renameLabelDialog) {
                return <RenameLabelPanel handleCancel={this._handleRenameCancel} />;

            } else {
                return (
                    <div className="actions">
                        {this.translate('global__actions')}:{'\u00A0'}
                        <select onChange={this._actionSwitchHandler}>
                            <option value="">--</option>
                            <option value="edit-groups">{this.translate('linesel__continue_editing_groups')}</option>
                            <option value="sort-groups">{this.translate('linesel__view_sorted_groups')}</option>
                            <option value="rename-group-label">{this.translate('linesel__rename_label')}...</option>
                            <option value="remove-other-lines">{this.translate('linesel__remove_non_group_lines')}</option>
                            <option value="clear-groups">{this.translate('linesel__clear_line_groups')}</option>
                        </select>
                    </div>
                );
            }
        },

        _renderEmailButton : function () {
            if (this.props.canSendMail) {
                return <button type="button" onClick={this._openEmailDialogButtonHandler}>{this.translate('linesel__send_the_link_to_mail')}</button>;
            }
            return null;
        },

        render: function () {
            return (
                <div id="selection-actions">
                    <h3>{this.translate('linesel__saved_line_groups_heading')}</h3>

                    {this._renderActionArea()}

                    <fieldset className="chart-area"></fieldset>

                    <fieldset className="generated-link">
                        <legend>{this.translate('linesel__line_selection_link_heading')}</legend>
                        <input className="conc-link" type="text" readOnly="true"
                                onClick={(e)=> e.target.select()}
                                value={this.props.checkpointUrl} />
                        {
                            this.state.emailDialog
                            ? <EmailDialog
                                    defaultEmail={this.state.email}
                                    handleEmailDialogButton={this._handleEmailDialogButton}
                                    emailChangeHandler={this._emailChangeHandler} />
                            : this._renderEmailButton()
                        }
                    </fieldset>
                </div>
            )
        }
    });

    return {
        LineSelectionMenu: LineSelectionMenu,
        LockedLineGroupsMenu: LockedLineGroupsMenu
    };
}
