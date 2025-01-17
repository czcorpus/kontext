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
import * as Kontext from '../../../types/kontext.js';
import { LineSelectionModel, LineSelectionModelState } from '../../../models/concordance/lineSelection/index.js';
import { Actions } from '../../../models/concordance/actions.js';
import { Actions as UserActions } from '../../../models/user/actions.js';
import { LineSelectionModes } from '../../../models/concordance/common.js';
import { init as chartViewInit } from './groupChart.js';
import * as S from './style.js';


export interface LockedLineGroupsMenuProps {
    corpusId:string;
    canSendEmail:boolean;
    mode:LineSelectionModes;
}

export interface LineSelectionViews {
    UnsavedLineSelectionMenu:React.FC<{mode:LineSelectionModes; isBusy:boolean}>;
    LockedLineGroupsMenu:React.ComponentClass<LockedLineGroupsMenuProps>;
}


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    lineSelectionModel:LineSelectionModel

):LineSelectionViews {

    const ChartView = chartViewInit(he, dispatcher);
    const layoutViews = he.getLayoutViews();

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

        return (
            <div id="selection-actions">
                {he.translate('global__actions')}:{'\u00A0'}
                {switchComponent}
                {props.isBusy ? <layoutViews.AjaxLoaderImage /> : null}
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

    const RenameLabelPanel:React.FC<{
        srcGroup:Kontext.FormValue<string>;
        dstGroup:Kontext.FormValue<string>;
        isBusy:boolean;
        handleCancel:()=>void;
    }> = (props) => {

        const handleConfirmClick = () => {
            dispatcher.dispatch(
                Actions.RenameSelectionGroup
            );
        }

        const handleSrcInputChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.LineSelectionRnSetSrcGroup,
                {
                    value: evt.target.value
                }
            );
        }

        const handleDstInputChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.LineSelectionRnSetDstGroup,
                {
                    value: evt.target.value
                }
            );
        }

        return (
            <S.RenameLabelPanelFieldset>
                <legend>{he.translate('linesel__rename_drop_heading')}</legend>
                <div className="rename-command">
                    <label>{he.translate('linesel__old_label_name')}:</label>
                    <span className="group-hash">#</span>
                    <layoutViews.ValidatedItem invalid={props.srcGroup.isInvalid}>
                        <input type="text" style={{width: '2em'}} value={props.srcGroup.value} onChange={handleSrcInputChange} />
                    </layoutViews.ValidatedItem>
                    <span className="arrow">{'\u00A0\u21E8\u00A0'}</span>
                    <label>{he.translate('linesel__new_label_name')}:</label>
                    <span className="group-hash">#</span>
                    <layoutViews.ValidatedItem invalid={props.dstGroup.isInvalid}>
                        <input type="text" style={{width: '2em'}} value={props.dstGroup.value} onChange={handleDstInputChange} />
                    </layoutViews.ValidatedItem>
                </div>
                <ul className="note">
                    <li>{he.translate('linesel__if_empty_lab_then_remove')}</li>
                    <li>{he.translate('linesel__if_existing_lab_then_merge')}</li>
                </ul>
                {props.isBusy ?
                    <img className="ajax-loader-bar" src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                            title={he.translate('global__loading')} />
                    : <button className="util-button" type="button" onClick={handleConfirmClick}>
                            {he.translate('global__ok')}
                    </button>
                }
                <button type="button" className="util-button cancel" onClick={props.handleCancel}>
                    {he.translate('global__cancel')}
                </button>
            </S.RenameLabelPanelFieldset>
        );
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
                    <option value="go-to-first-selection">{he.translate('linesel__go_to_first_select')}</option>
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

        const copyToClipboard = () => {
            dispatcher.dispatch(
                Actions.CopyLineSelectionLinkToClipboard
            );
        };

        return (
            <S.SelectionLinkAndToolsFieldset>
                <legend>{he.translate('linesel__line_selection_link_heading')}</legend>
                <div className="link">
                    <input type="text" readOnly={true}
                            onClick={(e)=> (e.target as HTMLInputElement).select()}
                            value={props.lastCheckpointUrl} />
                    <a onClick={copyToClipboard}>
                        <layoutViews.ImgWithMouseover
                                src={he.createStaticUrl('img/copy-icon.svg')}
                                src2={he.createStaticUrl('img/copy-icon_s.svg')}
                                alt={he.translate('global__copy_to_clipboard')}
                                style={{width: '1.5em'}} />
                    </a>
                </div>
                <div>
                    {props.emailDialogCredentials ?
                        <EmailDialog
                                defaultEmail={props.emailDialogCredentials.email}
                                handleEmailDialogButton={props.handleEmailDialogButton}
                                emailChangeHandler={props.emailChangeHandler} /> :
                        renderEmailButton()
                    }
                </div>
            </S.SelectionLinkAndToolsFieldset>
        );
    };

    // ----------------------------- <LockedLineGroupsMenu /> ------------------------------

    const _LockedLineGroupsMenu:React.FC<LockedLineGroupsMenuProps & LineSelectionModelState> = (props) => {

        const actionSwitchHandler = (evt) => {
            switch (evt.target.value) {
                case 'edit-groups':
                    dispatcher.dispatch(
                        Actions.UnlockLineSelection
                    );
                    break;
                case 'sort-groups':
                    dispatcher.dispatch(
                        Actions.SortLineSelection
                    );
                    break;
                case 'clear-groups':
                    dispatcher.dispatch(
                        Actions.LineSelectionResetOnServer
                    );
                    break;
                case 'remove-other-lines':
                    dispatcher.dispatch(
                        Actions.RemoveLinesNotInGroups
                    );
                    break;
                case 'rename-group-label':
                    dispatcher.dispatch(
                        Actions.ToggleLineGroupRenameForm
                    );
                    break;
                case 'go-to-first-selection':
                    dispatcher.dispatch(Actions.SwitchFirstSelectPage);
                    break;
            }
        }

        const handleEmailDialogButton = (evt:React.FormEvent<{value:string}>) => {
            if (evt.currentTarget.value === 'cancel') {
                dispatcher.dispatch(
                    Actions.ClearUserCredentials,
                );

            } else if (evt.currentTarget.value === 'send') {
                dispatcher.dispatch(
                    Actions.SendLineSelectionToEmail,
                    {
                        email: props.emailDialogCredentials.email
                    }
                )
            }
        };

        const emailChangeHandler = (evt:React.ChangeEvent<{value:string}>) => {
            dispatcher.dispatch(
                Actions.ChangeEmail,
                {
                    email: evt.target.value
                }
            );
        };

        const handleDialogShowClick = (evt:React.MouseEvent<{}>) => {
            dispatcher.dispatch(
                UserActions.UserInfoRequested
            );
        };

        const handleRenameCancel = () => {
            dispatcher.dispatch(
                Actions.ToggleLineGroupRenameForm
            );
        };

        const handleSrcInputChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.LineSelectionRnSetSrcGroup,
                {
                    value: evt.target.value
                }
            );
        }

        return (
            <S.LockedLineGroupsMenu>
                {props.renameLabelDialogVisible ?
                    <RenameLabelPanel
                        srcGroup={props.srcGroupNum}
                        dstGroup={props.dstGroupNum}
                        isBusy={props.isBusy}
                        handleCancel={handleRenameCancel} /> :
                    <ActionSwitch waiting={props.isBusy} changeHandler={actionSwitchHandler} />}
                <ChartView {...props} />

                <SelectionLinkAndTools
                        lastCheckpointUrl={props.lastCheckpointUrl}
                        emailDialogCredentials={props.emailDialogCredentials}
                        canSendEmail={props.canSendEmail}
                        handleEmailDialogButton={handleEmailDialogButton}
                        handleDialogShowClick={handleDialogShowClick}
                        emailChangeHandler={emailChangeHandler} />
            </S.LockedLineGroupsMenu>
        )
    }

    const LockedLineGroupsMenu = BoundWithProps<LockedLineGroupsMenuProps, LineSelectionModelState>(
        _LockedLineGroupsMenu, lineSelectionModel);

    return {
        UnsavedLineSelectionMenu,
        LockedLineGroupsMenu
    };
}
