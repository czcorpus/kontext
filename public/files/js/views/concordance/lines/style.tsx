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

// ----------- <ConcLines /> ----------------------

export const ConcLines = styled.table`

    background-color: white;
    font-size: 1em;
    font-family: ${theme.condensedFontFamily};
    border-spacing: 0px;
    padding-bottom: 20px;
    width: 100%;

    .line-num {
        text-align: right;
        color: ${theme.colorLightText};
    }

    tr:nth-child(2n):not(.active) {
        background-color: ${theme.colorTableEvenBg};
    }

    td {
        line-height: 1.6em;
        padding-right: 0.4em;
        padding-left: 0.4em;
    }

    td:first-child {
        padding-left: 0.2em;
    }

    .group-id {
        font-weight: bold;
        padding: 0.3em;
    }

    tr span:not(.ml) .attr {
        font-size: 90%;
        font-weight: bold;
        font-family: ${theme.monospaceFontFamily};
    }

    mark {
        background-color: transparent;
    }

    mark.active {
        cursor: pointer;
    }

    &.safe {
        font-family: sans-serif;
    }

    td.maincorp {
        background-color: rgba(0, 100, 255, 0.1);
    }

    td.ref a {
        text-decoration: none;
        font-size: 0.85em;
        white-space: nowrap;
        cursor: pointer;
        color: #009EE0;
        font-weight: bold;
        max-width: 12em;
        overflow: hidden;
        text-overflow: ellipsis;
        padding-right: 2em;

        .item:not(:last-child)::after {
            content: " \u2726  ";
            white-space: pre;
        }
    }

    tr.active .ref {
        color: #FFFFFF;
    }

    .lc {
        text-align: right;
        white-space: nowrap;
        padding-right: 0.1em;
        border-right: 0px !important;
    }

    .rc {
        text-align: left;
        white-space: nowrap;
        padding-left: 0.3em;
        border-right: 0px !important;
    }

    .kw {
        text-align: center;
        white-space: nowrap;
    }

    .coll {
        color: ${theme.colorLogoPink};
        cursor: pointer;
    }

    em.coll {
        cursor: text;
    }

    .col0 {
        font-weight: bold;
    }

    i.coll {
        font-style: italic;
        font-weight: normal;
    }

    .strc {
        color: green;
        font-style: normal;
        font-size: 110%;
    }

    .concordance-col-heading {
        min-width: 280px;
        text-align: center;
    }

    .concordance-col-heading-hidden {
        width: 2em;
    }

    .select-primary-lang {
        font-size: 110%;
        font-family: "Roboto";
    }

    tr.active {
        background-color: RGBA(138, 195, 218, 0.6);
    }

    td.lc > span.ml, td.rc > span.ml, td.kw > strong.ml, td > em.ml, td.par > span > span.ml, td.par > span > strong.ml {
        display: inline-flex;
        flex-direction: column;
        justify-content: start;
        text-align: center;

        span.tail {
            color: ${theme.colorLightText};
            font-style: normal;
            padding-left: 0.1em;
            padding-right: 0.1em;
        }

        span.tail.attr {
            font-weight: normal;
        }
    }

`;

