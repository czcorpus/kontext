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

// ---------------- <CTFreqForm /> --------------------------------------

export const CTFreqForm = styled.div`

    .setup-warning {

        img {
            display: inline-block;
            vertical-align: middle;
            margin-right: 0.7em;
            width: 1em;
        }
    }

    p.warning {
        width: 40em;

        img {
            width: 1em;
            padding-right: 0.4em;
        }
    }

    table.form {

        border: 1px solid ${theme.colorDefaultGreen};

        td, th {
            padding: 0.7em 1em;
        }

        td.data {
            padding: 0;

            div {
                margin: 0.5em;
                height: 1em;
                background-color: ${theme.colorDataTableFooter};
            }
        }

        tbody.dim1, tbody.dim2 {
            th.main {
                text-align: center;

                strong {
                    display: block;
                    font-size: 2em;
                }

                border-color: ${theme.colorDefaultGreen};
                border-width: 0 1px 0 0;
                border-style: solid;
            }
        }

        tbody.dim1 {
            background-color: ${theme.colorTableEvenBg};
        }

        tbody.dim2 {
            background-color: #FFFFFF;
        }

        tbody.dim1, tbody.dim2 {
            select option:disabled {
                color: ${theme.colorLightText};
            }
        }
    }
`;


// ---------------- <FieldsetAdvancedOptions /> ----------------------------------

export const FieldsetAdvancedOptions = styled.div`

    fieldset {
        margin-top: 0.7em;
        margin-bottom: 2.3em;
    }

    fieldset ul.items {
        padding: 0;
        margin: 0;
        list-style-type: none;
        display: flex;

        > li:not(:last-child) {
            margin-right: 1.5em;
        }
    }

`;