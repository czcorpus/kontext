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

export const QueryStructureWidget = styled.div`

    table.positions {
        border-collapse: separate;
        border-spacing: 0;

        tr.interpretation {

            background-color: #FFFFFF;

            td {
                border-style: solid;
                border-color: ${theme.colorLightFrame};
                border-width: 1px 1px 1px 0;
                vertical-align: middle;

                > div {
                    padding: 0.9em 0.3em;
                    text-align: center;

                    .attr {
                        font-weight: bold;
                    }

                    .value {
                        font-size: 1.3em;
                    }
                }

                > .operator {

                    padding: 0;

                    span {
                        display: inline-block;
                        padding: 0.2em 0.4em;
                        margin-top: 0.5em;
                        margin-bottom: 0.5em;
                        color: ${theme.colorLogoOrange};
                        font-size: 0.9em;
                        font-weight: bold;
                    }
                }
            }

            td:last-child {
                border-right-width: 1px;
                border-radius: 0 5px 5px 0;
            }

            td:first-child {
                border-left-width: 1px;
                border-radius: 5px 0 0 5px;
            }
        }

        td.position:last-child {

            border: none;

            div {
                margin-right: 0.4em;
            }
        }

        td.text {
            padding: 1em 0 1em 0;
        }

        tr.token {

            background-color: #FFFFFF;

            td {
                border-style: solid;
                border-color: ${theme.colorLightFrame};
                border-width: 1px 0 1px 0;
                padding-top: 0.3em;
                padding-bottom: 0.3em;
                text-align: center;
            }

            td:first-child {
                border-radius: 5px 0 0 5px;
                border-width: 1px 0 1px 1px;
            }

            td:last-child {
                border-radius: 0 0.3em 0.3em 0;
                border-width: 1px 1px 1px 0;
            }
        }
    }

    .buttons {

        margin-top: 2em;

        button:not(:last-child) {
            margin-right: 1em;
        }
    }

    .empty {
        display: flex;
        align-items: center;

        > :first-child {
            margin-right: 0.4em;
        }

        img {
            width: 1.5em;
        }
    }
`;