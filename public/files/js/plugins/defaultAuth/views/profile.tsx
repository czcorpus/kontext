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
import {UserProfileModel} from '../profile';
import { ReactElement } from 'react';
import {ActionDispatcher} from '../../../app/dispatcher';

export interface UserProfileViews {
    UserProfileView:React.ComponentClass;
}

export interface UserProfileViewProps {

}

export interface UserProfileViewState {
    currPasswd:string;
    newPasswd:string;
    newPasswd2:string;
    firstname:string;
    lastname:string;
    email:string;
}

export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers, profileModel:UserProfileModel) {

    /**
     *
     * @param props
     */
    const TRCurrPasswdInput = (props:{value:string}) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'USER_PROFILE_SET_CURR_PASSWD',
                props: {
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
                    <input type="password" value={props.value} autoComplete="off"
                            onChange={handleInputChange} />
                </td>
            </tr>
        );
    };

    /**
     *
     * @param props
     */
    const TRNewPasswdInput = (props:{value:string}) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'USER_PROFILE_SET_NEW_PASSWD',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr className="required">
                <th>
                    {he.translate('user__new_password')}:
                </th>
                <td>
                    <input type="password" value={props.value}
                            onChange={handleInputChange} />
                </td>
            </tr>
        )
    };

    /**
     *
     */
    const TRNewPasswdInput2 = (props:{value:string}) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'USER_PROFILE_SET_NEW_PASSWD2',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr className="required">
                <th>
                    {he.translate('user__new_password_again')}:
                </th>
                <td>
                    <input type="password" value={props.value}
                            onChange={handleInputChange} />
                </td>
            </tr>
        )
    };

    const PasswordChangeForm = (props:{
        currPasswd:string;
        newPasswd:string;
        newPasswd2:string;
    }) => {

        const handleSubmitClick = (props) => {
            dispatcher.dispatch({
                actionType: 'USER_PROFILE_SUBMIT_NEW_PASSWORD',
                props: {}
            });
        };

        return (
            <form>
                <fieldset>
                    <legend>{he.translate('user__password_change')}</legend>
                    <table className="form">
                        <tbody>
                            <TRCurrPasswdInput value={props.currPasswd} />
                            <TRNewPasswdInput value={props.newPasswd} />
                            <TRNewPasswdInput2 value={props.newPasswd2} />
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


    /**
     *
     */
    class UserProfileView extends React.Component<UserProfileViewProps, UserProfileViewState> {

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._handleModelChange = this._handleModelChange.bind(this);
        }

        _fetchModelState():UserProfileViewState {
            return {
                currPasswd: profileModel.getCurrPasswd(),
                newPasswd: profileModel.getNewPasswd(),
                newPasswd2: profileModel.getNewPasswd2(),
                firstname: profileModel.getFirstname(),
                lastname: profileModel.getLastname(),
                email: profileModel.getEmail()
            }
        }

        _handleModelChange() {
            this.setState(this._fetchModelState());
        }

        componentDidMount() {
            profileModel.addChangeListener(this._handleModelChange);
        }

        componentWillUnmount() {
            profileModel.removeChangeListener(this._handleModelChange);
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
                                    <tr>
                                        <th>
                                            {he.translate('user__firstname')}:
                                        </th>
                                        <td>
                                            <input type="text" readOnly={true} value={this.state.firstname}
                                                    style={{width: '10em'}} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <th>
                                            {he.translate('user__firstname')}:
                                        </th>
                                        <td>
                                            <input type="text" readOnly={true} value={this.state.lastname}
                                                    style={{width: '10em'}} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <th>
                                            {he.translate('user__email')}:
                                        </th>
                                        <td>
                                            <input type="text" readOnly={true} value={this.state.email}
                                                    style={{width: '20em'}} />
                                        </td>
                                    </tr>
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
        UserProfileView: UserProfileView
    }
}