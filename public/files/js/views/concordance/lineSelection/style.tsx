/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
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


// ----------------------- <LockedLineGroupsMenu /> -------------------

export const LockedLineGroupsMenu = styled.div`

    fieldset {

        legend {
            font-weight: bold;
            padding-right: 0.6em;
        }

        button.ok {
            margin-right: 0.4em;
        }

        input.email {
            margin-right: 0.6em;
        }

        span.arrow {
            font-size: 130%;
            font-weight: bold;
            color: ${theme.colorLogoPink};
        }
    }

    .ajax-loader-bar {
        display: inline-block;
        padding-left: 0.5em;
        padding-right: 0.5em;
    }

    h3 {
        margin-top: 0;
    }

    h4 {
        font-size: 0.9em;
        margin-top: 0;
        text-align: center;
    }

    .form-item {
        margin-top: 1em;
        margin-bottom: 1em;
    }

    .footer {

        margin: 0.9em 0 0 0;
        padding: 0;

        legend {

        }

        ul.export {
            margin: 0.4em 0 0 0;
            padding: 0;
            list-style-type: disc;
            list-style-position: inside;

            li {
                padding-left: 0;
                margin-left: 0.7em;
            }
        }
    }
`;

// --------------- <LockedLineGroupsChartFieldset /> ------------------------------

export const LockedLineGroupsChartFieldset = styled.fieldset`

    vertical-align: middle;
    margin-top: 1.5em;
    min-width: 200px;
    min-height: 200px;
    padding: 0;

    legend {
        margin-left: 0;
        padding-left: 0;
    }

    img.ajax-loader {
        display: block;
        margin-top: 6em;
        margin-left: auto;
        margin-right: auto;
    }

    .chart {
        display: inline-block;
        vertical-align: middle;
    }

    table.chart-label {
        display: inline-block;
        vertical-align: middle;
        padding-left: 0.7em;
    }

    table.chart-label .color-code {
        display: inline-block;
        height: 1.5em;
        width: 1.5em;
        border-color: ${theme.colorFrameFieldset};
        border-width: 1px;
        border-radius: ${theme.inputBorderRadius};
    }

    table td {
        padding-left: 0.4em;
    }

    table td.additional {
        color: ${theme.colorLightText};
    }


    table th {
        font-weight: bold;
        padding-left: 0.4em;
    }

    table .num {
        text-align: right;
    }
`;

// ------------ <SelectionLinkAndToolsFieldset /> ------------------------------------

export const SelectionLinkAndToolsFieldset = styled.fieldset`

    margin: 0.9em 0 0 0;
    padding: 0;
    display: block;

    legend {
        margin-bottom: 0.7em;
    }

    .conc-link {
        display: block;
        background-color: ${theme.colorLightGrey};
        border: 1px solid ${theme.colorLightText};
        padding: 0.2em 0.5em;
        margin-bottom: 1em;
        margin-left: 0.7em;
        min-width: 30em;
    }

`;