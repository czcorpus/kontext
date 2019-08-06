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

import { StatelessModel, IActionDispatcher, Action, SEDispatcher } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import * as Immutable from 'immutable';
import {Kontext} from '../../types/common';
import {IPluginApi} from '../../types/plugins';
import {MultiDict} from '../../util';
import { concatMap } from 'rxjs/operators';


export enum Actions {
    SET_CURR_PASSWD = 'USER_PROFILE_SET_CURR_PASSWD',
    SET_NEW_PASSWD = 'USER_PROFILE_SET_NEW_PASSWD',
    SET_NEW_PASSWD2 = 'USER_PROFILE_SET_NEW_PASSWD2',
    SUBMIT_NEW_PASSWORD = 'USER_PROFILE_SUBMIT_NEW_PASSWORD',
    SUBMIT_NEW_PASSWORD_DONE = 'USER_PROFILE_SUBMIT_NEW_PASSWORD_DONE',
    SET_USERNAME = 'USER_PROFILE_SET_USERNAME',
    CHECK_USERNAME = 'USER_PROFILE_CHECK_USERNAME',
    CHECK_USERNAME_DONE = 'USER_PROFILE_CHECK_USERNAME_DONE',
    SET_FIRSTNAME = 'USER_PROFILE_SET_FIRSTNAME',
    SET_LASTNAME = 'USER_PROFILE_SET_LASTNAME',
    SET_EMAIL = 'USER_PROFILE_SET_EMAIL',
    SUBMIT_SIGN_UP = 'USER_PROFILE_SUBMIT_SIGN_UP',
    SUBMIT_SIGN_UP_DONE = 'USER_PROFILE_SUBMIT_SIGN_UP_DONE',
    NEW_REGISTRATION = 'USER_PROFILE_NEW_REGISTRATION',
    GO_TO_MAIN_PAGE = 'USER_PROFILE_GO_TO_MAIN_PAGE'
}

export enum UsernameAvailability {
    UNKNOWN = 1,
    AVAILABLE = 2,
    NOT_AVAILABLE = 3
}

export interface UserProfileState {
    id:number,
    username:Kontext.FormValue<string>,
    usernameAvail:UsernameAvailability;
    usernameAvailBusy:boolean;
    firstName:Kontext.FormValue<string>;
    lastName:Kontext.FormValue<string>;
    email:Kontext.FormValue<string>;
    active:boolean,
    currPasswd:Kontext.FormValue<string>;
    newPasswd:Kontext.FormValue<string>;
    newPasswd2:Kontext.FormValue<string>;
    isBusy:boolean;
    isFinished:boolean;
    message:string;
}

interface PasswordSetResponse extends Kontext.AjaxResponse {
    fields:{
        curr_passwd:boolean;
        new_passwd:boolean;
        new_passwd2:boolean;
    }
}

interface UsernameAvailResponse extends Kontext.AjaxResponse {
    available:boolean;
    valid:boolean;
}

interface SignUpResponse extends Kontext.AjaxResponse {
    ok:boolean;
    error_args:Array<[string, string]>;
}

interface ValidationStatus {
    currPasswd:boolean;
    newPasswd:boolean;
    newPasswd2:boolean;
    messages:Array<string>;
}

const newValidationStatus = () => ({
    currPasswd: true,
    newPasswd: true,
    newPasswd2: true,
    messages: []
});


const validationStatusHasErrors = (vs:ValidationStatus):boolean => !vs.currPasswd || !vs.newPasswd || !vs.newPasswd2;


export class UserProfileModel extends StatelessModel<UserProfileState> {

    private pluginApi:IPluginApi;

    constructor(dispatcher:IActionDispatcher, pluginApi:IPluginApi, userData:Kontext.UserCredentials,
            message:string) {
        super(
            dispatcher,
            {
                id: userData.id,
                username: Kontext.newFormValue(userData.username, true),
                usernameAvail: UsernameAvailability.UNKNOWN,
                usernameAvailBusy: false,
                firstName: Kontext.newFormValue(userData.firstname, true),
                lastName: Kontext.newFormValue(userData.lastname, true),
                email: Kontext.newFormValue(userData.email, true),
                active: userData.active,
                currPasswd: Kontext.newFormValue('', true),
                newPasswd: Kontext.newFormValue('', true),
                newPasswd2: Kontext.newFormValue('', true),
                isBusy: false,
                isFinished: false,
                message: message
            }
        );
        this.pluginApi = pluginApi;
    }

