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


export const AdvancedFormFieldsetDesc = styled.span`
a {
    display: inline-block;
    vertical-align: middle;
    margin-left: 0.5em;

    img {
        width: 1em;
    }
}

.html-code {

    max-width: 40em;

    > div {
        text-align: justify;
        margin: 0.7em 1em;
    }
}
`;


export const QueryHints = styled.div`

    white-space: initial;
    padding: 0.3em 0.7em;
    margin-top: 0.7em;
    background-color: #f9f9f9;
    border-style: solid;
    border-color: #fefefe;
    border-width: 0.15em;
    border-radius: 0.2em;
    color: ${theme.colorLightText};
    font-size: 0.9em;
    max-width: 50em;
    line-height: 1.5;

    .tip {
        text-transform: uppercase;
        color: ${theme.colorLogoBlue};
        font-weight: bold;
        padding-right: 0.7em;
    }

    .highlight {
        font-weight: bold;
    }

    > * {
        display: inline;
    }

    .next-hint {
        padding-left: 0.7em;
    }

    .next-hint a {
        color: ${theme.colorLogoBlue};
        text-decoration: none;
    }

    .next-hint a:hover {
        color: ${theme.colorLogoBlue};
    }

`;