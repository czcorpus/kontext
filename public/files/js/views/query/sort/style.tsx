/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

// ---------------- <SortKeySelector /> --------------------------------------

export const SortKeySelector = styled.div`

    font-size: 0.9em;
    border-spacing: 0.2em 1em;
    display: flex;

    > div {
        border: 1px solid ${theme.colorLightText};
        padding: 0;

        a {
            display: block;
            padding: 0.5em 0.9em;
            text-decoration: none;
            color: ${theme.colorLogoBlue};
            text-align: center;
        }

        a:hover {
            background-color: ${theme.colorLogoBlue};
            color: #ffffff;
        }
    }

    > div.selected {
        background-color: ${theme.colorLogoBlue};
        a {
            color: #ffffff;
        }
    }

    > div.kw a {
        color: ${theme.colorLogoPink};
    }

    > div.kw:hover a {
        color: ${theme.colorLightPink};
    }

    > div.kw.selected a {
        color: #ffffff;
    }
`;

// ---------------- <MLSingleLevelFields /> --------------------------------------

export const MLSingleLevelFields = styled.table`

    border: 1px solid ${theme.colorLightFrame};
    border-radius: ${theme.borderRadiusDefault};
    border-spacing: 0;

    > tbody > tr {
        > th, > td {
            padding: 0.4em 0.7em;
        }

        > th {
            text-align: left;
            white-space: nowrap;
        }

        > th.level {
            white-space: normal;
        }
    }

    > tbody > tr:last-child {
        td, th {
            padding-bottom: 1em;
        }
    }

    th.level {
        background-color: ${theme.colorDefaultGreen};

        .close-icon {
            float: right;

            img {
                vertical-align: middle;
                width: 1em;
            }
        }
    }
`;

// ---------------- <MultiLevelSortForm /> --------------------------------------

export const MultiLevelSortForm = styled.ul`

    white-space: normal;
    margin: 0;
    list-style-type: none;
    display: grid;
    grid-template-columns: 1fr 1fr;

    li {
        padding: 1em;
        margin: 0;
    }

    li:last-child {
        align-self: center;
        justify-self: center;
    }

    li:nth-child(odd) {
        grid-column-start: 1;
        grid-column-end: 1;
        grid-row-start: auto;
        grid-row-end: auto;
    }

    li:nth-child(even) {
        grid-column-start: 2;
        grid-column-start: 2;
        grid-row-start: auto;
        grid-row-end: auto;
    }
`;