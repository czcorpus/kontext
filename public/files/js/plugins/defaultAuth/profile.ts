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

import { StatelessModel, IActionDispatcher } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { HTTP, List, pipe } from 'cnc-tskit';

import * as Kontext from '../../types/kontext';
import { Actions } from './actions';
import {
    UsernameTestResponse, validationStatusHasErrors, SignUpResponse,
    ValidationStatus, PasswordSetResponse, newValidationStatus,
    SubmitFormErrors } from './common';
import { IPluginApi } from '../../types/plugins/common';


export interface UserProfileState {
    id:number,
    username:Kontext.FormValue<string>,
    usernameAvail:boolean;
    usernameAvailBusy:boolean;
    firstName:Kontext.FormValue<string>;
    lastName:Kontext.FormValue<string>;
    affiliation:Kontext.FormValue<string>;
    email:Kontext.FormValue<string>;
    active:boolean,
    currPasswd:Kontext.FormValue<string>;
    newPasswd:Kontext.FormValue<string>;
    newPasswd2:Kontext.FormValue<string>;
    isBusy:boolean;
    isFinished:boolean;
    message:string;
}

export class UserProfileModel extends StatelessModel<UserProfileState> {

    private readonly pluginApi:IPluginApi;

    constructor(
        dispatcher:IActionDispatcher,
        pluginApi:IPluginApi,
        userData:Kontext.UserCredentials,
        message:string
    ) {
        super(
            dispatcher,
            {
                id: userData.id,
                username: Kontext.newFormValue(userData.username, true),
                usernameAvail: false,
                usernameAvailBusy: false,
                firstName: Kontext.newFormValue(userData.firstname, true),
                lastName: Kontext.newFormValue(userData.lastname, true),
                affiliation: Kontext.newFormValue(userData.affiliation, true),
                email: Kontext.newFormValue(userData.email, true),
                active: userData.active,
                currPasswd: Kontext.newFormValue('', true),
                newPasswd: Kontext.newFormValue('', true),
                newPasswd2: Kontext.newFormValue('', true),
                isBusy: false,
                isFinished: false,
                message
            }
        );
        this.pluginApi = pluginApi;

        this.addActionHandler<typeof Actions.SetCurrPassword>(
            Actions.SetCurrPassword.name,
            (state, action) => {
                state.currPasswd = Kontext.updateFormValue(
                    state.currPasswd, {value: action.payload.value});
            }
        );

        this.addActionHandler<typeof Actions.SetNewPasswd>(
            Actions.SetNewPasswd.name,
            (state, action) => {
                state.newPasswd = Kontext.updateFormValue(
                    state.newPasswd, {value: action.payload.value});
            }
        );


        this.addActionHandler<typeof Actions.SetNewPasswd2>(
            Actions.SetNewPasswd2.name,
            (state, action) => {
                state.newPasswd2 = Kontext.updateFormValue(
                    state.newPasswd2, {value: action.payload.value});
            }
        );

        this.addActionHandler<typeof Actions.SetUsername>(
            Actions.SetUsername.name,
            (state, action) => {
                state.username = Kontext.updateFormValue(
                    state.username, {value: action.payload.value});
            }
        );

        this.addActionHandler<typeof Actions.SetFirstname>(
            Actions.SetFirstname.name,
            (state, action) => {
                state.firstName = Kontext.updateFormValue(
                    state.firstName, {value: action.payload.value});
            }
        );

        this.addActionHandler<typeof Actions.SetLastname>(
            Actions.SetLastname.name,
            (state, action) => {
                state.lastName = Kontext.updateFormValue(
                    state.lastName, {value: action.payload.value});
            }
        );

        this.addActionHandler<typeof Actions.SetAffiliation>(
            Actions.SetAffiliation.name,
            (state, action) => {
                state.affiliation = Kontext.updateFormValue(
                    state.affiliation, {value: action.payload.value});
            }
        );

        this.addActionHandler<typeof Actions.SetEmail>(
            Actions.SetEmail.name,
            (state, action) => {
                state.email = Kontext.updateFormValue(
                    state.email, {value: action.payload.value});
            }
        );

        this.addActionHandler<typeof Actions.SubmitNewPasswordDone>(
            Actions.SubmitNewPasswordDone.name,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    if (!action.payload.validationStatus.currPasswd) {
                        state.currPasswd = Kontext.updateFormValue(
                            state.currPasswd,
                            {value: '', isInvalid: !action.payload.validationStatus.currPasswd});
                    }
                    if (!action.payload.validationStatus.newPasswd) {
                        state.newPasswd = Kontext.updateFormValue(
                            state.newPasswd,
                            {value: '', isInvalid: !action.payload.validationStatus.newPasswd});
                    }
                    if (!action.payload.validationStatus.newPasswd2) {
                        state.newPasswd2 = Kontext.updateFormValue(
                            state.newPasswd2,
                            {value: '', isInvalid: !action.payload.validationStatus.newPasswd2});
                    }

                } else {
                    state.currPasswd = Kontext.updateFormValue(
                        state.currPasswd,
                        {value: '', isInvalid: !action.payload.validationStatus.currPasswd});
                    state.newPasswd = Kontext.updateFormValue(
                        state.newPasswd,
                        {value: '', isInvalid: !action.payload.validationStatus.newPasswd});
                    state.newPasswd2 = Kontext.updateFormValue(
                        state.newPasswd2,
                        {value: '', isInvalid: !action.payload.validationStatus.newPasswd2});

                 }
            }
        );

        this.addActionHandler<typeof Actions.SubmitNewPassword>(
            Actions.SubmitNewPassword.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.submitNewPassword(state).subscribe(
                    (validationStatus) => {
                        if (validationStatusHasErrors(validationStatus)) {
                            dispatch<typeof Actions.SubmitNewPasswordDone>({
                                name: Actions.SubmitNewPasswordDone.name,
                                payload: {
                                    validationStatus
                                },
                                error: new Error()
                            });
                            validationStatus.messages.forEach(
                                    msg => this.pluginApi.showMessage('error', msg));

                        } else {
                            dispatch<typeof Actions.SubmitNewPasswordDone>({
                                name: Actions.SubmitNewPasswordDone.name,
                                payload: {
                                    validationStatus
                                }
                            });
                            this.pluginApi.showMessage('info',
                                this.pluginApi.translate('user__password_has_been_updated'));
                        }
                    },
                    (err) => {
                        this.pluginApi.showMessage('error', err);
                        console.error(err);
                        dispatch<typeof Actions.SubmitNewPasswordDone>({
                            name: Actions.SubmitNewPasswordDone.name,
                            payload: {
                                validationStatus: {
                                    currPasswd: false,
                                    newPasswd: false,
                                    newPasswd2: false,
                                    messages: [err]
                                }
                            },
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<typeof Actions.CheckUsername>(
            Actions.CheckUsername.name,
            (state, action) => {
                state.usernameAvailBusy = true;
            },
            (state, action, dispatch) => {
                this.pluginApi.ajax$<UsernameTestResponse>(
                    HTTP.Method.GET,
                    this.pluginApi.createActionUrl('user/test_username'),
                    {
                        username: state.username.value
                    }
                ).subscribe(
                    (resp) => {
                        dispatch<typeof Actions.CheckUsernameDone>({
                            name: Actions.CheckUsernameDone.name,
                            payload: {
                                available: resp.available,
                                valid: resp.valid
                            }
                        });
                    },
                    (err) => {
                        dispatch<typeof Actions.CheckUsernameDone>({
                            name: Actions.CheckUsernameDone.name,
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<typeof Actions.CheckUsernameDone>(
            Actions.CheckUsernameDone.name,
            (state, action) => {
                state.usernameAvail = action.payload.available;
                state.username.isInvalid = !action.payload.valid;
                state.usernameAvailBusy = false;
            }
        );

        this.addActionHandler<typeof Actions.SubmitSignUp>(
            Actions.SubmitSignUp.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.pluginApi.ajax$<SignUpResponse>(
                    HTTP.Method.POST,
                    this.pluginApi.createActionUrl('user/sign_up'),
                    {
                        username: state.username.value,
                        firstname: state.firstName.value,
                        lastname: state.lastName.value,
                        affiliation: state.affiliation.value,
                        email: state.email.value,
                        password: state.newPasswd.value,
                        password2: state.newPasswd2.value
                    }
                ).subscribe(
                    (resp) => {
                        dispatch<typeof Actions.SubmitSignUpDone>({
                            name: Actions.SubmitSignUpDone.name,
                            payload: {errors: {}}
                        });
                    },
                    (err) => {
                        dispatch<typeof Actions.SubmitSignUpDone>({
                            name: Actions.SubmitSignUpDone.name,
                            payload: {
                                errors: err.response['error_args'] as SubmitFormErrors
                            },
                            error: err
                        });
                        pipe(
                            err.response['messages'] as Array<[string, string]>,
                            List.filter(([, msg]) => !!msg),
                            List.forEach(
                                ([mtype, msg]) => {
                                    this.pluginApi.showMessage(mtype, msg);
                                }
                            )
                        )
                    }
                );
            }
        );

        this.addActionHandler<typeof Actions.SubmitSignUpDone>(
            Actions.SubmitSignUpDone.name,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    state.usernameAvail = false;
                    state.username.isInvalid = !!action.payload.errors.username;
                    state.username.errorDesc = action.payload.errors.username;

                    state.newPasswd.isInvalid = !!action.payload.errors.password;
                    state.newPasswd.errorDesc = action.payload.errors.password;

                    state.newPasswd2.isInvalid = !!action.payload.errors.password2;
                    state.newPasswd2.errorDesc = action.payload.errors.password2;

                    state.firstName.isInvalid = !!action.payload.errors.first_name;
                    state.firstName.errorDesc = action.payload.errors.first_name;

                    state.lastName.isInvalid = !!action.payload.errors.last_name;
                    state.lastName.errorDesc = action.payload.errors.last_name;

                    state.email.isInvalid = !!action.payload.errors.email;
                    state.email.errorDesc = action.payload.errors.email;

                    state.affiliation.isInvalid = !!action.payload.errors.affiliation;
                    state.affiliation.errorDesc = action.payload.errors.affiliation;

                } else {
                    state.isFinished = true;
                }
            }
        );

        this.addActionHandler<typeof Actions.NewRegistration>(
            Actions.NewRegistration.name,
            (state, action) => {
                state.isFinished = false;
                state.username = Kontext.resetFormValue(state.username, '');
                state.newPasswd = Kontext.resetFormValue(state.newPasswd, '');
                state.newPasswd2 = Kontext.resetFormValue(state.newPasswd2, '');
                state.firstName = Kontext.resetFormValue(state.firstName, '');
                state.lastName = Kontext.resetFormValue(state.lastName, '');
                state.affiliation = Kontext.resetFormValue(state.affiliation, '');
                state.email = Kontext.resetFormValue(state.email, '');
            }
        );

        this.addActionHandler<typeof Actions.GoToMainPage>(
            Actions.GoToMainPage.name,
            null,
            (state, action, dispatch) => {
                window.location.href = this.pluginApi.createActionUrl('query');
            }
        )
    }

    private submitNewPassword(state:UserProfileState):Observable<ValidationStatus> {
        return this.pluginApi.ajax$<PasswordSetResponse>(
            HTTP.Method.POST,
            this.pluginApi.createActionUrl('user/set_user_password'),
            {
                curr_passwd: state.currPasswd.value,
                new_passwd: state.newPasswd.value,
                new_passwd2: state.newPasswd2.value
            }

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