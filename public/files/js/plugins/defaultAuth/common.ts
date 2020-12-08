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

import { Kontext } from '../../types/common';


export interface PasswordSetResponse extends Kontext.AjaxResponse {
    fields:{
        curr_passwd:boolean;
        new_passwd:boolean;
        new_passwd2:boolean;
    }
}

export interface SignUpResponse extends Kontext.AjaxResponse {
    ok:boolean;
    error_args:Array<[string, string]>;
}

export interface ValidationStatus {
    currPasswd:boolean;
    newPasswd:boolean;
    newPasswd2:boolean;
    messages:Array<string>;
}

export const newValidationStatus = () => ({
    currPasswd: true,
    newPasswd: true,
    newPasswd2: true,
    messages: []
});


export const validationStatusHasErrors = (vs:ValidationStatus):boolean => !vs.currPasswd || !vs.newPasswd || !vs.newPasswd2;


export interface UsernameTestResponse extends Kontext.AjaxResponse {
    available:boolean;
    valid:boolean;
}

export interface SubmitFormErrors {
    username?:string;
    password?:string;
    password2?:string;
    first_name?:string;
    last_name?:string;
    email?:string;
    affiliation?:string;
}