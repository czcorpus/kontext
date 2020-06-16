/*
 * Copyright (c) 2019 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2019 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IActionDispatcher, Bound } from 'kombo';
import { Subject, Observable, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators'

import { Kontext } from '../../../types/common';
import { UserProfileModel, UserProfileState, Actions, UsernameAvailability } from './../profile';
import { UserProfileViews } from './profile';


export interface UserSignUpViews {
    SignUpForm:React.ComponentClass;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, userProfileModel:UserProfileModel,
            profileViews:UserProfileViews):UserSignUpViews {

    const layoutViews = he.getLayoutViews();

    // --------------- <UsernameAvailFlag /> ----------------------------------------------

    const UsernameAvailFlag:React.SFC<{
        status:UsernameAvailability;
        isBusy:boolean;
    }> = (props) => {

        const getMsg = () => {
            switch (props.status) {
                case UsernameAvailability.AVAILABLE:
                    return <>(
                        <img src={he.createStaticUrl('img/info-icon.svg')} alt={he.translate('global__info_icon')} />
                        {he.translate('user__username_avail')})
                    </>;
                case UsernameAvailability.NOT_AVAILABLE:
                    return <>(
                        <img src={he.createStaticUrl('img/error-icon.svg')} alt={he.translate('global__error_icon')} />
                        {he.translate('user__username_not_avail')})
                    </>;
                case UsernameAvailability.UNKNOWN:
                default:
                    return <></>;
            }
        };

        return <span className="UsernameAvailFlag">
            {props.isBusy ? <layoutViews.AjaxLoaderBarImage /> : getMsg()}
        </span>;
    };

    // --------------- <TrUsernameInput /> ----------------------------------------------

    class TrUsernameInput extends React.PureComponent<{
        value:Kontext.FormValue<string>;
        usernameAvail:UsernameAvailability;
        usernameAvailBusy:boolean;
    }> {

        private writingStream:Subject<string>;

        private writingThrottle:Observable<string>;

        private static USERNAME_WRITING_THROTTLE_INTERVAL = 500;

        constructor(props) {
            super(props);
            this.handleUsernameChange = this.handleUsernameChange.bind(this);
            this.writingStream = new Subject<string>();
            this.writingThrottle = this.writingStream.pipe(debounceTime(TrUsernameInput.USERNAME_WRITING_THROTTLE_INTERVAL));
            this.writingThrottle.subscribe({
                next: (v:string) => {
                    dispatcher.dispatch({
                        name: Actions.CHECK_USERNAME,
                        payload: {}
                    });
                }
            });
        }

        private handleUsernameChange(evt:React.ChangeEvent<HTMLInputElement>):void {
            dispatcher.dispatch({
                name: Actions.SET_USERNAME,
                payload: {
                    value: evt.target.value
                }
            });
            this.writingStream.next(evt.target.value);
        }

        render() {
            return (
                <tr>
                    <th>
                        {he.translate('user__username')}:
                    </th>
                    <td>
                        <layoutViews.ValidatedItem invalid={this.props.value.isInvalid} errorDesc={this.props.value.errorDesc}>
                            <input type="text" value={this.props.value.value} onChange={this.handleUsernameChange} />
                        </layoutViews.ValidatedItem>
                        <UsernameAvailFlag status={this.props.usernameAvail} isBusy={this.props.usernameAvailBusy} />
                    </td>
                </tr>
            );
        }
    }

    // --------------- <SignUpForm /> ----------------------------------------------

    class SignUpForm extends React.PureComponent<UserProfileState> {

        constructor(props) {
            super(props);
            this.handleFirstNameChange = this.handleFirstNameChange.bind(this);
            this.handleLastNameChange = this.handleLastNameChange.bind(this);
            this.handleEmailChange = this.handleEmailChange.bind(this);
            this.handleSignUpButton = this.handleSignUpButton.bind(this);
            this.handleNewRegistration = this.handleNewRegistration.bind(this);
            this.handleGoToMainpage = this.handleGoToMainpage.bind(this);
        }

        private handleFirstNameChange(evt:React.ChangeEvent<HTMLInputElement>):void {
            dispatcher.dispatch({
                name: Actions.SET_FIRSTNAME,
                payload: {
                    value: evt.target.value
                }
            });
        }

        private handleLastNameChange(evt:React.ChangeEvent<HTMLInputElement>):void {
            dispatcher.dispatch({
                name: Actions.SET_LASTNAME,
                payload: {
                    value: evt.target.value
                }
            });
        }

        private handleEmailChange(evt:React.ChangeEvent<HTMLInputElement>):void {
            dispatcher.dispatch({
                name: Actions.SET_EMAIL,
                payload: {
                    value: evt.target.value
                }
            });
        }

        private handleSignUpButton(evt:React.MouseEvent<HTMLButtonElement>):void {
            dispatcher.dispatch({
                name: Actions.SUBMIT_SIGN_UP,
                payload: {}
            });
        }

        private handleNewRegistration(evt:React.MouseEvent<HTMLButtonElement>):void {
            dispatcher.dispatch({
                name: Actions.NEW_REGISTRATION,
                payload: {}
            });
        }

        private handleGoToMainpage(evt:React.MouseEvent<HTMLButtonElement>):void {
            dispatcher.dispatch({
                name: Actions.GO_TO_MAIN_PAGE,
                payload: {}
            });
        }

        render() {
            if (this.props.isFinished) {
                return (
                    <form className="SignUpForm">
                        <fieldset>
                            <legend>{he.translate('user__signup_heading')}</legend>
                            <p className="confirm-msg">
                                <img src={he.createStaticUrl('img/info-icon.svg')} alt={he.translate('global__info_icon')} />
                                {he.translate('user__confirm_mail_has_been_sent_{email}', {email: this.props.email.value})}
                            </p>
                            <p>
                                <button type="button" className="util-button" onClick={this.handleNewRegistration}>
                                    {he.translate('user__new_sign_up')}
                                </button>
                                {'\u00a0'}
                                <button type="button" className="util-button" onClick={this.handleGoToMainpage}>
                                    {he.translate('user__go_main_page')}
                                </button>
                            </p>
                        </fieldset>
                    </form>
                );

            } else {
                return (
                    <form className="SignUpForm">
                        {this.props.message ?
                        <p className="message"><layoutViews.StatusIcon inline={true} status="warning" />{this.props.message}</p> :
                        null}
                        <fieldset>
                            <legend>{he.translate('user__signup_heading')}</legend>
                            <table className="form">
                                <tbody>
                                    <TrUsernameInput value={this.props.username}
                                            usernameAvail={this.props.usernameAvail}
                                            usernameAvailBusy={this.props.usernameAvailBusy} />
                                    <profileViews.TrUserFirstNameInput value={this.props.firstName} onChange={this.handleFirstNameChange} />
                                    <profileViews.TrUserLastNameInput value={this.props.lastName} onChange={this.handleLastNameChange} />
                                    <profileViews.TrUserEmailInput value={this.props.email} onChange={this.handleEmailChange} />
                                    <profileViews.TRNewPasswdInput value={this.props.newPasswd} isRegistration={true} />
                                    <profileViews.TRNewPasswdInput2 value={this.props.newPasswd2} isRegistration={true} />
                                </tbody>
                            </table>
                            <p>
                                {this.props.isBusy ?
                                    <layoutViews.AjaxLoaderBarImage /> :
                                    <button type="button" className="default-button" onClick={this.handleSignUpButton}>
                                        {he.translate('user__signup_btn')}
                                    </button>
                                }
                            </p>
                        </fieldset>
                    </form>
                );
            }

        }
    }


    return {
        SignUpForm: Bound(SignUpForm, userProfileModel)
    };
}
