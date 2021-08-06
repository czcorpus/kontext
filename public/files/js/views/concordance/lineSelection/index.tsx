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
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { Kontext } from '../../../types/common';
import { LineSelectionModel, LineSelectionModelState } from '../../../models/concordance/lineSelection';
import { Actions } from '../../../models/concordance/actions';
import { Actions as UserActions } from '../../../models/user/actions';
import { LineSelectionModes, DrawLineSelectionChart } from '../../../models/concordance/common';
import * as S from './style';


export interface LockedLineGroupsMenuProps {
    corpusId:string;
    canSendEmail:boolean;
    mode:LineSelectionModes;
    onChartFrameReady:DrawLineSelectionChart;
}

export interface LineSelectionViews {
    UnsavedLineSelectionMenu:React.FC<{mode:LineSelectionModes; isBusy:boolean}>;
    LockedLineGroupsMenu:React.ComponentClass<LockedLineGroupsMenuProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            lineSelectionModel:LineSelectionModel):LineSelectionViews {

    // ----------------------------- <SimpleSelectionModeSwitch /> --------------------------

    const SimpleSelectionModeSwitch:React.FC<{
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

    const GroupsSelectionModelSwitch:React.FC<{
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

    // ----------------------------- <UnsavedLineSelectionMenu /> --------------------------

    const UnsavedLineSelectionMenu:React.FC<{mode:LineSelectionModes; isBusy:boolean}> = (props) => {

        const actionChangeHandler = (evt:React.ChangeEvent<{value:string}>) => {
            switch (evt.target.value) {
                case 'clear':
                    dispatcher.dispatch<typeof Actions.LineSelectionReset>({
                        name: Actions.LineSelectionReset.name
                    });
                break;
                case 'remove':
                    dispatcher.dispatch<typeof Actions.RemoveSelectedLines>({
                        name: Actions.RemoveSelectedLines.name
                    });
                break;
                case 'remove_inverted':
                    dispatcher.dispatch<typeof Actions.RemoveNonSelectedLines>({
                        name: Actions.RemoveNonSelectedLines.name
                    });
                break;
                case 'apply':
                    dispatcher.dispatch<typeof Actions.MarkLines>({
                        name: Actions.MarkLines.name
                    });
                break;
            }
        };

        let switchComponent = null;
        if (props.mode === 'simple') {
            switchComponent = <SimpleSelectionModeSwitch initialAction="-"
                                switchHandler={actionChangeHandler} />;

        } else if (props.mode === 'groups') {
            switchComponent = <GroupsSelectionModelSwitch initialAction="-"
                                switchHandler={actionChangeHandler} />;
        }

        let heading;
        if (props.mode === 'simple') {
            heading = he.translate('linesel__unsaved_line_selection_heading');

        } else if (props.mode === 'groups') {
            heading = he.translate('linesel__unsaved_line_groups_heading');
        }

        return (
            <div id="selection-actions">
                <h3>{heading}</h3>
                {he.translate('global__actions')}:{'\u00A0'}
                {switchComponent}
                {props.isBusy ?
                    <img className="ajax-loader-bar" src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                            title={he.translate('global__loading')} />
                    : null}
                {props.mode === 'groups' ?
                    <p style={{marginTop: '1em'}}>({he.translate('linesel__no_ops_after_groups_save_info')}.)</p> : null}
            </div>
        );
    };

    // --------------------------- <EmailDialog /> ----------------------------

    const EmailDialog:React.FC<{
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
            this.setState({...this.state});
            dispatcher.dispatch<typeof Actions.RenameSelectionGroup>({
                name: Actions.RenameSelectionGroup.name,
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

    const ActionSwitch:React.FC<{
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

    const SelectionLinkAndTools:React.FC<{
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

    // ----------------------------- <LockedLineGroupsChart /> -----------------------------

    const LockedLineGroupsChart:React.FC<{
        corpusId:string;
        onReady:DrawLineSelectionChart;

    }> = (props) => {

        const ref = React.useRef(null);
        React.useEffect(
            () => {
                if (ref.current) {
                    const width = ref.current.getBoundingClientRect().width;
                    const height = ref.current.getBoundingClientRect().height;
                    props.onReady(ref.current, props.corpusId, [width, height]);
                }
            },
            []
        );

        return (
            <fieldset className="chart-area" ref={ref}>
                {ref.current ?
                    null :
                    <img className="ajax-loader" src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                        title={he.translate('global__loading')} />
                }
            </fieldset>
        );
    };


    // ----------------------------- <LockedLineGroupsMenu /> ------------------------------

    class LockedLineGroupsMenu extends React.Component<LockedLineGroupsMenuProps & LineSelectionModelState> {

        constructor(props) {
            super(props);
            this._actionSwitchHandler = this._actionSwitchHandler.bind(this);
            this._handleEmailDialogButton = this._handleEmailDialogButton.bind(this);
            this._emailChangeHandler = this._emailChangeHandler.bind(this);
            this._handleDialogShowClick = this._handleDialogShowClick.bind(this);
        }

        _actionSwitchHandler(evt) {
            switch (evt.target.value) {
                case 'edit-groups':
                    dispatcher.dispatch<typeof Actions.UnlockLineSelection>({
                        name: Actions.UnlockLineSelection.name
                    });
                    break;
                case 'sort-groups':
                    dispatcher.dispatch<typeof Actions.SortLineSelection>({
                        name: Actions.SortLineSelection.name
                    });
                    break;
                case 'clear-groups':
                    dispatcher.dispatch<typeof Actions.LineSelectionResetOnServer>({
                        name: Actions.LineSelectionResetOnServer.name
                    });
                    break;
                case 'remove-other-lines':
                    dispatcher.dispatch<typeof Actions.RemoveLinesNotInGroups>({
                        name: Actions.RemoveLinesNotInGroups.name
                    });
                    break;
                case 'rename-group-label':
                    dispatcher.dispatch<typeof Actions.ToggleLineGroupRenameForm>({
                        name: Actions.ToggleLineGroupRenameForm.name
                    });
                    break;
            }
        }

        _handleEmailDialogButton(evt:React.FormEvent<{value:string}>) {
            if (evt.currentTarget.value === 'cancel') {
                dispatcher.dispatch<typeof Actions.ClearUserCredentials>({
                    name: Actions.ClearUserCredentials.name,
                    payload: {}
                });

            } else if (evt.currentTarget.value === 'send') {
                dispatcher.dispatch<typeof Actions.SendLineSelectionToEmail>({
                    name: Actions.SendLineSelectionToEmail.name,
                    payload: {
                        email: this.props.emailDialogCredentials.email
                    }
                })
            }
        }

        _emailChangeHandler(evt:React.ChangeEvent<{value:string}>) {
            dispatcher.dispatch<typeof Actions.ChangeEmail>({
                name: Actions.ChangeEmail.name,
                payload: {
                    email: evt.target.value
                }
            });
        }

        _handleDialogShowClick(evt:React.MouseEvent<{}>) {
            dispatcher.dispatch<typeof UserActions.UserInfoRequested>({
                name: UserActions.UserInfoRequested.name
            });
        }

        _handleRenameCancel() {
            dispatcher.dispatch<typeof Actions.ToggleLineGroupRenameForm>({
                name: Actions.ToggleLineGroupRenameForm.name
            });
        }

        render() {
            return (
                <S.LockedLineGroupsMenu>
                    <h3>{he.translate('linesel__saved_line_groups_heading')}</h3>

                    {this.props.renameLabelDialogVisible ?
                        <RenameLabelPanel handleCancel={this._handleRenameCancel} /> :
                        <ActionSwitch waiting={this.props.isBusy} changeHandler={this._actionSwitchHandler} />}

                    <LockedLineGroupsChart onReady={this.props.onChartFrameReady} corpusId={this.props.corpusId} />

                    <SelectionLinkAndTools
                            lastCheckpointUrl={this.props.lastCheckpointUrl}
                            emailDialogCredentials={this.props.emailDialogCredentials}
                            canSendEmail={this.props.canSendEmail}
                            handleEmailDialogButton={this._handleEmailDialogButton}
                            handleDialogShowClick={this._handleDialogShowClick}
                            emailChangeHandler={this._emailChangeHandler} />
                </S.LockedLineGroupsMenu>
            )
        }
    }

    const BoundLockedLineGroupsMenu = BoundWithProps<LockedLineGroupsMenuProps, LineSelectionModelState>(LockedLineGroupsMenu, lineSelectionModel);

    return {
        UnsavedLineSelectionMenu: UnsavedLineSelectionMenu,
        LockedLineGroupsMenu: BoundLockedLineGroupsMenu
    };
}
