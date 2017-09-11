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


export function init(dispatcher, he, lineSelectionStore) {

    // ----------------------------- <SimpleSelectionModeSwitch /> --------------------------

    const SimpleSelectionModeSwitch = (props) => {

        return (
            <select name="actions" defaultValue={props.initialAction}
                    onChange={props.switchHandler}>
                <option value="-">--</option>
                <option value="remove">{he.translate('linesel__remove_selected_lines')}</option>
                <option value="remove_inverted">{he.translate('linesel__remove_all_but_selected_lines')}</option>
                <option value="clear">{he.translate('linesel__clear_the_selection')}</option>
            </select>
        );
    };

    // ----------------------------- <GroupsSelectionModelSwitch /> --------------------------

    const GroupsSelectionModelSwitch = (props) => {

        return (
            <select name="actions" defaultValue={props.initialAction}
                    onChange={props.switchHandler}>
                <option value="-">--</option>
                <option value="apply">{he.translate('linesel__apply_marked_lines')}</option>
                <option value="clear">{he.translate('linesel__clear_the_selection')}</option>
            </select>
        );
    };

    // ----------------------------- <LineBinarySelectionMenu /> --------------------------

    class LineBinarySelectionMenu extends React.Component {

        constructor(props) {
            super(props);
            this._changeHandler = this._changeHandler.bind(this);
            this._actionChangeHandler = this._actionChangeHandler.bind(this);
            this.state = this._fetchStoreState();
        }

        _fetchStoreState() {
            return {
                mode: lineSelectionStore.getMode(),
                waiting: lineSelectionStore.isBusy()
            };
        }

        _changeHandler() {
            if (this.props.mode === 'simple') { // prevent unmounted component update
                this.setState(this._fetchStoreState());
            }
        }

        _actionChangeHandler(evt) {
            const actionMap = {
                clear: 'LINE_SELECTION_RESET',
                remove: 'LINE_SELECTION_REMOVE_LINES',
                remove_inverted: 'LINE_SELECTION_REMOVE_OTHER_LINES',
                apply: 'LINE_SELECTION_MARK_LINES'
            };
            const eventId = actionMap[evt.target.value] || null;

            if (eventId) {
                dispatcher.dispatch({
                    actionType: eventId,
                    props: {}
                });
            }
        }

        componentDidMount() {
            lineSelectionStore.addChangeListener(this._changeHandler);
            dispatcher.dispatch({
                actionType: 'LINE_SELECTION_STATUS_REQUEST',
                props: {}
            });
        }

        componentWillUnmount() {
            lineSelectionStore.removeChangeListener(this._changeHandler);
        }

        render() {
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
                heading = he.translate('linesel__unsaved_line_selection_heading');

            } else if (this.state.mode === 'groups') {
                heading = he.translate('linesel__unsaved_line_groups_heading');
            }

            return (
                <div id="selection-actions">
                    <h3>{heading}</h3>
                    {he.translate('global__actions')}:{'\u00A0'}
                    {switchComponent}
                    {this.state.waiting ?
                        <img className="ajax-loader-bar" src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                                title={he.translate('global__loading')} />
                        : null}
                    {this.state.mode === 'groups' ?
                        <p style={{marginTop: '1em'}}>({he.translate('linesel__no_ops_after_groups_save_info')}.)</p> : null}
                </div>
            );
        }
    }

    // --------------------------- <EmailDialog /> ----------------------------

    const EmailDialog = (props) => {

        return (
            <div>
                <input className="email" type="text" style={{width: '20em'}}
                        defaultValue={props.defaultEmail}
                        onChange={props.emailChangeHandler} />
                <button className="ok util-button" type="button" value="send" onClick={props.handleEmailDialogButton}>
                    {he.translate('global__send')}
                </button>
                <button type="button" className="util-button cancel" value="cancel" onClick={props.handleEmailDialogButton}>
                    {he.translate('global__cancel')}
                </button>
            </div>
        );
    };


    // ----------------------------- <RenameLabelPanel /> ------------------------------


    class RenameLabelPanel extends React.Component {

        constructor(props) {
            super(props);
            this._handleConfirmClick = this._handleConfirmClick.bind(this);
            this._handleSrcInputChange = this._handleSrcInputChange.bind(this);
            this._handleDstInputChange = this._handleDstInputChange.bind(this);
            this.state = {
                srcGroupNum: '',
                dstGroupNum: ''
            };
        }

        _handleConfirmClick() {
            const newState = he.cloneState(this.state);
            this.setState(newState);
            dispatcher.dispatch({
                actionType: 'LINE_SELECTION_GROUP_RENAME',
                props: {
                    srcGroupNum: Number(this.state.srcGroupNum),
                    dstGroupNum: this.state.dstGroupNum ? Number(this.state.dstGroupNum) : -1
                }
            });
        }

        _handleSrcInputChange(evt) {
            const newState = he.cloneState(this.state);
            newState.srcGroupNum = evt.target.value ? parseInt(evt.target.value) : null;
            this.setState(newState);
        }

        _handleDstInputChange(evt) {
            const newState = he.cloneState(this.state);
            newState.dstGroupNum = evt.target.value ? parseInt(evt.target.value) : null;
            this.setState(newState);
        }

        render() {
            return (
                <fieldset>
                    <legend>{he.translate('linesel__rename_drop_heading')}</legend>
                    <label>{he.translate('linesel__old_label_name')}:</label>
                    {'\u00A0'}#<input type="text" style={{width: '2em'}} onChange={this._handleSrcInputChange} />
                    <span className="arrow">{'\u00A0\u21E8\u00A0'}</span>
                    <label>{he.translate('linesel__new_label_name')}:</label>
                    {'\u00A0'}#<input type="text" style={{width: '2em'}} onChange={this._handleDstInputChange} />
                    <ul className="note">
                        <li>{he.translate('linesel__if_empty_lab_then_remove')}</li>
                        <li>{he.translate('linesel__if_existing_lab_then_merge')}</li>
                    </ul>
                    {this.state.waiting ?
                        <img className="ajax-loader-bar" src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                                title={he.translate('global__loading')} />
                        : <button className="ok" type="button" onClick={this._handleConfirmClick}>{he.translate('global__ok')}</button>
                    }
                    <button type="button" onClick={this.props.handleCancel}>{he.translate('global__cancel')}</button>
                </fieldset>
            );
        }
    }

    // ----------------------------- <ActionSwitch /> ------------------------------

    const ActionSwitch = (props) => {
        return (
            <div className="actions">
                {he.translate('global__actions')}:{'\u00A0'}
                <select onChange={props.changeHandler}>
                    <option value="">--</option>
                    <option value="edit-groups">{he.translate('linesel__continue_editing_groups')}</option>
                    <option value="sort-groups">{he.translate('linesel__view_sorted_groups')}</option>
                    <option value="rename-group-label">{he.translate('linesel__rename_label')}...</option>
                    <option value="remove-other-lines">{he.translate('linesel__remove_non_group_lines')}</option>
                    <option value="clear-groups">{he.translate('linesel__clear_line_groups')}</option>
                </select>
                {props.waiting ?
                    <img className="ajax-loader-bar" src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                        title={he.translate('global__loading')} />
                    : null}
            </div>
        );
    };

    // ----------------------------- <SelectionLinkAndTools /> ------------------------------

    const SelectionLinkAndTools = (props) => {

        const renderEmailButton = () => {
            if (props.canSendEmail) {
                return (
                    <button type="button" className="util-button" onClick={props.handleDialogShowClick}>
                        {he.translate('linesel__send_the_link_to_mail')}
                    </button>
                );
            }
            return null;
        };

        return (
            <fieldset className="generated-link">
                <legend>{he.translate('linesel__line_selection_link_heading')}</legend>
                <input className="conc-link" type="text" readOnly="true"
                        onClick={(e)=> e.target.select()}
                        value={props.lastCheckpointUrl} />
                {props.emailDialogCredentials ?
                    <EmailDialog
                            defaultEmail={props.emailDialogCredentials.email}
                            handleEmailDialogButton={props.handleEmailDialogButton}
                            emailChangeHandler={props.emailChangeHandler} /> :
                    renderEmailButton()
                }
            </fieldset>
        );
    };


    // ----------------------------- <LockedLineGroupsMenu /> ------------------------------

    class LockedLineGroupsMenu extends React.Component {

        constructor(props) {
            super(props);
            this._changeHandler = this._changeHandler.bind(this);
            this._actionSwitchHandler = this._actionSwitchHandler.bind(this);
            this._handleEmailDialogButton = this._handleEmailDialogButton.bind(this);
            this._emailChangeHandler = this._emailChangeHandler.bind(this);
            this._handleRenameCancel = this._handleRenameCancel.bind(this);
            this._handleDialogShowClick = this._handleDialogShowClick.bind(this);
            this.state = this._fetchStoreState();
        }

        _fetchStoreState() {
            return {
                emailDialogCredentials: lineSelectionStore.getEmailDialogCredentials(),
                renameLabelDialog: false,
                email: null,
                waiting: lineSelectionStore.isBusy(),
                lastCheckpointUrl: lineSelectionStore.getLastCheckpointUrl()
            };
        }

        _changeHandler() {
            if (this.props.mode === 'groups') { // prevent unmounted component update
                this.setState(this._fetchStoreState());
            }
        }

        _actionSwitchHandler(evt) {
            switch (evt.target.value) {
                case 'edit-groups':
                    const newState1 = he.cloneState(this.state);
                    newState1.waiting = true;
                    this.setState(newState1);
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
                    const newState2 = he.cloneState(this.state);
                    newState2.renameLabelDialog = true;
                    this.setState(newState2);
                    break;
            }
        }

        _handleEmailDialogButton(evt) {
            if (evt.target.value === 'cancel') {
                dispatcher.dispatch({
                    actionType: 'LINE_SELECTION_CLEAR_USER_CREDENTIALS',
                    props: {}
                });

            } else if (evt.target.value === 'send') {
                dispatcher.dispatch({
                    actionType: 'LINE_SELECTION_SEND_URL_TO_EMAIL',
                    props: {
                        email: this.state.email
                    }
                })
            }
        }

        _emailChangeHandler(evt) {
            const newState = he.cloneState(this.state);
            newState.email = evt.target.value;
            this.setState(newState);
        }

        _handleDialogShowClick(evt) {
            dispatcher.dispatch({
                actionType: 'LINE_SELECTION_LOAD_USER_CREDENTIALS',
                props: {}
            });
        }

        componentDidMount() {
            lineSelectionStore.addChangeListener(this._changeHandler);
            dispatcher.dispatch({
                actionType: 'LINE_SELECTION_STATUS_REQUEST',
                props: {
                    email: this.state.email
                }
            });
        }

        componentWillUnmount() {
            lineSelectionStore.removeChangeListener(this._changeHandler);
        }

        componentDidUpdate(prevProps, prevState) {
            // we must inform non-react chart building function to redraw d3 charts
            if (typeof this.props.chartCallback === 'function') {
                this.props.chartCallback(prevState.lastCheckpointUrl !== this.state.lastCheckpointUrl); // = false => do not use prev data
            }
        }

        _handleRenameCancel() {
            const newState = he.cloneState(this.state);
            newState.renameLabelDialog = false;
            this.setState(newState);
        }

        render() {
            return (
                <div id="selection-actions">
                    <h3>{he.translate('linesel__saved_line_groups_heading')}</h3>

                    {this.state.renameLabelDialog ?
                        <RenameLabelPanel handleCancel={this._handleRenameCancel} /> :
                        <ActionSwitch waiting={this.state.waiting} changeHandler={this._actionSwitchHandler} />}

                    <fieldset className="chart-area">
                        <img className="ajax-loader" src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                                title={he.translate('global__loading')} />
                    </fieldset>

                    <SelectionLinkAndTools
                            lastCheckpointUrl={this.state.lastCheckpointUrl}
                            email={this.state.email}
                            emailDialogCredentials={this.state.emailDialogCredentials}
                            canSendEmail={this.props.canSendEmail}
                            handleEmailDialogButton={this._handleEmailDialogButton}
                            handleDialogShowClick={this._handleDialogShowClick}
                            emailChangeHandler={this._emailChangeHandler} />
                </div>
            )
        }
    }

    return {
        LineBinarySelectionMenu: LineBinarySelectionMenu,
        LockedLineGroupsMenu: LockedLineGroupsMenu
    };
}
