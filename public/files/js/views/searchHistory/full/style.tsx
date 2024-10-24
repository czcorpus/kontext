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

// ---------------- <RecentQueriesPageList /> --------------------------------------

export const RecentQueriesPageList = styled.div`
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
`;

// ------------- <DataRowLi /> ---------------------------------

export const DataRowLi = styled.li`

    border-style: solid;
    border-color: ${theme.colorLightFrame};
    border-width: 1px 0 0 0;
    margin: 0;
    padding: 0.4em 0 0 0;

    &:not(:first-of-type) {
        margin-top: 1em;
    }

    .heading {
        font-size: 1.1em;
        display: flex;
        padding-top: 0.4em;
        padding-bottom: 0.4em;

        h3 {
            flex-grow: 1;
            margin: 0 1em 0 0;
            color: ${theme.colorLightText};
            font-weight: normal;
            font-size: 1em;

            .subcorpname {
                font-style: normal;
            }

            .supertype {
                font-weight: bold;
            }
        }

        .date {
            color: ${theme.colorLightText};

            strong {
                padding-left: 0.4em;
            }
        }
    }
`;

// ------------- <SavedNameInfo /> -------------------------

export const SavedNameInfo = styled.div`

    color: ${theme.colorLogoPink};
    padding-right: 0.7em;

`;

// ------------- <QueryInfoDiv /> -------------------------

export const QueryInfoDiv = styled.div`

    flex-grow: 1;
    padding: 0.7em;
    margin-bottom: 0.3em;
    cursor: pointer;
    border-radius: ${theme.inputBorderRadius};
    border-color: transparent;
    border-width: 1px;
    border-style: solid;

    :hover {
        border-color: ${theme.colorLightFrame};
        background-color: ${theme.colorBgLightBlue};
    }

    .text-types-info {

        margin-top: 0.7em;

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

    dl.pnfilter {

        dt {
            font-weight: bold;
        }

        dd {
            margin-left: 1em;
            padding: 0.4em 0;
            color: ${theme.shRegexp};
        }
    }
`;

// -------------- <QueryAndTypeDiv /> ------------------------------

export const QueryAndTypeDiv = styled.div`

    display: flex;
    align-items: center;
    max-width: 80em;
    margin-top: 0;

    .symbol {
        font-size: 1.4em;
        color: ${theme.colorLightText};
    }

    .query {
        padding: 0.3em 0.7em 0 0;
        font-family: ${theme.monospaceFontFamily};
        background-color: transparent;
        border: none;
        font-size: 1.2em;
        color: #920040;
    }

    .blank {
        font-style: italic;
    }

    pre.query {
        display: inline-block;
        vertical-align: middle;
    }
`;

// ----------------------- <AlignedQueryInfoDiv /> ---------------------

export const AlignedQueryInfoDiv = styled.div`

    margin-left: 2em;
    font-size: 0.9em;

`;

// ----------------------- <ActionsDiv /> ------------------------------

export const ActionsDiv = styled.div`

    display: flex;
    align-items: center;
    justify-content: flex-start;

    .tools {
        display: flex;
        flex-grow: 1;
        text-align: right;
        align-items: center;
        justify-content: flex-end;
    }

    .saved-as {

        margin-right: 1em;

        .saved-name {
            color: ${theme.colorLogoPink}
        }
    }

`;

// ---------------------- <SaveItemForm /> ------------------------------

export const SaveItemForm = styled.div`
    display: flex;
    align-items: center;
    margin-left: 1em;
    border: ${theme.inputBorderStyle};
    border-radius: ${theme.borderRadiusDefault};
    background-color: #FFFFFF;
    padding: 0.2em 0.7em;

    label {

        display: flex;
        flex-direction: column;
        margin-left: 1em;
        margin-right: 1em;

        span {
            text-align: left;
        }
    }
`;

// ---------------------- <FilterForm /> --------------------------------

export const FilterForm = styled.form`

    margin-bottom: 2.3em;

    fieldset.basic {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        border: 1px solid ${theme.colorLightFrame};
        border-radius: ${theme.borderRadiusDefault};
        padding: ${theme.defaultFieldsetPadding};

        label:not(first-child) {
            margin-left: 1em;
        }

        label {
            white-space: nowrap;
        }
    }

    .grid-inputs {
        display: grid;
        grid-template-columns: auto auto auto auto;
        gap: 1rem;
        align-items: center;
        width: max-content;

        input[type=text] {
            height: 1.2em;
        }
    }

    fieldset.advanced {
        border: 1px solid ${theme.colorLightFrame};
        border-radius: ${theme.borderRadiusDefault};
        padding: ${theme.defaultFieldsetPadding};

        .advanced-fields {
            margin-top: 1em;
        }

        button {
            float: right;
        }
    }

    .prop-query {
        padding-bottom: 1.1em;
        display: flex;
        align-items: center;
    }

    label.emph {
        font-weight: bold;
        font-size: 1.1em;
    }

    div.aligned {
        display: flex;
        align-items: center;

        strong {
            padding-left: 0.2em;
            padding-right: 1em;
            font-size: 1.2em;
        }
    }

    .button-area {
        display: flex;
        align-items: center;
        margin-top: 1.4em;

        .help img {
            display: block;
            margin: 0;
            padding: 0;
        }
    }
`;

// ---------------------- <RowToolbar /> ------------------------------

export const RowToolbar = styled.div`
    display: flex;
    align-items: center;
`;

// ---------------------- <RemoveFromHistoryButton /> -----------------

export const RemoveFromHistoryButton = styled.button`
    white-space: nowrap;
    margin-right: 1em;
`;


// ---------------------- <CurrentCorpCheckbox /> ----------------------

export const CurrentCorpCheckbox = styled.span`
    margin: 0;

    input {
        margin: 0;
        padding: 0;
    }
`;


// ---------------------- <ArchivedOnlyCheckbox /> ----------------------

export const ArchivedOnlyCheckbox = styled.span`
    margin: 0;

    input {
        margin: 0;
        padding: 0;
    }
`;


// ---------------------- <SearchKindSelector /> ----------------------

export const SearchKindSelector = styled.select`
    margin: 0;

    input {
        margin: 0;
        padding: 0;
    }
`;

// ---------------------- <HelpView /> --------------------------------------

export const HelpView = styled.div`



`;