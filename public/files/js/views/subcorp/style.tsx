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

// ---------------- <SubcorpForm /> --------------------------------------

export const SubcorpForm = styled.form`

    p.note {
        margin: 0.3em;
    }

    .data-sel {
        margin-top: 1.6em;
    }

    .subcname input {
        font-size: 1.3em;
        width: 20em;
    }

    .submit-buttons {

        padding-top: 1em;

        > *:not(:first-child) {
            margin-left: 0.7em;
        }
    }

    .public-desc-help {
        margin-top: 0.7em;
        width: 10em;
        white-space: normal;
        color: ${theme.colorLightText};
    }
`;

// ---------------- <TRWithinBuilderWrapper /> --------------------------------------

export const TRWithinBuilderWrapper = styled.div`
    .WithinBuilder {
        margin-top: 1em;
        margin-bottom: 1em;
    }

    .button-row td {
        padding-top: 0.7em;
    }

    tr.within-rel {
        font-size: 1em;
        font-weight: normal;
        color: ${theme.colorLightText};
        white-space: nowrap;

        td {
            padding-top: 1em;
        }

        .set-desc {
            background-color: #FFFFFF;
            border-radius: ${theme.inputBorderRadius};
            color: ${theme.colorLightText};
            padding-right: 0.6em;
        }

        .line-id {
            text-align: right;
            font-weight: bold;
            font-size: 120%;
            color: ${theme.colorLogoPink};
            padding-right: 0.4em;
        }
    }

    td {
        padding: 0;
    }

    td > * {
        vertical-align: middle;
    }

    td > sup {
        vertical-align: top;
    }

    .negation {
        padding: 0.1em 0.4em;
        font-weight: bold;
    }

    .remove-line {
        cursor: pointer;
        width: 1em;
        margin-left: 0.2em;
    }

    .code {
        font-family: ${theme.monospaceFontFamily};
    }

    td.container tr.last-line td {
        padding-top: 0.4em;
    }

    td.container tr.last-line .add-within:hover {
        background-color: ${theme.colorLogoBlueShining};
    }
`;

// ---------------- <SubcorpList /> --------------------------------------

export const SubcorpList = styled.div`
    .ActionMenu {
        display: inline-block;
        list-style-type: none;
        margin: 0;
        padding: 0;

        li {
            display: inline-block;
            margin: 0;
            padding: 0;
        }

        li:not(last-child) {
            margin-right: 0.7em;
        }
    }

    div.mass-op {
        margin: 0.4em 0;
        overflow: hidden;

        label.show-deleted {
            float: right;
        }
    }

    table td.processing {
        color: ${theme.colorLogoPink};
    }

    .properties-subc {
        font-size: 1.7em;
    }

    form.filter {

        legend {
            font-weight: bold;
        }

        fieldset > div {
            margin-top: 0.7em;
        }

        input {
            vertical-align: middle;
        }

        input.inactive {
            color: gray;
        }
    }


`;

// ---------------- <ListPublic /> --------------------------------------

export const ListPublic = styled.div`

    margin-top: 1em;

    .disclaimer {

        max-width: 50em;
        padding: 0.7em;

        img {
            display: inline-block;
            width: 1em;
            vertical-align: middle;
            margin-right: 0.4em;
        }
    }

    .loader {
        background-color: ${theme.colorDefaultTextBg};
        text-align: center;
        border: 1px solid ${theme.colorDefaultGreen};
        padding: 0.7em 1em 0.3em 1em;

        img {
            display: inline-block;
        }
    }
`;

// ---------------- <DataList /> --------------------------------------

export const DataList = styled.ul`

    margin: 0;
    padding: 0;
    list-style-type: none;
    border: 1px solid ${theme.colorDefaultGreen};
    background-color: ${theme.colorDefaultTextBg};

    .no-result {
        text-align: center;
    }
`;

// ---------------- <DataRow /> --------------------------------------

export const DataRow = styled.li`

    margin: 0;
    padding: 0.7em 1em 0.3em 1em;

    button.use-in-query {
        float: right;
    }

    h3 {
        font-size: 1.3em;
        font-weight: normal;
        margin: 0 0 0.2em 0;

        .code {
            color: ${theme.colorLightText};
        }
    }

    table.props {

        th {
            text-transform: lowercase;
        }
    }

    .description {
        font-family: ${theme.condensedFontFamily};
        margin-top: 0.7em;
        margin-left: 0.25em;
        margin-bottom: 0.7em;
        padding: 0.7em 1em;
        border-color: ${theme.colorLightText};
        border-style: dashed;
        border-width: 0 0 0 1px;
    }

    &:nth-child(2n) {
        background-color: ${theme.colorTableEvenBg};
    }
`;