    reduce(state:UserProfileState, action:Action):UserProfileState {
        let newState:UserProfileState;
        switch (action.name) {
            case Actions.SET_CURR_PASSWD:
                newState = this.copyState(state);
                newState.currPasswd = Kontext.updateFormValue(newState.currPasswd, {value: action.payload['value']});
            break;
            case Actions.SET_NEW_PASSWD:
                newState = this.copyState(state);
                newState.newPasswd = Kontext.updateFormValue(newState.newPasswd, {value: action.payload['value']});
            break;
            case Actions.SET_NEW_PASSWD2:
                newState = this.copyState(state);
                newState.newPasswd2 = Kontext.updateFormValue(newState.newPasswd2, {value: action.payload['value']});
            break;
            case Actions.SET_USERNAME:
                newState = this.copyState(state);
                newState.username = Kontext.updateFormValue(newState.username, {value: action.payload['value']});
            break;
            case Actions.SET_FIRSTNAME:
                newState = this.copyState(state);
                newState.firstName = Kontext.updateFormValue(newState.firstName, {value: action.payload['value']});
            break;
            case Actions.SET_LASTNAME:
                newState = this.copyState(state);
                newState.lastName = Kontext.updateFormValue(newState.lastName, {value: action.payload['value']});
            break;
            case Actions.SET_EMAIL:
                newState = this.copyState(state);
                newState.email = Kontext.updateFormValue(newState.email, {value: action.payload['value']});
            break;
            case Actions.SUBMIT_NEW_PASSWORD_DONE:
                const validStatus = action.payload['validationStatus'] as ValidationStatus;
                newState = this.copyState(state);
                if (action.error) {
                    if (!validStatus.currPasswd) {
                        newState.currPasswd = Kontext.updateFormValue(
                            newState.currPasswd, {value: '', isInvalid: !validStatus.currPasswd});
                    }
                    if (!validStatus.newPasswd) {
                        newState.newPasswd = Kontext.updateFormValue(
                            newState.newPasswd, {value: '', isInvalid: !validStatus.newPasswd});
                    }
                    if (!validStatus.newPasswd2) {
                        newState.newPasswd2 = Kontext.updateFormValue(
                            newState.newPasswd2, {value: '', isInvalid: !validStatus.newPasswd2});
                    }

                } else {
                    newState.currPasswd = Kontext.updateFormValue(newState.currPasswd, {value: '', isInvalid: !validStatus.currPasswd});
                    newState.newPasswd = Kontext.updateFormValue(newState.newPasswd, {value: '', isInvalid: !validStatus.newPasswd});
                    newState.newPasswd2 = Kontext.updateFormValue(newState.newPasswd2, {value: '', isInvalid: !validStatus.newPasswd2});
                    this.pluginApi.ajax$(
                        'GET',
                        this.pluginApi.createActionUrl('user/test_username'),
                        {
                            username: state.username
                        }
                    )                }
            break;
            case Actions.CHECK_USERNAME:
                newState = this.copyState(state);
                newState.usernameAvailBusy = true;
            break;
            case Actions.CHECK_USERNAME_DONE:
                newState = this.copyState(state);
                newState.usernameAvail = action.payload['available'];
                newState.username.isInvalid = !action.payload['valid'];
                newState.usernameAvailBusy = false;
            break;
            case Actions.SUBMIT_SIGN_UP:
                newState = this.copyState(state);
                newState.isBusy = true;
            break;
            case Actions.SUBMIT_SIGN_UP_DONE:
                newState = this.copyState(state);
                newState.isBusy = false;
                if (action.error) {
                    newState.usernameAvail = UsernameAvailability.UNKNOWN;
                    const data = action.payload['errors'] as Immutable.Map<string, string>;
                    if (data.has('username')) {
                        newState.username.isInvalid = true;
                        newState.username.errorDesc = data.get('username');

                    } else {
                        newState.username.isInvalid = false;
                        newState.username.errorDesc = undefined;
                    }
                    if (data.has('password')) {
                        newState.newPasswd.isInvalid = true;
                        newState.newPasswd.errorDesc = data.get('password');

                    } else {
                        newState.newPasswd.isInvalid = false;
                        newState.newPasswd.errorDesc = undefined;
                    }
                    if (data.has('password2')) {
                        newState.newPasswd2.isInvalid = true;
                        newState.newPasswd2.errorDesc = data.get('password2');

                    } else {
                        newState.newPasswd2.isInvalid = false;
                        newState.newPasswd2.errorDesc = undefined;
                    }
                    if (data.has('first_name')) {
                        newState.firstName.isInvalid = true;
                        newState.firstName.errorDesc = data.get('first_name');

                    } else {
                        newState.firstName.isInvalid = false;
                        newState.firstName.errorDesc = undefined;
                    }
                    if (data.has('last_name')) {
                        newState.lastName.isInvalid = true;
                        newState.lastName.errorDesc = data.get('last_name');

                    } else {
                        newState.lastName.isInvalid = false;
                        newState.lastName.errorDesc = undefined;
                    }
                    if (data.has('email')) {
                        newState.email.isInvalid = true;
                        newState.email.errorDesc = data.get('email');

                    } else {
                        newState.email.isInvalid = false;
                        newState.email.errorDesc = undefined;
                    }

                } else {
                    newState.isFinished = true;
                }
            break;
            case Actions.NEW_REGISTRATION:
                newState = this.copyState(state);
                newState.isFinished = false;
                newState.username = Kontext.resetFormValue(newState.username, '');
                newState.newPasswd = Kontext.resetFormValue(newState.newPasswd, '');
                newState.newPasswd2 = Kontext.resetFormValue(newState.newPasswd2, '');
                newState.firstName = Kontext.resetFormValue(newState.firstName, '');
                newState.lastName = Kontext.resetFormValue(newState.lastName, '');
                newState.email = Kontext.resetFormValue(newState.email, '');
            break;
            default:
                newState = state;
            break;
        }
        return newState;
    }

