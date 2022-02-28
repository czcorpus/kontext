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

import { SubmitFormErrors, ValidationStatus } from './common';

export class Actions {

    static SetCurrPassword:Action<{
        value:string;
    }> = {
        name: 'USER_PROFILE_SET_CURR_PASSWD'
    };

    static SetNewPasswd:Action<{
        value:string;
    }> = {
        name: 'USER_PROFILE_SET_NEW_PASSWD'
    };

    static SetNewPasswd2:Action<{
        value:string;
    }> = {
        name: 'USER_PROFILE_SET_NEW_PASSWD2'
    };

    static SubmitNewPassword:Action<{
    }> = {
        name: 'USER_PROFILE_SUBMIT_NEW_PASSWORD'
    };

    static SubmitNewPasswordDone:Action<{
        validationStatus:ValidationStatus;
    }> = {
        name: 'USER_PROFILE_SUBMIT_NEW_PASSWORD_DONE'
    };

    static SetUsername:Action<{
        value:string;
    }> = {
        name: 'USER_PROFILE_SET_USERNAME'
    };

    static CheckUsername:Action<{
    }> = {
        name: 'USER_PROFILE_CHECK_USERNAME'
    };

    static CheckUsernameDone:Action<{
        available:boolean;
        valid:boolean;
    }> = {
        name: 'USER_PROFILE_CHECK_USERNAME_DONE'
    };

    static SetFirstname:Action<{
        value:string;
    }> = {
        name: 'USER_PROFILE_SET_FIRSTNAME'
    };

    static SetLastname:Action<{
        value:string;
    }> = {
        name: 'USER_PROFILE_SET_LASTNAME'
    };

    static SetAffiliation:Action<{
        value: string;
    }> = {
        name: 'USER_PROFILE_SET_AFFILIATION'
    };

    static SetEmail:Action<{
        value:string;
    }> = {
        name: 'USER_PROFILE_SET_EMAIL'
    };

    static SubmitSignUp:Action<{
    }> = {
        name: 'USER_PROFILE_SUBMIT_SIGN_UP'
    };

    static SubmitSignUpDone:Action<{
       errors:SubmitFormErrors;
    }> = {
        name: 'USER_PROFILE_SUBMIT_SIGN_UP_DONE'
    };

    static NewRegistration:Action<{
    }> = {
        name: 'USER_PROFILE_NEW_REGISTRATION'
    };

    static GoToMainPage:Action<{
    }> = {
        name: 'USER_PROFILE_GO_TO_MAIN_PAGE'
    };

}