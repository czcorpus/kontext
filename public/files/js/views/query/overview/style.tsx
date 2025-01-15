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

import { styled } from 'styled-components';
import * as theme from '../../theme/default/index.js';


// -------------------------- <QueryFormOverlay /> -------------------

export const QueryFormOverlay = styled.div`

    font-family: ${theme.defaultFontFamily};

`;

// -------------------------- <QueryOverviewLinkSpan /> ------------------

export const QueryOverviewLinkSpan = styled.span`

    .separ {
        display: inline-block;
        margin-left: 0.3em;
        margin-right: 0.3em;
        font-size: 1.3em;
        font-weight: normal;
    }

    a {
        color: ${theme.colorLogoBlue};
        text-decoration: none;

        &:hover {
            text-decoration: underline;
        }
    }
`;


// -------------------------- <ExecutionOptionsFieldset /> -------------------

export const ExecutionOptionsFieldset = styled.div`

    margin-bottom: 0.7em;

    legend {
        margin-left: 0.7em;
        margin-right: 0.7em;
        margin-bottom: 0.4em;
    }

    ul {
        list-style-type: none;
        margin: 0 0 0 1.7em;
        padding-left: 0;
    }

    ul li {
        margin: 0;
        padding: 0.2em 0;
    }

    ul li label {
        color: ${theme.colorDefaultText};
        white-space: nowrap;
    }

    ul li label input[type="radio"] {
        margin: 0 0.3em 0.1em 0;
        padding: 0;
        vertical-align: middle;
    }

    ul li label.active {
        color: ${theme.colorDefaultText};
    }

`;


// ---------------- <PersistentConcordanceForm /> -----------------------

export const PersistentConcordanceForm = styled.form`

    .input-row {
        display: flex;
        align-items: center;
        margin-top: 0.4em;
        margin-bottom: 1em;

        input {
            font-size: 1.5em;
            width: 30em;
        }

        input.link {
            color: ${theme.colorSuperlightText};
        }
    }

    input.archived {
        color: ${theme.colorDefaultText};
    }

    .archive-toggle {
        display: flex;
        align-items: center;
        margin-bottom: 1em;

        label {
            margin-right: 0.4em;
        }
    }

    .custom-name {

        margin-top: 0.7em;
        display: flex;
        align-items: center;

        label {
            margin-right: 0.4em;
        }

        .submit {
            margin-left: 1em;
        }

        input {
            width: 20em;
        }
    }

    .messages {
        display: flex;
        align-items: center;
        margin-top: 0.7em;
        height: 3em;

        .icon {
            width: 1.2em;

            img {
                display: block;
                width: 1.2em;
            }
        }
    }
`;

// -------------------------- <GroupIndicator /> -------------------

export const Rect = styled.span<{color:string}>`
    background-color: ${props => props.color};
    display: block;
`;

export const GroupIndicator = styled.a`
    display: inline-flexbox;
    flex-wrap: wrap;
    vertical-align: middle;
    justify-content: space-between;
    align-content: space-between;

    width: 1.2em;
    height: 1.2em;

    ${Rect} {
        width: 45%;
        height: 45%;
        border-radius: 30%;
    }
`;

export const QueryOpInfoLI = styled.li`


`;

// ------ <AdvancedOptions /> ----------


export const AdvancedOptions = styled.div`
    margin-top: 1.7em;
`;

// ------ <AdvancedModeSwitch /> ------

export const AdvancedModeSwitch = styled.div`

    display: flex;
    align-items: center;

    a {
        color: ${theme.colorLogoBlue};
        margin-left: 0.3em;
        font-size: 1.1em;
        text-decoration: none;
    }

    a:hover {
        text-decoration: underline;
    }
`;