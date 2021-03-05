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

// ---------------- <RecentQueriesPageList /> --------------------------------------

export const RecentQueriesPageList = styled.td`
    .loader {
        display: flex;
        align-items: center;
        justify-content: center;

        img {
            display: block;
        }
    }

    .last-row {
        text-align: center;
        padding: 10px 0;
    }

    ul.history-entries {

        list-style-type: none;
        margin: 0;
        padding: 0;

        > li:first-of-type {
            border-width: 1px 0 1px 0;
        }

        > li {
            margin: 0;
            padding: 0;
            border-color: ${theme.colorLightGreen};
            border-style: solid;
            border-width: 0 0 1px 0;

            .heading {
                font-size: 1.1em;
                display: flex;
                padding-top: 0.4em;
                padding-bottom: 0.4em;

                .corpname {
                    flex-grow: 1;
                    margin-right: 1em;
                    color: ${theme.colorLightText};

                    em.subcorpname {
                        font-weight: bold;
                        font-style: normal;
                    }
                }

                .date {
                    color: ${theme.colorLightText};

                    strong {
                        padding-left: 0.4em;
                    }
                }
            }

            .contents {

                display: flex;

                .saved-name {
                    color: ${theme.colorLogoPink};
                    padding-right: 0.7em;
                }

                .query-info {
                    flex-grow: 1;

                    .query-line {
                        display: flex;
                        flex-direction: column;
                        max-width: 80em;

                        .query {
                            overflow: hidden;
                            padding: 0.3em 0.7em 0 0;
                            font-family: ${theme.monospaceFontFamily};
                            background-color: transparent;
                            border: none;
                            font-size: 1.2em;
                            color: #920040;
                        }

                        span.query {
                            white-space: nowrap;
                        }

                        pre.query {
                            display: inline-block;
                            vertical-align: middle;
                        }

                        .query-type {
                            color: ${theme.colorLightText};
                            font-size: 80%;
                            padding-bottom: 0.7em;
                        }
                    }

                    .text-types-info {

                        a.switch {
                            text-decoration: none;
                            color: ${theme.colorLogoBlue};
                        }

                        a.switch:hover {
                            text-decoration: underline;
                            color: ${theme.colorLogoBlueShining};
                        }

                        ul {
                            margin: 0.4em 0 0.2em 0;
                        }
                    }
                }

                .actions {
                    display: flex;
                    flex-direction: column;
                    justify-content: right;

                    > div {
                        text-align: right;
                    }

                    > div:not(:last-child) {
                        margin-bottom: 0.7em;
                    }
                }
            }

        }

        div.footer {
            font-size: 0.9em;
            padding-bottom: 0.4em;
            margin-top: 0.3em;

            a.open-in-form {
                float: right;
                color: ${theme.colorLogoBlue};
            }

            a.open-in-form:hover {
                color: ${theme.colorLogoBlueShining};
            }
        }
    }

    /*
    .history-entry:not(:last-of-type) {
        border-color: @color-light-grey;
        border-width: 0 0 1px 0;
        border-style: solid;
    }
    */

    .options {
        text-align: left;
        font-size: 80%;
        padding: 5px 20px;
        color: ${theme.colorLogoBlue};
        line-height: 1.5em;
    }

    .options span.query-action {
        border: 1px solid ${theme.colorLogoBlue};
        color: ${theme.colorLogoBlue};
        border-radius: 3px;
        padding: 1px 4px;
        white-space: nowrap;
    }

    .selectable {
        display: inline-block;
        border: ${theme.inputBorderStyle};
        border-radius: ${theme.inputBorderRadius};
        background-color: #FFFFFF;
        padding: 3px 5px;
    }

    .default-attr {
        border: 1px solid ${theme.colorLogoBlue};
        color: ${theme.colorLogoBlue};
        border-radius: 3px;
        padding: 1px 4px;
        white-space: nowrap;
    }

    .query-history-filter {
        margin-bottom: 2.3em;

        label:not(first-child) {
            margin-left: 1em;
        }
    }
`;
