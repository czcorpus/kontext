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
import * as theme from '../theme/default';

// ---------------- <StructsAndAttrsForm /> --------------------------------------

export const StructsAndAttrsForm = styled.form`
    .struct-groups {

        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr 1fr;

        div.group {
            padding-left: 0.7em;
            display: flex;
            flex-direction: column;
            margin-bottom: 2em;

            .AttrList {
                flex-grow: 1;

                ul {
                    margin-top: 0.2em;
                    list-style-type: none;
                    margin-left: 0;
                    padding-left: 1.7em;

                    li label input {
                        vertical-align: middle;
                    }
                }
            }
        }

        div.group:not(:nth-child(5)) {
            border-color: ${theme.colorSuperlightText};
            border-width: 0 1px 0 0;
            border-style: solid;
            padding-right: 0.7em;
        }

        div.group:last-child {
            border-style: none;
        }

        label.struct {
            color: ${theme.colorLogoPink};
            font-size: 120%;

            input[type=checkbox] {
                display: inline-block;
                vertical-align: middle;
            }
        }
    }

    .select-all-structs-and-groups {
        margin-top: 1.5em;
        text-align: center;

        input {
            vertical-align: middle;
        }
    }

    .button-replace {
        padding: 0.3em 2em;
        background-color: transparent;
    }

    .warn {
        white-space: normal;
        width: initial;

        .icon {
            display: inline-block;
            padding-right: 0.3em;
            vertical-align: middle;

            img {
                width: 1.2em;
            }
        }
    }
`;

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
