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

// ---------------- <FrequencyForm /> --------------------------------------

export const FrequencyForm = styled.div`

padding-left: 1em;
    padding-right: 1em;

    .freq-form {
        margin-top: 0.7em;

        fieldset {
            margin-top: 0.4em;
            padding: 1em 0.7em;
        }

        table.struct-attr-list {

            table {
                border-spacing: 0;
                padding: 0;
                margin: 0;

                td {
                    padding: 0;

                    label {
                        display: block;
                    }
                }

                td:last-child {
                    padding-left: 0.3em;
                }

                tr:hover {
                    background-color: ${theme.colorLightFrame};
                }
            }

            > tbody > tr > td:not(:last-child) {
                border-color: ${theme.colorSuperlightText};
                border-width: 0 1px 0 0;
                border-style: solid;
            }

            > tbody > tr > td:not(:first-child) {
                padding-left: 1em;
            }
        }
    }
`;