// ---------------- <DetailExpandSwitch /> --------------------------------------

export const DetailExpandSwitch = styled.a`

    display: inline-block;
    margin-top: 0.7em;
    text-decoration: none;
    color: ${theme.colorLightText};

    img {
        vertical-align: middle;
        display: inline-block;
        margin-right: 0.2em;
    }

    &:hover {
        text-decoration: underline;
        color: ${theme.colorLogoPink};
    }
`;

// ---------------- <Filter /> --------------------------------------

export const Filter = styled.fieldset`

    border: none;

    label {
        display :inline-block;
    }

    input[type="text"] {
        font-size: 1.5em;
    }

    .CodePrefixInput {
        font-size: 120%;
    }

    p.note {
        margin-bottom: 0;
    }
`;

// ---------------- <QuickSubcLABEL /> --------------------------------------

export const QuickSubcLABEL = styled.label`

    input {
        margin-left: 0.7em;
    }
`

// ----------------- <QuickSubcFieldset /> ----------------------------------------

export const QuickSubcFieldset = styled.fieldset`
    display: flex;
    flex-direction: column;

    > * {
        margin-top: 0.3em;
        margin-bottom: 0.3em;
    }

    label {
        display: flex;
        align-items: center;
    }

    .submit-section {
        margin-top: 0.9em;
    }

`;

// ---------------- <RestoreTabContentWrapper /> --------------------------------

export const RestoreTabContentWrapper = styled.div`
    display: flex;
    margin-top: 1em;
    justify-content: flex-end;

    > *:not(:first-child) {
        margin-left: 0.7em;
    }
`;

// ---------------- <ReuseTabContentWrapper /> --------------------------------

export const ReuseTabContentWrapper = styled.div`

    .submit-buttons {

        padding-top: 1em;

        > *:not(:first-child) {
            margin-left: 0.7em;
        }
    }
`;

// ---------------- <TabContentWrapper /> --------------------------------

export const TabContentWrapper = styled.div``;

// ---------------- <PublishingTab /> ------------------------------------

export const PublishingTab = styled.div`

    .preview, textarea {
        font-size: 1.4em;
        border-radius: ${theme.borderRadiusDefault};
        border-color: ${theme.colorLightFrame};
        border-width: 1px;
        border-style: solid;
    }

    .preview {
        padding: 0.6em;
        background-color: #FFFFFF;
    }

    textarea {
        padding: 0.3em;
    }

    div.header-bar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-bottom: 1.1em;

        label {
            display: flex;
            align-items: center;
        }

        .help-icon {
            flex-grow: 1;
        }
    }

    .markdown-note {
        text-align: right;
    }
`;

// ------------------- <StructLineTR /> ----------------------------

export const StructLineTR = styled.tr`

    td.attr-sel {
        white-space: nowrap;
    }
`;

// ------------------- <SubcPaginator /> ----------------------------

export const SubcPaginator = styled.div`

    display: flex;
    align-items: center;

    margin-bottom: 0.4em;
    padding-top: 0.4em;
    padding-bottom: 0.4em;

    form {
        margin: 0;
    }
`;

// ------------------ <SubclistFilterForm /> ------------------------

export const SubclistFilterForm = styled.form`
    .inputs {
        display: flex;
        align-items: center;
    }

    .inputs > div {

        label {
            margin-right: 0.3em;
        }

        input[type='checkbox'] {
            margin: 0;
        }
    }

    .inputs div:not(:first-child) {
        margin-left: 1em;
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


// ------------------ <_SubcorpusEdit /> -----------------------

export const SubcorpusEdit = styled.div`

    .reuse .info {

        display: flex;
        margin-bottom: 1em;
    }

`;

// ------------------- <RawCQLForm /> ------------------------------

export const RawCQL = styled.div`

    margin-top: 1.2em;

    label {
        display: block;
        margin-bottom: 0.4em;
    }

    textarea {
        font-size: 1.2em;
        margin-bottom: 0.7em;
    }
`;

// ------------------- <LineSelectionOps /> ---------------------------

export const LineSelectionOps = styled.div`

    margin-top: 0.7em;
    display: flex;
    align-items: center;

    > *:not(:first-child) {
        margin-left: 0.7em;
    }
`;


// ------------------ <DataLineTr /> ------------------------------------

export const DataLineTr = styled.tr`

    .draft {
        font-style: italic;
        color: ${theme.colorLightText};
    }
`;
