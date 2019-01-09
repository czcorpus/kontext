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
import * as Rx from '@reactivex/rxjs';
import {Kontext} from '../../../types/common';
import {ActionDispatcher} from '../../../app/dispatcher';
import {UserProfileModel, UserProfileState, Actions, UsernameAvailability} from './../profile';
import { UserProfileViews } from './profile';


export interface UserSignUpViews {
    SignUpForm:React.ComponentClass;
}


export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers, userProfileModel:UserProfileModel,
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

        private writingStream:Rx.Subject<string>;

        private writingThrottle:Rx.Observable<string>;

        private static USERNAME_WRITING_THROTTLE_INTERVAL = 500;

        constructor(props) {
            super(props);
            this.handleUsernameChange = this.handleUsernameChange.bind(this);
            this.writingStream = new Rx.Subject<string>();
            this.writingThrottle = this.writingStream.debounceTime(TrUsernameInput.USERNAME_WRITING_THROTTLE_INTERVAL);
            this.writingThrottle.subscribe({
                next: (v:string) => {
                    dispatcher.dispatch({
                        actionType: Actions.CHECK_USERNAME,
                        props: {}
                    });
                }
            });
        }

        private handleUsernameChange(evt:React.ChangeEvent<HTMLInputElement>):void {
            dispatcher.dispatch({
                actionType: Actions.SET_USERNAME,
                props: {
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

    class SignUpForm extends React.Component<{}, UserProfileState> {

        constructor(props) {
            super(props);
            this.state = userProfileModel.getState();
            this.handleModelChange = this.handleModelChange.bind(this);
            this.handleFirstNameChange = this.handleFirstNameChange.bind(this);
            this.handleLastNameChange = this.handleLastNameChange.bind(this);
            this.handleEmailChange = this.handleEmailChange.bind(this);
            this.handleSignUpButton = this.handleSignUpButton.bind(this);
            this.handleNewRegistration = this.handleNewRegistration.bind(this);
            this.handleGoToMainpage = this.handleGoToMainpage.bind(this);
        }

        private handleModelChange(state:UserProfileState) {
            this.setState(state);
        }

        private handleFirstNameChange(evt:React.ChangeEvent<HTMLInputElement>):void {
            dispatcher.dispatch({
                actionType: Actions.SET_FIRSTNAME,
                props: {
                    value: evt.target.value
                }
            });
        }

        private handleLastNameChange(evt:React.ChangeEvent<HTMLInputElement>):void {
            dispatcher.dispatch({
                actionType: Actions.SET_LASTNAME,
                props: {
                    value: evt.target.value
                }
            });
        }

        private handleEmailChange(evt:React.ChangeEvent<HTMLInputElement>):void {
            dispatcher.dispatch({
                actionType: Actions.SET_EMAIL,
                props: {
                    value: evt.target.value
                }
            });
        }

        private handleSignUpButton(evt:React.MouseEvent<HTMLButtonElement>):void {
            dispatcher.dispatch({
                actionType: Actions.SUBMIT_SIGN_UP,
                props: {}
            });
        }

        private handleNewRegistration(evt:React.MouseEvent<HTMLButtonElement>):void {
            dispatcher.dispatch({
                actionType: Actions.NEW_REGISTRATION,
                props: {}
            });
        }

        private handleGoToMainpage(evt:React.MouseEvent<HTMLButtonElement>):void {
            dispatcher.dispatch({
                actionType: Actions.GO_TO_MAIN_PAGE,
                props: {}
            });
        }

        componentDidMount() {
            userProfileModel.addChangeListener(this.handleModelChange);
        }

        componentWillUnmount() {
            userProfileModel.removeChangeListener(this.handleModelChange);
        }

        render() {
            if (this.state.isFinished) {
                return (
                    <form className="SignUpForm">
                        <fieldset>
                            <legend>{he.translate('user__signup_heading')}</legend>
                            <p className="confirm-msg">
                                <img src={he.createStaticUrl('img/info-icon.svg')} alt={he.translate('global__info_icon')} />
                                {he.translate('user__confirm_mail_has_been_sent_{email}', {email: this.state.email.value})}
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
                        {this.state.message ?
                        <p className="message"><layoutViews.StatusIcon inline={true} status="warning" />{this.state.message}</p> :
                        null}
                        <fieldset>
                            <legend>{he.translate('user__signup_heading')}</legend>
                            <table className="form">
                                <tbody>
                                    <TrUsernameInput value={this.state.username}
                                            usernameAvail={this.state.usernameAvail}
                                            usernameAvailBusy={this.state.usernameAvailBusy} />
                                    <profileViews.TrUserFirstNameInput value={this.state.firstName} onChange={this.handleFirstNameChange} />
                                    <profileViews.TrUserLastNameInput value={this.state.lastName} onChange={this.handleLastNameChange} />
                                    <profileViews.TrUserEmailInput value={this.state.email} onChange={this.handleEmailChange} />
                                    <profileViews.TRNewPasswdInput value={this.state.newPasswd} isRegistration={true} />
                                    <profileViews.TRNewPasswdInput2 value={this.state.newPasswd2} isRegistration={true} />
                                </tbody>
                            </table>
                            <p>
                                {this.state.isBusy ?
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
        SignUpForm: SignUpForm
    };
}