    sideEffects(state:UserProfileState, action:Action, dispatch:SEDispatcher):void {
        switch (action.name) {
            case Actions.SUBMIT_NEW_PASSWORD:
                this.submitNewPassword(state).subscribe(
                    (validationStatus) => {
                        if (validationStatusHasErrors(validationStatus)) {
                            dispatch({
                                name: Actions.SUBMIT_NEW_PASSWORD_DONE,
                                payload: {
                                    validationStatus: validationStatus
                                },
                                error: new Error()
                            });
                            validationStatus.messages.forEach(msg => this.pluginApi.showMessage('error', msg));

                        } else {
                            dispatch({
                                name: Actions.SUBMIT_NEW_PASSWORD_DONE,
                                payload: {
                                    validationStatus: validationStatus
                                }
                            });
                            this.pluginApi.showMessage('info',
                                this.pluginApi.translate('user__password_has_been_updated'));
                        }
                    },
                    (err) => {
                        this.pluginApi.showMessage('error', err);
                        console.error(err);
                        dispatch({
                            name: Actions.SUBMIT_NEW_PASSWORD_DONE,
                            payload: {},
                            error: err
                        });
                    }
                );
            break;
            case Actions.CHECK_USERNAME:
                this.pluginApi.ajax$<UsernameAvailResponse>(
                    'GET',
                    this.pluginApi.createActionUrl('user/test_username'),
                    {
                        username: state.username.value
                    }
                ).subscribe(
                    (resp) => {
                        dispatch({
                            name: Actions.CHECK_USERNAME_DONE,
                            payload: {
                                available: resp.available ? UsernameAvailability.AVAILABLE : UsernameAvailability.NOT_AVAILABLE,
                                valid: resp.valid
                            }
                        });
                    },
                    (err) => {
                        dispatch({
                            name: Actions.CHECK_USERNAME_DONE,
                            payload: {
                                status: UsernameAvailability.UNKNOWN
                            },
                            error: err
                        });
                    }
                );
            break;
            case Actions.SUBMIT_SIGN_UP:
                this.pluginApi.ajax$<SignUpResponse>(
                    'POST',
                    this.pluginApi.createActionUrl('user/sign_up'),
                    {
                        username: state.username.value,
                        firstname: state.firstName.value,
                        lastname: state.lastName.value,
                        email: state.email.value,
                        password: state.newPasswd.value,
                        password2: state.newPasswd2.value
                    }
                ).subscribe(
                    (resp) => {
                        dispatch({
                            name: Actions.SUBMIT_SIGN_UP_DONE,
                            payload: {}
                        });
                    },
                    (err) => {
                        dispatch({
                            name: Actions.SUBMIT_SIGN_UP_DONE,
                            payload: {
                                errors: Immutable.Map<string, string>(err.response['error_args'])
                            },
                            error: err
                        });
                        (err.response['messages'] as Array<[string, string]>).forEach(msg =>
                            this.pluginApi.showMessage(msg[0], msg[1]));
                    }
                );
            break;
            case Actions.GO_TO_MAIN_PAGE:
                window.location.href = this.pluginApi.createActionUrl('first_form');
            break;
        }
    }

    private submitNewPassword(state:UserProfileState):Observable<ValidationStatus> {
        const args = new MultiDict();
        args.set('curr_passwd', state.currPasswd.value);
        args.set('new_passwd', state.newPasswd.value);
        args.set('new_passwd2', state.newPasswd2.value);

        return this.pluginApi.ajax$<PasswordSetResponse>(
            'POST',
            this.pluginApi.createActionUrl('user/set_user_password'),
            args

        ).pipe(
            concatMap(
                (resp) => {
                    const ans = newValidationStatus();
                    ans.currPasswd = resp.fields.curr_passwd;
                    ans.newPasswd = resp.fields.new_passwd;
                    ans.newPasswd2 = resp.fields.new_passwd2;
                    ans.messages = resp.messages.splice(0);
                    return rxOf(ans);
                }
            )
        );
    }
}