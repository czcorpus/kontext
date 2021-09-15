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
import { ConcordanceView } from '../main/style';


// ----------- <ConcExtendedInfo /> -----------------------

export const ConcExtendedInfo = styled(ConcordanceView)`

    display: flex;
    flex-direction: column;

    header {
        display: flex;
        flex-direction: row;
        background-color: ${theme.colorDefaultGreen};
        padding: 0.4em 0.7em;

        h2 {
            flex-grow: 9;
            margin: 0;
        }
    }

    &.collapsed header {
        padding: 0.1em;
    }

    background-color: #FFFFFF;

    .KwicConnectContainer,
    .TextTypesDist {

        p.note {
            margin: 0;
            font-size: 0.85em;
            text-align: right;

            a {
                color: ${theme.colorLightGreen};
            }

            a:hover {
                color: ${theme.colorLogoPink};
            }
        }
    }

    .Menu {
        text-align: center;

        ul {
            display: inline;
            list-style-type: none;
            margin: 0;
            padding: 0;

            li {
                padding: 0;
                padding: 0;
                display: inline-block;
            }

            li:not(:first-child) {
                margin-left: 0.7em;
            }

            li.active a {
                text-decoration: none;

            }
        }
    }

    > .contents {
        display: grid;

        > div.box:not(:first-child) {
            margin-top: 1.7em;
        }

        > div.box:first-child h3.block {
            margin-top: 0;
        }

        > div.box {
            align-self: start;
            overflow: hidden;


            .KwicConnectContainer {
                h3 {
                    margin-top: 0;
                }

                .data-not-avail {

                    color: ${theme.colorLightText};

                    img {
                        width: 1em;
                        display: inline-block;
                        vertical-align: middle;
                        margin-right: 0.3em;
                    }
                }

                .KwicConnectWidget:not(:first-child) {
                    margin-top: 2em;
                }
            }

            h3.block {
                color: ${theme.colorDefaultText};
                text-align: right;
                margin-bottom: 0;
                padding-bottom: 0.2em;
                font-size: 1.1em;
                background-color: transparent;

                img {
                    width: 1.1em;
                    margin-left: 0.3em;
                    margin-right: 0.1em;
                    margin-bottom: 0.15em;
                    display: inline-block;
                    vertical-align: middle;
                }

                img.lightbulb {
                    width: 0.9em;
                }
            }
        }
    }
`;

// -------------- <MinimizeIcon /> -------------------------------

export const MinimizeIcon = styled.a`

    display: inline-block;
    margin-right: 0;

    img {
        display: inline-block;
        vertical-align: middle;
        width: 1.3em;
    }
`;
