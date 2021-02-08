/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

import styled from 'styled-components';
import * as theme from './theme/default';

// ---------------- <KeyboardShortcuts /> --------------------------------------

export const KeyboardShortcuts = styled.div`
    td {
        padding: 0.3em;
    }

    th {
        padding: 0.3em;
        font-weight: normal;
        text-align: right;

        span.key-button {
            font-size: 1.6em;
            width: 1.8em;
            background-color: ${theme.colorLogoBlueOpaque};
            color: #fefefe;
            border-radius: ${theme.inputBorderRadius};
            text-align: center;
            display: inline-block;
            vertical-align: middle;
            margin-right: 0.7em;
            box-shadow: 0px 1px 2px rgba(000, 000, 000, 0.5), inset 0px 0px 2px rgba(255, 255, 255, 0.2);
        }
    }
`;
