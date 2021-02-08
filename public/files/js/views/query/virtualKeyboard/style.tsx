/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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
import * as theme from '../../theme/default';


export const VirtualKeyboard = styled.div`

    .layout-selection {
        display: block;
        margin-bottom: 0.7em;

        h3 {
            display: inline-block;
            margin-right: 0.7em;
        }

    }

    .key-row {

        display: block;
        white-space: nowrap;
        margin-bottom: 0.3em;
        text-align: center;

        .dummy, button {
            display: inline-block;
            margin-left: 0.2em;
            padding: 0.1em 0.3em;
            text-align: center;
            border-radius: ${theme.inputBorderRadius};
            text-decoration: none;
            cursor: pointer;
            font-size: 1.5em;
            border: none;
        }

        .space {
            width: 10em;
        }

        .caps,
        .backspace,
        .altgr {
            width: 3em;
        }

        .spec {
            font-weight: bold;
            padding-left: 0.3em;
            padding-right: 0.3em;
            background-color: ${theme.colorLogoBlue};
        }

        .spec.active,
        button.active {
            background-color: ${theme.colorLogoPink};
        }

        .dummy {
            background-color: ${theme.colorLightText};
            color: ${theme.colorLightGreen};
            opacity: 0.4;
            padding-left: 0.3em;
            padding-right: 0.3em;
            cursor: default;
        }

        button {
            width: 1.5em;
            background-color: ${theme.colorLogoBlueOpaque};
            color: #fefefe;
        }
    }
`;