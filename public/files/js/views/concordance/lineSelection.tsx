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

import * as React from 'react';
import {IActionDispatcher} from 'kombo';
import {Kontext} from '../../types/common';
import { LineSelectionModel } from '../../models/concordance/lineSelection';
import { Subscription } from 'rxjs';


export interface LineBinarySelectionMenuProps {

}


export interface LockedLineGroupsMenuProps {
    canSendEmail:boolean;
    mode:string; // TODO enum
    chartCallback:(v:boolean)=>void;
}


interface LockedLineGroupsMenuState {
    emailDialogCredentials:Kontext.UserCredentials;
    renameLabelDialog:boolean;
    email:string;
    waiting:boolean;
    lastCheckpointUrl:string;
}


export interface LineSelectionViews {
    LineBinarySelectionMenu:React.ComponentClass<LineBinarySelectionMenuProps>;
    LockedLineGroupsMenu:React.ComponentClass<LockedLineGroupsMenuProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            lineSelectionModel:LineSelectionModel):LineSelectionViews {

    // ----------------------------- <SimpleSelectionModeSwitch /> --------------------------

    const SimpleSelectionModeSwitch:React.SFC<{
        initialAction:string;
        switchHandler:(evt:React.ChangeEvent<{value:string}>)=>void;

    }> = (props) => {

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

    const GroupsSelectionModelSwitch:React.SFC<{
        initialAction:string;
        switchHandler:(evt:React.ChangeEvent<{value:string}>)=>void;

    }> = (props) => {

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

    class LineBinarySelectionMenu extends React.Component<{
        mode:string;
    },
    {
        mode:string;
        waiting:boolean;
    }> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._changeHandler = this._changeHandler.bind(this);
            this._actionChangeHandler = this._actionChangeHandler.bind(this);
            this.state = this._fetchModelState();
        }

        _fetchModelState() {
            return {
                mode: lineSelectionModel.getMode(),
                waiting: lineSelectionModel.isBusy()
            };
        }

        _changeHandler() {
            if (this.props.mode === 'simple') { // prevent unmounted component update
                this.setState(this._fetchModelState());
            }
        }

        _actionChangeHandler(evt:React.ChangeEvent<{value:string}>) {
            const actionMap = {
                clear: 'LINE_SELECTION_RESET',
                remove: 'LINE_SELECTION_REMOVE_LINES',
                remove_inverted: 'LINE_SELECTION_REMOVE_OTHER_LINES',
                apply: 'LINE_SELECTION_MARK_LINES'
            };
            const eventId = actionMap[evt.target.value] || null;

            if (eventId) {
                dispatcher.dispatch({
                    name: eventId,
                    payload: {}
                });
            }
        }

        componentDidMount() {
            this.modelSubscription = lineSelectionModel.addListener(this._changeHandler);
            dispatcher.dispatch({
                name: 'LINE_SELECTION_STATUS_REQUEST',
                payload: {}
            });
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
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

    const EmailDialog:React.SFC<{
        defaultEmail:string;
        emailChangeHandler:(evt:React.ChangeEvent<{value:string}>)=>void;
        handleEmailDialogButton:(evt:React.FormEvent<{value:string}>)=>void;

    }> = (props) => {

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


    class RenameLabelPanel extends React.Component<{
        handleCancel:()=>void;
    },
    {
        srcGroupNum:string;
        dstGroupNum:string;
        waiting:boolean;
    }> {

        constructor(props) {
            super(props);
            this._handleConfirmClick = this._handleConfirmClick.bind(this);
            this._handleSrcInputChange = this._handleSrcInputChange.bind(this);
            this._handleDstInputChange = this._handleDstInputChange.bind(this);
            this.state = {
                srcGroupNum: '',
                dstGroupNum: '',
                waiting: false
            };
        }

        _handleConfirmClick() {
            const newState = he.cloneState(this.state);
            this.setState(newState);
            dispatcher.dispatch({
                name: 'LINE_SELECTION_GROUP_RENAME',
                payload: {
                    srcGroupNum: Number(this.state.srcGroupNum),
                    dstGroupNum: this.state.dstGroupNum ? Number(this.state.dstGroupNum) : -1
                }
            });
        }

        _handleSrcInputChange(evt) {
            const newState = he.cloneState(this.state);
            newState.srcGroupNum = evt.target.value ? evt.target.value : null;
            this.setState(newState);
        }

        _handleDstInputChange(evt) {
            const newState = he.cloneState(this.state);
            newState.dstGroupNum = evt.target.value ? evt.target.value : null;
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

    const ActionSwitch:React.SFC<{
        changeHandler:(evt:React.ChangeEvent<{value:string}>)=>void;
        waiting:boolean;

    }> = (props) => {
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

    const SelectionLinkAndTools:React.SFC<{
        canSendEmail:boolean;
        lastCheckpointUrl:string;
        emailDialogCredentials:Kontext.UserCredentials;
        handleDialogShowClick:(evt:React.MouseEvent<{}>)=>void;
        handleEmailDialogButton:(evt:React.FormEvent<{value:string}>)=>void;
        emailChangeHandler:(evt:React.ChangeEvent<{value:string}>)=>void;

    }> = (props) => {

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
                <input className="conc-link" type="text" readOnly={true}
                        onClick={(e)=> (e.target as HTMLInputElement).select()}
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

    class LockedLineGroupsMenu extends React.Component<LockedLineGroupsMenuProps, LockedLineGroupsMenuState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._changeHandler = this._changeHandler.bind(this);
            this._actionSwitchHandler = this._actionSwitchHandler.bind(this);
            this._handleEmailDialogButton = this._handleEmailDialogButton.bind(this);
            this._emailChangeHandler = this._emailChangeHandler.bind(this);
            this._handleRenameCancel = this._handleRenameCancel.bind(this);
            this._handleDialogShowClick = this._handleDialogShowClick.bind(this);
            this.state = this._fetchModelState();
        }

        _fetchModelState() {
            const userCreds = lineSelectionModel.getEmailDialogCredentials();
            return {
                emailDialogCredentials: userCreds,
                renameLabelDialog: false,
                email: userCreds ? userCreds.email : '',
                waiting: lineSelectionModel.isBusy(),
                lastCheckpointUrl: lineSelectionModel.getLastCheckpointUrl()
            };
        }

        _changeHandler() {
            if (this.props.mode === 'groups') { // prevent unmounted component update
                this.setState(this._fetchModelState());
            }
        }

        _actionSwitchHandler(evt) {
            switch (evt.target.value) {
                case 'edit-groups':
                    const newState1 = he.cloneState(this.state);
                    newState1.waiting = true;
                    this.setState(newState1);
                    dispatcher.dispatch({
                        name: 'LINE_SELECTION_REENABLE_EDIT',
                        payload: {}
                    });
                    break;
                case 'sort-groups':
                    dispatcher.dispatch({
                        name: 'LINE_SELECTION_SORT_LINES',
                        payload: {}
                    });
                    break;
                case 'clear-groups':
                    dispatcher.dispatch({
                        name: 'LINE_SELECTION_RESET_ON_SERVER',
                        payload: {}
                    });
                    break;
                case 'remove-other-lines':
                    dispatcher.dispatch({
                        name: 'LINE_SELECTION_REMOVE_NON_GROUP_LINES',
                        payload: {}
                    });
                    break;
                case 'rename-group-label':
                    const newState2 = he.cloneState(this.state);
                    newState2.renameLabelDialog = true;
                    this.setState(newState2);
                    break;
            }
        }

        _handleEmailDialogButton(evt:React.FormEvent<{value:string}>) {
            if (evt.currentTarget.value === 'cancel') {
                dispatcher.dispatch({
                    name: 'LINE_SELECTION_CLEAR_USER_CREDENTIALS',
                    payload: {}
                });

            } else if (evt.currentTarget.value === 'send') {
                dispatcher.dispatch({
                    name: 'LINE_SELECTION_SEND_URL_TO_EMAIL',
                    payload: {
                        email: this.state.email
                    }
                })
            }
        }

        _emailChangeHandler(evt:React.ChangeEvent<{value:string}>) {
            const newState = he.cloneState(this.state);
            newState.email = evt.target.value;
            this.setState(newState);
        }

        _handleDialogShowClick(evt:React.MouseEvent<{}>) {
            dispatcher.dispatch({
                name: 'LINE_SELECTION_LOAD_USER_CREDENTIALS',
                payload: {}
            });
        }

        componentDidMount() {
            this.modelSubscription = lineSelectionModel.addListener(this._changeHandler);
            dispatcher.dispatch({
                name: 'LINE_SELECTION_STATUS_REQUEST',
                payload: {
                    email: this.state.email
                }
            });
            if (typeof this.props.chartCallback === 'function') {
                this.props.chartCallback(false);
            }
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        componentDidUpdate(prevProps, prevState) {
            // we must inform non-react chart building function to redraw d3 charts
            if (typeof this.props.chartCallback === 'function'
                    && prevState.lastCheckpointUrl !== this.state.lastCheckpointUrl) {
                this.props.chartCallback(false); // = false => do not use prev data
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
