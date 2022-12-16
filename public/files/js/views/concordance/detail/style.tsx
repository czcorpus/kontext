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



// ----------- <ConcordanceDetail /> -----------------------------------

export const ConcordanceDetail = styled.div`

    &.tooltip-box {
        max-width: 40em;
        min-width: 30em;
        max-height: 80%;
    }

    .footer {
        padding-top: 1em;
        text-align: center;
        font-size: 80%;
        color: ${theme.colorLightText};

        a {
            text-decoration: none;
            color: ${theme.colorLightText};
        }
    }

    .footer:hover a {
        text-decoration: underline;
    }

    .ajax-loader {
        display: block;
        margin: 1em auto;
    }

    .view-mode {
        margin: 0;
        padding: 0;
        text-align: center;
    }

    ul.view-mode {
        list-style-type: none;

        li {
            margin: 0 0 0.7em 0;
            padding: 0;
            display: inline-block;

            a {
                text-decoration: none;
                color: ${theme.colorLogoBlue};
            }
            a:hover {
                text-decoration: underline;
            }
        }

        li.current {
            a {
                color: ${theme.colorLogoPink};
            }
        }

        li:after {
            content: " |\u00a0";
        }

        li:last-child:after {
            content: "";
        }
    }

    a.expand.left {
        margin-right: 0.3em;
    }

    table.speeches {

        border-spacing: 0 0.9em;

        tr.speech {
            line-height: 1.2em;

            th {
                font-weight: normal;
                text-align: right;
                white-space: nowrap;
                vertical-align: middle;
            }

            td {
                vertical-align: middle;
            }

            .speaker {
                border: 1px solid ${theme.colorLightText};
                border-radius: ${theme.inputBorderRadius};
                display: inline-block;
                vertical-align: middle;
                font-size: 0.8em;
                font-weight: normal;
                padding: 0.05em 0.7em;
            }

            .speech-text {
                display: block;
                margin-left: 1em;

                span.play-audio {

                    padding-left: 1em;

                    img {
                        width: 1.2em;
                        vertical-align: middle;
                        cursor: pointer;
                    }

                    img:hover {
                        text-decoration: underline;
                    }
                }
            }

            .speech-text.focus {
                background-color: ${theme.colorBgLightBlue};
            }

            .plus {
                font-weight: bold;
                font-size: 110%;
            }

            .overlap {
                float: right;
                width: 1em;
            }
        }

        tr.expand {

            th {
                text-align: right;
                padding-right: 0.2em;

                a {
                    width: 3em;
                    display: inline-block;

                    img {
                        width: 1.4em;
                    }
                }
            }
        }
    }

    .coll {
        color: ${theme.colorLogoPink};
    }

    .token-detail {

        h2.token {
            font-weight: bold;
            margin-left: 0;
            font-size: 1.7em;
        }

        hr {
            margin-top: 0;
            margin-bottom: 0.7em;
            background-color: #8d8c8c;
        }

        /* a heading for a service output */
        dt {
            display: flex;
            align-items: center;
            color: #7c7c7c;
            text-align: right;
            margin-inline-start: 0;
            font-size: 1.1em;

            img {
                width: 1.3em;
                margin-left: 0.1em;
                margin-right: 0.4em;
            }
        }

        dd {
            margin-inline-start: 1.5em;
            margin-top: 0.7em;
        }

    }
`;



// ----------- <RefsDetail /> -----------------------------------

export const RefsDetail = styled.div`

    &.tooltip-box.refs-detail {
        min-width: 40em;
        max-height: 80%;
        display: flex;
        justify-content: center;

        .wrapper {
            overflow-x: auto;
            overflow-y: auto;
        }
    }

    table.full-ref {
        border-spacing: 0;
        border: 1px solid ${theme.colorDefaultGreen};
        border-radius: ${theme.borderRadiusDefault};
        margin: 0.7em auto;
        background-color: #FFFFFF;

        td,
        th {
            padding: 0.3em;
            text-align: left;
        }

        th {
            padding-left: 1em;
        }

        td.data {
            padding-right: 1.5em;
        }

        td.data:not(:last-child) {
            border-color: ${theme.colorLightFrame};
            border-style: solid;
            border-width: 0 1px 0 0;
        }

        tr:nth-child(odd) {
            background-color: ${theme.colorLightGreen};
        }
    }

`;

