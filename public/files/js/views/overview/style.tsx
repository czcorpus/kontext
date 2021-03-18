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
import * as theme from '../theme/default';

// ------------ <CorpusInfoBox /> --------------------------

export const CorpusInfoBox = styled.div`

    dl dt {
        font-weight: normal;
        color: ${theme.colorLightText};
    }

    dl dt::first-letter {
        text-transform: uppercase;
    }

    dl dt:not(:first-of-type) {
        margin-top: 0.9em;
    }

    dl dd {
        margin-top: 0.3em;
        margin-left: 1em;
        font-size: 1.2em;
    }

    dl dd a {
        color: ${theme.colorDefaultText};
    }

    dl dd a:hover {
        color: ${theme.colorLogoBlue};
    }

    h2.subcorpus-name,
    h2.corpus-name {
        font-size: 2.3em;
        font-weight: normal;
        margin: 0 0 0.1em 0;
        padding: 0.2em 0.3em;
        display: inline-block;
        color: ${theme.colorDefaultText};
    }

    ul {
        margin: 0;
    }

    h2 {
        margin-bottom: 1em;
        text-align: center;
    }

    h3 {
        font-size: 13pt;
        margin-top: 1em;
        margin-bottom: 0.3em;
    }

    h4 {
        margin-top: 0.5em;
        margin-bottom: 0;
    }

    table.attrib-list tr.item *,
    table.struct-list tr.item * {
        background-color: transparent;
    }

    table.attrib-list,
    table.struct-list {
        border-collapse: collapse;
    }

    table.attrib-list tr:nth-child(2) th,
    table.attrib-list tr:nth-child(2) td,
    table.struct-list tr:nth-child(2) th,
    table.struct-list tr:nth-child(2) td {
        padding-top: 0.7em;
    }

    table.attrib-list th,
    table.struct-list th,
    table.attrib-list td,
    table.struct-list td {
        font-size: 0.8em;
    }

    table.attrib-list th,
    table.struct-list th {
        color: ${theme.colorLogoPink};
        padding: 0.2em 1em;
        text-align: left;
        font-weight: normal;
    }

    table.attrib-list th.attrib-heading,
    table.struct-list th.attrib-heading {
        background-color: transparent;
        border-color: ${theme.colorLightText};
        border-style: solid;
        border-width: 0 0 1px;
        color: ${theme.colorDefaultText};
        font-size: 1em;
        text-align: center;
        font-weight: normal;
    }

    table.structs-and-attrs {
        margin: 0;
        clear: both;
        border-collapse: separate;
        border: none;
    }

    table.structs-and-attrs td {
        vertical-align: top;
    }

    .note {
        margin: 1em 0 0 0;
        padding: 0 5em 0 0;
        font-size: 70%;
        color: ${theme.colorDefaultText};
    }

    .empty-citation-info {
        margin-bottom: 0.7em;
    }

    td.numeric {
        padding-left: 1em;
        text-align: right;
    }

    dd.references h4 {
        font-size: 0.8em;
        font-weight: bold;
        margin-top: 0.7em;
    }

    dd.references .html {
        font-size: 0.8em;
    }

    .keyword {
        background-color: ${theme.colorBgLightBlue};
        border-style: solid;
        border-color: ${theme.colorLogoBlue};
        border-width: 1pt;
        border-radius: ${theme.borderRadiusDefault};
        margin: 0.4em 0.2em;
        padding: 0.2em 0.4em;
        font-size: small;
    }
`;

// ------------ <SubcorpusInfo /> --------------------------

export const SubcorpusInfo = styled.div`

    dl dt {
        font-weight: normal;
        color: ${theme.colorLightText};
    }

    dl dt::first-letter {
        text-transform: uppercase;
    }

    dl dt:not(:first-of-type) {
        margin-top: 0.9em;
    }

    dl dd {
        margin-top: 0.3em;
        margin-left: 1em;
        font-size: 1.2em;
    }

    dl dd a {
        color: ${theme.colorDefaultText};
    }

    dl dd a:hover {
        color: ${theme.colorLogoBlue};
    }

    h2.subcorpus-name,
    h2.corpus-name {
        font-size: 2.3em;
        font-weight: normal;
        margin: 0 0 0.1em 0;
        padding: 0.2em 0.3em;
        display: inline-block;
        color: ${theme.colorDefaultText};
    }

    h2 {
        margin-left: 0;
    }

    .subc-query {
        margin-top: 0.4em;
    }

    .subc-query textarea {
        background-color: transparent;
        border: 1px solid ${theme.colorLightGrey};
        margin-top: 0.4em;
    }

    .subc-query h3,
    .description h3 {
        margin-bottom: 0.7em;
    }

    .description .html {
        font-size: 0.9em;
        border-radius: ${theme.inputBorderRadius};
        padding: 0.7em;
        background-color: #edf9fd;
        border: 1px solid #d8e7ed;
    }
`;