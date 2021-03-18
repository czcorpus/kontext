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
import * as theme from '../../theme/default';


// ---------------- <GeneralOptions /> --------------------------------------

export const GeneralOptions = styled.div`
    max-width: 30em;
    white-space: normal;

    .warn {
        white-space: normal;
        width: 25em;

        .icon {
            display: inline-block;
            padding-right: 0.3em;
            vertical-align: middle;

            img {
                width: 1.2em;
            }
        }
    }

    .data-loader {
        text-align: center;
    }

    fieldset {
        padding: 10pt 10pt;

        legend {
            font-weight: bold;
        }

        legend:first-letter {
            text-transform: capitalize;
        }

        input {
            margin-left: 5pt;
        }

        // hide number input arrows
        /* Chrome, Safari, Edge, Opera */
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }

        /* Firefox */
        input[type=number] {
            -moz-appearance: textfield;
        }
    }

    fieldset:not(:first-of-type) {
        margin-top: 0.7em;
    }
`;

// ------------------- <ResultRangeAndPagingTable /> ------------------------

export const ResultRangeAndPagingTable = styled.table`

    border-collapse: collapse;


    th {
        font-weight: normal;
        text-align: left;
    }

    td {
        padding: 3pt 0;
    }

`;