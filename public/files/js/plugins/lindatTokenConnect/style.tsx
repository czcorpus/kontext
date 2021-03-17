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
 
export const VallexJsonRenderer = styled.div`
    div.containerTC{
        margin-top: 1em;
    }

    div.forVLink {
        display: inline-block;
        right: 0;
        position: absolute;
        a.vallexSense {
            margin: 0 0 0.5em 0;
            font-size: 16px;
            font-weight: bold;
            padding-right: 1.5em;
            cursor: pointer;
        }
    }

    a.toPDT {
        font-size: 1.4em;
        color: black;
        font-weight: bold;
    }

    li.ExamplesH {
        list-style-type: none;
        margin-bottom: 0.4em;
        color: black;
        font-weight: bold;
    }

    ul.vallexHiddenBullets {
        list-style-type: none;
        margin: 0;
        padding: 0;
    }

    li.pdtvallexExpl {
        color: #777;
        font-weight: bold;
    }

    div.vallexSum {
        margin-bottom: 0.5em;

        span.vallexSense {
            margin: 0 0 0.5em 0;
            font-size: 16px;
            font-weight: bold;
            padding: 0;
        }

    }
    div.vallexSourceV {
        div.vallexSum2 {
            margin-bottom: 0.5em;
            font-weight: bold;
            div.forVLink2 {
                display: inline-block;
                right: 2.0em;
                position: absolute;
            }
        }
    }

    .vallexFrame {
        color: darkred;
        margin: 0 0 0 0.2em;
    }

    div.vallexExpl {
        color: #777;
        font-weight: bold;
    }

    li.vallexExamples {
        margin: 0 0 0.2em 0;
        padding: 0;
    }

    a.vallexExpand {
        margin: 0 0 1.0em 0.8em;
        display: inline-block;
    }

    div.vallexTargetBlock {
        margin: 0 0 1.4em 0.8em;

        div.vallexTargetV {
            font-weight: bold;
        }

        div.vallexExplInner {
            color: #777;
            font-weight: bold;
        }
    }
`;