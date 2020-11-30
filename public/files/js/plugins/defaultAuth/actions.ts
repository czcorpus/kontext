   /*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Action } from 'kombo';

import { ValidationStatus } from './common';


export enum ActionName {
    SetCurrPassword = 'USER_PROFILE_SET_CURR_PASSWD',
    SetNewPasswd = 'USER_PROFILE_SET_NEW_PASSWD',
    SetNewPasswd2 = 'USER_PROFILE_SET_NEW_PASSWD2',
    SubmitNewPassword = 'USER_PROFILE_SUBMIT_NEW_PASSWORD',
    SubmitNewPasswordDone = 'USER_PROFILE_SUBMIT_NEW_PASSWORD_DONE',
    SetUsername = 'USER_PROFILE_SET_USERNAME',
    CheckUsername = 'USER_PROFILE_CHECK_USERNAME',
    CheckUsernameDone = 'USER_PROFILE_CHECK_USERNAME_DONE',
    SetFirstname = 'USER_PROFILE_SET_FIRSTNAME',
    SetLastname = 'USER_PROFILE_SET_LASTNAME',
    SetAffiliation = 'USER_PROFILE_SET_AFFILIATION',
    SetEmail = 'USER_PROFILE_SET_EMAIL',
    SubmitSignUp = 'USER_PROFILE_SUBMIT_SIGN_UP',
    SubmitSignUpDone = 'USER_PROFILE_SUBMIT_SIGN_UP_DONE',
    NewRegistration = 'USER_PROFILE_NEW_REGISTRATION',
    GoToMainPage = 'USER_PROFILE_GO_TO_MAIN_PAGE'
}


export namespace Actions {

    export interface SetCurrPassword extends Action<{
        value:string;
    }> {
        name:ActionName.SetCurrPassword;
    }

    export interface SetNewPasswd extends Action<{
        value:string;
    }> {
        name:ActionName.SetNewPasswd;
    }

    export interface SetNewPasswd2 extends Action<{
        value:string;
    }> {
        name:ActionName.SetNewPasswd2;
    }

    export interface SubmitNewPassword extends Action<{
    }> {
        name:ActionName.SubmitNewPassword;
    }

    export interface SubmitNewPasswordDone extends Action<{
        validationStatus:ValidationStatus;
    }> {
        name:ActionName.SubmitNewPasswordDone;
    }

    export interface SetUsername extends Action<{
        value:string;
    }> {
        name:ActionName.SetUsername;
    }

    export interface CheckUsername extends Action<{
    }> {
        name:ActionName.CheckUsername;
    }

    export interface CheckUsernameDone extends Action<{
        available:boolean;
        valid:boolean;
    }> {
        name:ActionName.CheckUsernameDone;
    }

    export interface SetFirstname extends Action<{
        value:string;
    }> {
        name:ActionName.SetFirstname;
    }

    export interface SetLastname extends Action<{
        value:string;
    }> {
        name:ActionName.SetLastname;
    }

    export interface SetAffiliation extends Action<{
        value: string;
    }> {
        name: ActionName.SetAffiliation;
    }

    export interface SetEmail extends Action<{
        value:string;
    }> {
        name:ActionName.SetEmail;
    }

    export interface SubmitSignUp extends Action<{
    }> {
        name:ActionName.SubmitSignUp;
    }

    export interface SubmitSignUpDone extends Action<{
        errors:{[key:string]:string};
    }> {
        name:ActionName.SubmitSignUpDone;
    }

    export interface NewRegistration extends Action<{
    }> {
        name:ActionName.NewRegistration;
    }

    export interface GoToMainPage extends Action<{
    }> {
        name:ActionName.GoToMainPage;
    }

}