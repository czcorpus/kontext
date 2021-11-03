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
import { IActionDispatcher, BoundWithProps } from 'kombo';

import * as Kontext from '../../../types/kontext';
import { UserStatusModel, UsersStatusModelState } from '../init';
import { Actions as UserActions } from '../../../models/user/actions';


export interface UserPaneViews {
    UserPane:React.ComponentClass;
}

/**
 *
 */
export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            userModel:UserStatusModel):UserPaneViews {

    const layoutViews = he.getLayoutViews();

    /**
     *
     * @param props
     */
    const LoginForm = (props:{
        onCloseClick:()=>void,
        returnUrl:string
    }) => (
        <layoutViews.ModalOverlay onCloseKey={props.onCloseClick}>
            <layoutViews.CloseableFrame onCloseClick={props.onCloseClick}
                    label={he.translate('user__login_header')}>
                <form className="login" action={he.createActionLink('user/login', {return_url: props.returnUrl})} method="POST">
                    <table className="form">
                        <tbody>
                            <tr>
                                <th>
                                    {he.translate('user__username')}:
                                </th>
                                <td>
                                    <input type="text" name="username" />
                                </td>
                            </tr>
                            <tr>
                                <th>
                                    {he.translate('user__password')}:
                                </th>
                                <td>
                                    <input type="password" name="password" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <p>
                        <button type="submit" className="default-button">
                            {he.translate('user__login_btn')}
                        </button>
                    </p>
                </form>
            </layoutViews.CloseableFrame>
        </layoutViews.ModalOverlay>
    );



    // -------------------------- <LoginButton /> ---------------------------------

    const LoginButton:React.FC<{
        isAnonymous:string;
        fullname:string,
        onLogoutClick:()=>void,
        onLoginClick:()=>void,
        onNameClick:()=>void
     }> = (props) => {

        if (props.isAnonymous) {
            return <a className="sign-in" onClick={props.onLoginClick}>{he.translate('user__login_btn')}</a>;

        } else {
            return (
                <span><a className="username" onClick={props.onNameClick}>{props.fullname}</a>{'\u00a0'}
                <a onClick={props.onLogoutClick}>{he.translate('user__logout_btn')}</a></span>
            );
        }
    };

    // -------------------------- <SignUpButton /> ---------------------------------

    const SignUpButton:React.FC<{

    }> = (props) => {
        return <a className="sign-up" href={he.createActionLink('user/sign_up_form')}>{he.translate('user__signup_btn')}</a>;
    }

    // -------------------------- <UserPane /> ---------------------------------

    interface UserPaneProps {
        isAnonymous:string;
        fullname:string
    }

    class UserPane extends React.PureComponent<UserPaneProps & UsersStatusModelState> {

        constructor(props) {
            super(props);
            this.handleLoginClick = this.handleLoginClick.bind(this);
            this.handleLogoutClick = this.handleLogoutClick.bind(this);
            this.handleProfileTrigger = this.handleProfileTrigger.bind(this);
            this.handleFormClose = this.handleFormClose.bind(this);
        }

        private handleLoginClick():void {
            dispatcher.dispatch<typeof UserActions.UserShowLoginDialog>({
                name: UserActions.UserShowLoginDialog.name,
                payload: {
                    returnUrl: window.location.href
                }
            });
        }

        private handleFormClose():void {
            dispatcher.dispatch<typeof UserActions.UserHideLoginDialog>({
                name: UserActions.UserHideLoginDialog.name
            });
        }

        private handleLogoutClick():void {
            dispatcher.dispatch<typeof UserActions.UserLogoutx>({
                name: UserActions.UserLogoutx.name
            });
        }

        private handleProfileTrigger():void {
            window.location.href = he.createActionLink('user/profile');
        }

        render() {
            return (
                <div className="UserPane">
                    <span className="user">
                        <img className="avatar" src={he.createStaticUrl('img/user.svg')} />
                        <LoginButton isAnonymous={this.props.isAnonymous}
                                fullname={this.props.fullname}
                                onLogoutClick={this.handleLogoutClick}
                                onLoginClick={this.handleLoginClick}
                                onNameClick={this.handleProfileTrigger} />
                        {this.props.isAnonymous ?
                            <>{'\u00a0/\u00a0'}<SignUpButton /></> :
                            null
                        }
                    </span>
                    {this.props.loginFormVisible ?
                            <LoginForm onCloseClick={this.handleFormClose}
                                returnUrl={this.props.returnUrl} /> :
                        null
                    }
                </div>
            );
        }
    }

    return {
        UserPane: BoundWithProps<UserPaneProps, UsersStatusModelState>(UserPane, userModel)
    };

}