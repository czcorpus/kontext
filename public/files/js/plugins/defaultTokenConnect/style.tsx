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
import * as theme from '../../views/theme/default';

export const TokenConnectContainer = styled.div`

    .not-avail {
        color: ${theme.colorDarkGreenText};
        font-weight: bold;
    }

    p.keywords {
        line-height: 1.7em;
        word-spacing: 0.4em;
        padding: 0 1.4em;
    }

    a.keyword {
        text-decoration: none;
        font-size: 1.3em;
    }

    a.keyword:hover {
        text-decoration: underline;
    }

    .ErrorRenderer img.error-icon {
        display: inline-block;
        vertical-align: middle;
        width: 1.2em;
        margin-right: 0.4em;
    }

    .ErrorRenderer p.gear {
        text-align: center;
    }

    .text {
        border-top: 1px dotted;
    }

    .document {
        border-top: 1px solid;
    }

    .formatted-text {
        font-size: 1.2em;
    }

`;