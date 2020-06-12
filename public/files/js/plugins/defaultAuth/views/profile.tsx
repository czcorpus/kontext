/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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
import {Kontext} from '../../../types/common';
import {UserProfileModel, UserProfileState} from '../profile';
import { ReactElement } from 'react';
import { IActionDispatcher } from 'kombo';
import { Subscription } from 'rxjs';

export interface UserProfileViews {
    UserProfileView:React.ComponentClass;
    TRNewPasswdInput:React.SFC<{
        value:Kontext.FormValue<string>;
        isRegistration:boolean;
    }>;
    TRNewPasswdInput2:React.SFC<{
        value:Kontext.FormValue<string>;
        isRegistration:boolean;
    }>;
    TrUserFirstNameInput:React.SFC<{
        onChange?:((evt:React.ChangeEvent<HTMLInputElement>)=>void);
        value:Kontext.FormValue<string>;
    }>;
    TrUserLastNameInput:React.SFC<{
        onChange?:((evt:React.ChangeEvent<HTMLInputElement>)=>void);
        value:Kontext.FormValue<string>;
    }>;
    TrUserEmailInput:React.SFC<{
        onChange?:((evt:React.ChangeEvent<HTMLInputElement>)=>void);
        value:Kontext.FormValue<string>;
    }>;
}

export interface UserProfileViewProps {

}

export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, profileModel:UserProfileModel):UserProfileViews {

    const layoutViews = he.getLayoutViews();

    /**
     *
     * @param props
     */
    const TRCurrPasswdInput = (props:{value:Kontext.FormValue<string>}) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                name: 'USER_PROFILE_SET_CURR_PASSWD',
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr className="required">
                <th>
                    {he.translate('user__current_password')}:
                </th>
                <td>
                    <layoutViews.ValidatedItem invalid={props.value.isInvalid}>
                        <input type="password" value={props.value.value} autoComplete="off"
                                onChange={handleInputChange} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    };

    /**
     *
     * @param props
     */
    const TRNewPasswdInput:UserProfileViews['TRNewPasswdInput'] = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                name: 'USER_PROFILE_SET_NEW_PASSWD',
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr className="required">
                <th>
                    {props.isRegistration ? he.translate('user__password') : he.translate('user__new_password')}:
                </th>
                <td>
                    <layoutViews.ValidatedItem invalid={props.value.isInvalid} errorDesc={props.value.errorDesc}>
                        <input type="password" value={props.value.value}
                                onChange={handleInputChange} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        )
    };

    /**
     *
     */
    const TRNewPasswdInput2:UserProfileViews['TRNewPasswdInput2'] = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                name: 'USER_PROFILE_SET_NEW_PASSWD2',
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr className="required">
                <th>
                    {props.isRegistration ? he.translate('user__password_again') : he.translate('user__new_password_again')}:
                </th>
                <td>
                    <layoutViews.ValidatedItem invalid={props.value.isInvalid} errorDesc={props.value.errorDesc}>
                        <input type="password" value={props.value.value}
                                onChange={handleInputChange} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        )
    };

    const PasswordChangeForm = (props:{
        currPasswd:Kontext.FormValue<string>;
        newPasswd:Kontext.FormValue<string>;
        newPasswd2:Kontext.FormValue<string>;
    }) => {

        const handleSubmitClick = (props) => {
            dispatcher.dispatch({
                name: 'USER_PROFILE_SUBMIT_NEW_PASSWORD',
                payload: {}
            });
        };

        return (
            <form>
                <fieldset>
                    <legend>{he.translate('user__password_change')}</legend>
                    <table className="form">
                        <tbody>
                            <TRCurrPasswdInput value={props.currPasswd} />
                            <TRNewPasswdInput value={props.newPasswd} isRegistration={false} />
                            <TRNewPasswdInput2 value={props.newPasswd2} isRegistration={false} />
                        </tbody>
                    </table>
                </fieldset>
                <p>
                    <button type="button" className="default-button"
                            onClick={handleSubmitClick}>
                        {he.translate('user__update_password')}
                    </button>
                </p>
            </form>
        );
    };

    // ----------------------- <TrUserFirstNameInput /> ----------------

    const TrUserFirstNameInput:UserProfileViews['TrUserFirstNameInput'] = (props) => {
        return <tr>
            <th>
                {he.translate('user__firstname')}:
            </th>
            <td>
                <layoutViews.ValidatedItem invalid={props.value.isInvalid} errorDesc={props.value.errorDesc}>
                    <input type="text" readOnly={!props.onChange} value={props.value.value}
                            style={{width: '10em'}} onChange={props.onChange} />
                </layoutViews.ValidatedItem>
            </td>
        </tr>;
    };


    // ----------------------- <TrUserLastNameInput /> ----------------

    const TrUserLastNameInput:UserProfileViews['TrUserLastNameInput'] = (props) => {
        return <tr>
            <th>
                {he.translate('user__lastname')}:
            </th>
            <td>
                <layoutViews.ValidatedItem invalid={props.value.isInvalid} errorDesc={props.value.errorDesc}>
                    <input type="text" readOnly={!props.onChange} value={props.value.value}
                            style={{width: '10em'}} onChange={props.onChange} />
                </layoutViews.ValidatedItem>
            </td>
        </tr>;
    };

    // ----------------------- <TrUserEmailInput /> ------------------------

    const TrUserEmailInput:UserProfileViews['TrUserEmailInput'] = (props) => {
        return <tr>
            <th>
                {he.translate('user__email')}:
            </th>
            <td>
                <layoutViews.ValidatedItem invalid={props.value.isInvalid} errorDesc={props.value.errorDesc}>
                    <input type="text" readOnly={!props.onChange} value={props.value.value}
                            style={{width: '20em'}} onChange={props.onChange} />
                </layoutViews.ValidatedItem>
            </td>
        </tr>;
    };

    // ----------------------- <UserProfileView /> ------------------------

    class UserProfileView extends React.Component<UserProfileViewProps, UserProfileState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = profileModel.getInitialState();
            this._handleModelChange = this._handleModelChange.bind(this);
        }

        _handleModelChange(state:UserProfileState) {
            this.setState(state);
        }

        componentDidMount() {
            this.modelSubscription = profileModel.addListener(this._handleModelChange);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        render():ReactElement<{}> {
            return (
                <div className="UserProfileView">
                    <form>
                        <fieldset>
                            <legend>
                                {he.translate('global__user')}
                            </legend>
                            <table className="form">
                                <tbody>
                                    <TrUserFirstNameInput value={this.state.firstName} />
                                    <TrUserLastNameInput value={this.state.lastName} />
                                    <TrUserEmailInput value={this.state.email} />
                                </tbody>
                            </table>
                        </fieldset>
                    </form>
                    <PasswordChangeForm
                        currPasswd={this.state.currPasswd}
                        newPasswd={this.state.newPasswd}
                        newPasswd2={this.state.newPasswd2} />
                </div>
            );
        }
    }

    return {
        UserProfileView: UserProfileView,
        TRNewPasswdInput: TRNewPasswdInput,
        TRNewPasswdInput2: TRNewPasswdInput2,
        TrUserFirstNameInput: TrUserFirstNameInput,
        TrUserLastNameInput: TrUserLastNameInput,
        TrUserEmailInput: TrUserEmailInput
    };
}