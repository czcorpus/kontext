/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import { styled } from 'styled-components';

// ---------------- <UsernameAvailFlag /> --------------------------------------

export const UsernameAvailFlag = styled.span`
    display: inline-block;
    margin-left: 1em;

    img {
        width: 1em;
        vertical-align: middle;
        margin-right: 0.3em;
    }
`;

// ---------------- <SignUpForm /> --------------------------------------

export const SignUpForm = styled.form`
    input {
        font-size: 1.2em;
        padding: 0.2em 0.6em;
    }

    .confirm-msg {

        img {
            display: inline-block;
            width: 1em;
            vertical-align: middle;
            margin-right: 0.3em;
        }
    }

    legend {
        padding-left: 0.7em;
        padding-right: 0.7em;
        font-weight: bold;
    }

    .message {
        font-size: 1.2em;
        width: 40em;

        img {
            width: 1em;
            margin-right: 0.3em;
        }
    }
`;
